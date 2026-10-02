import { enqueueEmail } from "./email-outbox";
import { findListingById, findUserById, requirePool } from "./store";
import { renderEmailTemplate } from "./email-template";
import { filterAndSortMarketplaceListings } from "./marketplace-search";
import { getAppUrl } from "./stripe";
import type { EmailInput } from "./notifications";
import type { OptionalEmailKey } from "./notification-preferences";
import { offerEmailCopy } from "./offer-email";

async function queueNotice(userId:string,eventKey:string,title:string,text:string,path:string,key?:OptionalEmailKey,guard:Partial<EmailInput>={},button="View details") {
  const user=await findUserById(userId);
  if (!user) return;
  const url=getAppUrl()+path;
  await enqueueEmail({eventKey,eventType:key??"shipping_reminder",recipientUserId:user.id,to:user.email,
    preferenceKey:key,category:key?"alerts":path.startsWith("/seller")?"seller_orders":"buyer_orders",
    subject:title,text:`${text}\n\n${url}`,html:renderEmailTemplate({title,introParagraphs:[text],optional:Boolean(key),primaryAction:{label:button,url}},getAppUrl()),...guard});
}

export function savedSearchFilters(queryString:string) {
  const search=new URLSearchParams(queryString.replace(/^\?/,""));
  const filters:Record<string,string|string[]>={};
  for (const key of new Set(search.keys())) { const values=search.getAll(key);filters[key]=values.length===1?values[0]:values; }
  return filters;
}

export async function processNotificationEvents() {
  const db=requirePool();
  const events=await db.query("SELECT * FROM notification_events WHERE completed_at IS NULL ORDER BY id LIMIT 2");
  for (const event of events.rows) {
    const p=event.payload;
    const listing=p.listingId?await findListingById(p.listingId):null;
    let more=false;
    if(event.kind==="purchase_paid") {
      const {findOrderById}=await import("./store");
      const order=await findOrderById(p.orderId);
      if(order && !["pending_payment","failed","canceled"].includes(order.status)) {
        const [buyer,seller,orderListing]=await Promise.all([findUserById(order.buyerId),findUserById(order.sellerId),findListingById(order.listingId)]);
        if(buyer && seller) {
          const {sendOrderPurchasedNotifications}=await import("./notifications");
          await sendOrderPurchasedNotifications({order,listing:orderListing,buyer,seller});
        }
      }
    } else if (event.kind==="offer_changed" && listing) {
      const recipients=["accepted","rejected","expired"].includes(p.status)?[p.buyerId,p.sellerId]:[p.actorId===p.sellerId?p.buyerId:p.sellerId];
      const essential=p.autoCharge && Boolean(p.paymentState);
      const receipt=p.orderId?(await db.query("SELECT amount FROM orders WHERE id=$1",[p.orderId])).rows[0]:null;
      if(p.autoCharge && p.paymentState==="paid" && !receipt) throw new Error("Paid offer receipt is missing.");
      for(const id of recipients) {
        const copy=offerEmailCopy(p,listing.title,id===p.buyerId,receipt?Number(receipt.amount):undefined);
        await queueNotice(id,`offer:${p.offerId}:${p.revision}:${id}`,copy.subject,copy.text,
          id===p.sellerId?"/seller":p.paymentState==="paid"?"/buyer/orders":"/buyer/offers",
          essential?undefined:"offerAndPriceDropEmail",essential?{offerId:p.offerId,offerPaymentState:p.paymentState,eventType:"offer_payment"}:{},copy.button);
      }
    } else if (listing?.status==="active" && event.kind==="price_drop") {
      const saved=await db.query(`SELECT user_id AS id FROM user_saved_listings WHERE listing_id=$1 AND created_at<=$2 AND user_id>$3 ORDER BY user_id LIMIT 100`,[listing.id,event.created_at,p.cursor??""]);
      for (const row of saved.rows) if (row.id!==listing.sellerId) await queueNotice(row.id,`price:${event.id}:${row.id}`,"A saved item has a lower price",
        `${listing.title} dropped from $${Number(p.oldPrice).toFixed(2)} to $${Number(p.newPrice).toFixed(2)}.`, `/listings/${listing.id}`,"savedItemEmail",{listingId:listing.id,requireSavedItem:true,maximumPrice:Number(p.newPrice)});
      more=saved.rows.length===100;
      if (more) p.cursor=saved.rows.at(-1).id;
    } else if (listing?.status==="active" && event.kind==="listing_published") {
      const searches=await db.query(`SELECT id,user_id,query_string,name FROM user_saved_searches WHERE created_at<=$1 AND id>$2 ORDER BY id LIMIT 100`,[event.created_at,p.cursor??""]);
      for (const search of searches.rows) {
        const user=await findUserById(search.user_id);
        if (!user || user.id===listing.sellerId || !user.notificationPreferences.savedSearchEmail) continue;
        if (filterAndSortMarketplaceListings({sourceListings:[listing],filters:savedSearchFilters(search.query_string),buyerProfile:user.buyerProfile}).listings.length) {
          await queueNotice(user.id,`search:${search.id}:listing:${listing.id}`,"A new match for your saved search",
            `${listing.title} matches “${search.name}”. Listed at $${listing.price.toFixed(2)}.`, `/listings/${listing.id}`,"savedSearchEmail",{listingId:listing.id,savedSearchId:search.id});
        }
      }
      more=searches.rows.length===100;
      if (more) p.cursor=searches.rows.at(-1).id;
    }
    await db.query("UPDATE notification_events SET payload=$2::jsonb,completed_at=CASE WHEN $3 THEN NULL ELSE NOW() END WHERE id=$1",[event.id,JSON.stringify(p),more]);
  }
}

export async function queueShippingReminders() {
  const orders=await requirePool().query(`SELECT o.* FROM orders o WHERE status IN ('paid','processing') AND shipped_at IS NULL
    AND ship_by_at<=NOW()+INTERVAL '24 hours' AND (NOT EXISTS(SELECT 1 FROM email_outbox e WHERE e.event_key='shipping:'||o.id||':seller:'||CASE WHEN o.ship_by_at<=NOW() THEN 'late' ELSE 'soon' END)
      OR (ship_by_at<=NOW() AND NOT EXISTS(SELECT 1 FROM email_outbox e WHERE e.event_key='shipping:'||o.id||':buyer:late')))
    ORDER BY ship_by_at LIMIT 10`);
  for (const order of orders.rows) {
    const late=new Date(order.ship_by_at)<=new Date();
    const date=new Date(order.ship_by_at).toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric"});
    await queueNotice(order.seller_id,`shipping:${order.id}:seller:${late?"late":"soon"}`,late?"An order is overdue for shipping":"An order is due to ship soon",
      `${order.listing_title}: the shipping deadline is ${date}. Please ship the order and add tracking, or contact the buyer if there is a delay.`,"/seller",undefined,{orderId:order.id,requireUnshipped:true});
    if (late) await queueNotice(order.buyer_id,`shipping:${order.id}:buyer:late`,"Your order is taking longer to ship",
      `${order.listing_title} has passed its estimated shipping deadline of ${date}, and shipment has not been recorded. You can contact the seller from your purchases or reach TailorGraph support.`,"/buyer",undefined,{orderId:order.id,requireUnshipped:true});
  }
}
