import {randomUUID} from "node:crypto";
import type Stripe from "stripe";
import type {PoolClient} from "pg";
import {ensureSchema,findListingById,findUserById,requirePool} from "./store";
import {getAppUrl,isStripeConfigured} from "./stripe";
import {cents,commerceLock,createCommerceOrder,reservePaymentListings,sellerProceeds,validateOfferAddress,getPaymentStripe as getStripe} from "./commerce-common";
import type {Listing,ShippingAddress,User} from "./types";

type Payment={id:string;kind:string;buyer_id:string;offer_id:string|null;authorization_id:string|null;listing_ids:string[];order_ids:string[];
  state:string;session_id:string|null;payment_intent_id:string|null;recovery_started_at:Date|null;created_at:Date;expires_at:Date;
  provider_params:{totalCents:number;checkout?:Stripe.Checkout.SessionCreateParams;intent?:Stripe.PaymentIntentCreateParams};recovery_params:Stripe.Checkout.SessionCreateParams|null};
type OfferRow={id:string;buyer_id:string;seller_id:string;listing_id:string;amount:number;revision:number;expires_at:Date};
type Authorization={id:string;buyer_id:string;amount_cents:number;shipping_cents:number;shipping_address:ShippingAddress;customer_id:string;payment_method_id:string;seller_account_id:string};
const payment=async(id:string)=>(await requirePool().query<Payment>("SELECT * FROM commerce_payments WHERE id=$1",[id])).rows[0];

export async function prepareOfferPayment(client:PoolClient,offer:OfferRow,auth:Authorization,actorId:string) {
  const listing=await findListingById(offer.listing_id),buyer=await findUserById(offer.buyer_id),seller=await findUserById(offer.seller_id);
  if (!listing || !buyer || !seller || seller.stripeAccountId!==auth.seller_account_id || !auth.payment_method_id || !auth.customer_id || !auth.shipping_address) throw new Error("Payment authorization must be renewed before accepting this offer.");
  if (cents(Number(offer.amount))!==auth.amount_cents) throw new Error("The offer amount has changed. The buyer must approve it again.");
  const id=randomUUID(),total=auth.amount_cents+auth.shipping_cents;
  const a=auth.shipping_address;
  const intent:Stripe.PaymentIntentCreateParams={amount:total,currency:"usd",customer:auth.customer_id,payment_method:auth.payment_method_id,
    payment_method_types:["card"],description:`TailorGraph offer: ${listing.title}`,metadata:{paymentAttempt:id,offerId:offer.id},
    transfer_data:{destination:auth.seller_account_id,amount:sellerProceeds(auth.amount_cents/100)},
    shipping:{name:a.fullName,address:{line1:a.line1,line2:a.line2,city:a.city,state:a.state,postal_code:a.postalCode,country:a.country}}};
  await client.query(`INSERT INTO commerce_payments(id,kind,buyer_id,offer_id,authorization_id,listing_ids,provider_params,expires_at)
    VALUES($1,'offer',$2,$3,$4,$5,$6::jsonb,NOW()+INTERVAL '24 hours')`,[id,buyer.id,offer.id,auth.id,[listing.id],JSON.stringify({totalCents:total,intent})]);
  await reservePaymentListings(client,[listing.id],id);
  const order=await createCommerceOrder(client,listing,buyer,a,auth.amount_cents/100,auth.shipping_cents/100);
  await client.query("UPDATE commerce_payments SET order_ids=$2 WHERE id=$1",[id,[order.id]]);
  await client.query("UPDATE offer_authorizations SET state='used' WHERE id=$1",[auth.id]);
  await client.query(`UPDATE offers SET status='accepted',payment_state='pending',authorization_id=$2,last_actor_id=$3,revision=revision+1,updated_at=NOW(),expires_at=NOW()+INTERVAL '24 hours' WHERE id=$1`,[offer.id,auth.id,actorId]);
  return id;
}

export async function acceptBindingOffer(userId:string,offerId:string,revision:number) {
  await ensureSchema();
  const id=await commerceLock(`offer:${offerId}`,async()=>{
    const client=await requirePool().connect();
    try {
      await client.query("BEGIN");
      const offer=(await client.query("SELECT * FROM offers WHERE id=$1 FOR UPDATE",[offerId])).rows[0];
      if (!offer?.auto_charge || offer.seller_id!==userId || offer.last_actor_id!==offer.buyer_id || offer.revision!==revision || !["active","countered"].includes(offer.status) || new Date(offer.expires_at)<=new Date()) throw new Error("This offer has changed or is no longer awaiting your acceptance.");
      const auth=(await client.query("SELECT * FROM offer_authorizations WHERE id=$1 AND state='ready' FOR UPDATE",[offer.authorization_id])).rows[0];
      if (!auth || auth.buyer_id!==offer.buyer_id || auth.revision!==offer.revision || new Date(auth.expires_at)<=new Date()) throw new Error("The buyer must authorize payment before this offer can be accepted.");
      const paymentId=await prepareOfferPayment(client,offer,auth,userId);
      await client.query("COMMIT");return paymentId;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  });
  // The persisted payment is recoverable even if this request stops here.
  await processCommercePayment(id);
}

export async function startMarketplaceCheckout(listings:Listing[],buyer:User,address:ShippingAddress) {
  await ensureSchema();validateOfferAddress(address);
  if (!listings.length || new Set(listings.map(l=>l.id)).size!==listings.length || listings.some(l=>l.sellerId===buyer.id) || new Set(listings.map(l=>l.sellerId)).size!==1) throw new Error("Choose available items from one seller.");
  const seller=await findUserById(listings[0].sellerId);
  if (!seller?.stripeAccountId) throw new Error("Seller payout setup is incomplete.");
  const account=await getStripe().accounts.retrieve(seller.stripeAccountId);
  if (!account.charges_enabled || !account.payouts_enabled || !account.details_submitted) throw new Error("Seller payout setup is incomplete.");
  const client=await requirePool().connect(),id=randomUUID();
  try {
    await client.query("BEGIN");
    // Re-read prices under the same locks used by offer acceptance.
    const locked=await client.query("SELECT id,price,shipping_price FROM listings WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",[listings.map(l=>l.id)]);
    for(const item of listings){
      const row=locked.rows.find(row=>row.id===item.id);
      if (!row || cents(Number(row.shipping_price))!==cents(item.shippingPrice)) throw new Error("An item has changed. Refresh checkout to review the total.");
      const accepted=await client.query("SELECT MIN(amount) AS amount FROM offers WHERE listing_id=$1 AND buyer_id=$2 AND status='accepted' AND auto_charge=FALSE AND expires_at>NOW()",[item.id,buyer.id]);
      const currentPrice=Math.min(Number(row.price),accepted.rows[0]?.amount==null?Number(row.price):Number(accepted.rows[0].amount));
      if (cents(currentPrice)!==cents(item.price)) throw new Error("An item price has changed. Refresh checkout to review the total.");
    }
    const total=listings.reduce((sum,l)=>sum+cents(l.price)+cents(l.shippingPrice),0);
    const subtotal=listings.reduce((sum,l)=>sum+cents(l.price),0);
    const checkout:Stripe.Checkout.SessionCreateParams={mode:"payment",payment_method_types:["card"],customer_email:buyer.email,
      success_url:`${getAppUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${getAppUrl()}/cart?checkoutError=Checkout+was+canceled.+The+reservation+expires+after+30+minutes.`,
      expires_at:Math.floor(Date.now()/1000)+31*60,
      line_items:listings.flatMap(l=>[{quantity:1,price_data:{currency:"usd",unit_amount:cents(l.price),product_data:{name:l.title}}},...(l.shippingPrice>0?[{quantity:1,price_data:{currency:"usd",unit_amount:cents(l.shippingPrice),product_data:{name:`Shipping — ${l.title}`}}}]:[])]),
      metadata:{kind:"marketplace_payment",paymentAttempt:id},payment_intent_data:{metadata:{paymentAttempt:id},transfer_data:{destination:seller.stripeAccountId,amount:sellerProceeds(subtotal/100)},
        shipping:{name:address.fullName,address:{line1:address.line1,line2:address.line2,city:address.city,state:address.state,postal_code:address.postalCode,country:address.country}}}};
    await client.query("INSERT INTO commerce_payments(id,kind,buyer_id,listing_ids,provider_params,expires_at) VALUES($1,'checkout',$2,$3,$4::jsonb,NOW()+INTERVAL '31 minutes')",[id,buyer.id,listings.map(l=>l.id),JSON.stringify({totalCents:total,checkout})]);
    await reservePaymentListings(client,listings.map(l=>l.id),id);
    const orders=[];
    for(const listing of listings) orders.push(await createCommerceOrder(client,listing,buyer,address,listing.price,listing.shippingPrice));
    await client.query("UPDATE commerce_payments SET order_ids=$2 WHERE id=$1",[id,orders.map(o=>o.id)]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  const session=await commerceLock(`payment:${id}`,async()=>createCheckout(await payment(id)));
  if (!session.url) throw new Error("Checkout is processing. Please check your purchases shortly.");
  return session.url;
}

async function createCheckout(p:Payment) {
  if(p.session_id) return getStripe().checkout.sessions.retrieve(p.session_id);
  // Persist recovery before canceling the original attempt; retries must never
  // create another payable session while the first charge can still succeed.
  if(p.recovery_params && p.payment_intent_id) {
    const original=await getStripe().paymentIntents.retrieve(p.payment_intent_id);
    if(original.status==="succeeded") {await finishPayment(p,original);throw new Error("Payment has completed. View your purchases.");}
    if(!["requires_action","requires_payment_method","canceled"].includes(original.status)) throw new Error("Your bank is still processing this payment.");
    if(original.status!=="canceled") await getStripe().paymentIntents.cancel(original.id);
  }
  const params=p.recovery_params??p.provider_params.checkout;
  if(!params) throw new Error("Checkout details are missing.");
  const started=p.recovery_started_at??p.created_at;
  if(Date.now()-new Date(started).getTime()>=23*3600000) throw new Error("This checkout needs support review before it can be retried.");
  const session=await getStripe().checkout.sessions.create(params,{idempotencyKey:`commerce:${p.id}:${p.kind==="offer"?"recovery":"checkout"}`});
  await requirePool().query("UPDATE commerce_payments SET session_id=$2,state='checkout',updated_at=NOW() WHERE id=$1",[p.id,session.id]);
  await requirePool().query("UPDATE orders SET stripe_checkout_session_id=$2 WHERE id=ANY($1::text[])",[p.order_ids,session.id]);
  return session;
}

async function finishPayment(p:Payment,intent:Stripe.PaymentIntent) {
  if(intent.status!=="succeeded" || intent.currency!=="usd" || intent.amount!==p.provider_params.totalCents || intent.amount_received!==p.provider_params.totalCents || intent.metadata.paymentAttempt!==p.id) throw new Error("Payment receipt does not match this purchase.");
  const expected=p.provider_params.intent??p.provider_params.checkout?.payment_intent_data;
  const destination=typeof intent.transfer_data?.destination==="string"?intent.transfer_data.destination:intent.transfer_data?.destination.id;
  if(destination!==expected?.transfer_data?.destination || intent.transfer_data?.amount!==expected?.transfer_data?.amount || (p.provider_params.intent?.customer && intent.customer!==p.provider_params.intent.customer)) throw new Error("Payment recipient does not match this purchase.");
  const client=await requirePool().connect();
  try{
    await client.query("BEGIN");
    const current=(await client.query<Payment>("SELECT * FROM commerce_payments WHERE id=$1 FOR UPDATE",[p.id])).rows[0];
    if(current.state==="paid"){await client.query("COMMIT");return;}
    if(current.state==="canceled") throw new Error("A canceled purchase received a payment and requires support review.");
    const claims=await client.query("SELECT listing_id FROM listing_payment_claims WHERE payment_id=$1",[p.id]);
    if(claims.rows.length!==p.listing_ids.length) throw new Error("The payment reservation needs support review.");
    const updated=await client.query("UPDATE orders SET status='processing',stripe_payment_intent_id=$2 WHERE id=ANY($1::text[]) AND status='pending_payment'",[p.order_ids,intent.id]);
    if(updated.rowCount!==p.order_ids.length) throw new Error("The order state needs support review before fulfillment.");
    await client.query("UPDATE listings SET status='sold' WHERE id=ANY($1::text[])",[p.listing_ids]);
    await client.query("DELETE FROM listing_payment_claims WHERE payment_id=$1",[p.id]);
    await client.query("UPDATE commerce_payments SET state='paid',payment_intent_id=$2,error_code=NULL,updated_at=NOW() WHERE id=$1",[p.id,intent.id]);
    if(p.offer_id) await client.query("UPDATE offers SET payment_state='paid',paid_order_id=$2,revision=revision+1,updated_at=NOW() WHERE id=$1",[p.offer_id,p.order_ids[0]]);
    else for(const orderId of p.order_ids) await client.query("INSERT INTO notification_events(kind,payload) VALUES('purchase_paid',$1::jsonb)",[JSON.stringify({orderId})]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

async function inspectSession(p:Payment,session:Stripe.Checkout.Session) {
  if(session.metadata?.paymentAttempt!==p.id || session.mode!=="payment") throw new Error("Checkout does not match this purchase.");
  if(session.payment_status==="paid" && typeof session.payment_intent==="string") {
    if(session.amount_total!==p.provider_params.totalCents || session.currency!=="usd") throw new Error("Checkout total does not match this purchase.");
    await finishPayment(p,await getStripe().paymentIntents.retrieve(session.payment_intent));return true;
  }
  return false;
}

async function cancelPayment(p:Payment) {
  const stripe=getStripe();
  if(p.session_id){
    let session=await stripe.checkout.sessions.retrieve(p.session_id);
    if(await inspectSession(p,session)) return;
    if(session.status==="open") session=await stripe.checkout.sessions.expire(session.id);
    if(session.status!=="expired" && typeof session.payment_intent!=="string") return;
    if(typeof session.payment_intent==="string") {
      const intent=await stripe.paymentIntents.retrieve(session.payment_intent);
      if(intent.status==="succeeded"){await finishPayment(p,intent);return;}
      if(intent.status==="processing") return;
      if(intent.status!=="canceled") await stripe.paymentIntents.cancel(intent.id);
    }
  }
  if(p.payment_intent_id){
    const intent=await stripe.paymentIntents.retrieve(p.payment_intent_id);
    if(intent.status==="succeeded"){await finishPayment(p,intent);return;}
    if(intent.status==="processing") return;
    if(intent.status!=="canceled") await stripe.paymentIntents.cancel(intent.id);
  }
  const client=await requirePool().connect();
  try{
    await client.query("BEGIN");
    const current=(await client.query("SELECT state FROM commerce_payments WHERE id=$1 FOR UPDATE",[p.id])).rows[0];
    if(current.state!=="paid"){
      const released=await client.query("DELETE FROM listing_payment_claims WHERE payment_id=$1 RETURNING listing_id",[p.id]);
      await client.query("UPDATE listings SET status='active' WHERE id=ANY($1::text[]) AND status='reserved'",[released.rows.map(row=>row.listing_id)]);
      await client.query("UPDATE orders SET status='failed' WHERE id=ANY($1::text[]) AND status='pending_payment'",[p.order_ids]);
      await client.query("UPDATE commerce_payments SET state='canceled',updated_at=NOW() WHERE id=$1",[p.id]);
      if(p.offer_id) await client.query("UPDATE offers SET status='expired',payment_state='canceled',revision=revision+1,updated_at=NOW() WHERE id=$1",[p.offer_id]);
    }
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function processCommercePayment(id:string) {
  await commerceLock(`payment:${id}`,async()=>{
    let p=await payment(id);
    if(!p || ["paid","canceled","review"].includes(p.state)) return;
    await requirePool().query("UPDATE commerce_payments SET updated_at=NOW() WHERE id=$1",[id]);
    if(p.session_id){
      const session=await getStripe().checkout.sessions.retrieve(p.session_id);
      if(await inspectSession(p,session)) return;
      if(session.status==="expired" || new Date(p.expires_at)<=new Date()) await cancelPayment(p);
      return;
    }
    // Recover an ambiguous Checkout creation before releasing inventory.
    if(p.kind==="checkout" || p.recovery_params){
      if(Date.now()-new Date(p.recovery_started_at??p.created_at).getTime()>=23*3600000){await requirePool().query("UPDATE commerce_payments SET state='review',error_code='checkout_recovery_window_expired' WHERE id=$1",[id]);return;}
      await createCheckout(p);return;
    }
    if(new Date(p.expires_at)<=new Date()){await cancelPayment(p);return;}
    const stripe=getStripe();
    if(!p.payment_intent_id){
      // Creation never confirms. Persist the returned ID before any charge is attempted.
      const intent=await stripe.paymentIntents.create(p.provider_params.intent!,{idempotencyKey:`commerce:${id}:intent`});
      await requirePool().query("UPDATE commerce_payments SET payment_intent_id=$2,state='pending',updated_at=NOW() WHERE id=$1",[id,intent.id]);p=await payment(id);
    }
    let intent=await stripe.paymentIntents.retrieve(p.payment_intent_id!);
    if(intent.status==="requires_confirmation"){
      try{await stripe.paymentIntents.confirm(intent.id,{off_session:true},{idempotencyKey:`commerce:${id}:confirm`});}catch{/* Retrieve the authoritative state after declines or lost responses. */}
      intent=await stripe.paymentIntents.retrieve(intent.id);
    }
    if(intent.status==="succeeded"){await finishPayment(p,intent);return;}
    if(intent.status==="canceled"){await cancelPayment(p);return;}
    const needsPayment=["requires_action","requires_payment_method"].includes(intent.status);
    await requirePool().query("UPDATE commerce_payments SET state=$2,error_code=$3,updated_at=NOW() WHERE id=$1",[id,needsPayment?"needs_payment":"pending",needsPayment?"buyer_action_required":null]);
    if(needsPayment) await requirePool().query("UPDATE offers SET payment_state='needs_payment',revision=revision+1,updated_at=NOW() WHERE id=$1 AND payment_state IS DISTINCT FROM 'needs_payment'",[p.offer_id]);
  });
}

export async function startOfferPaymentRecovery(offerId:string,buyerId:string) {
  const p=(await requirePool().query<Payment>("SELECT * FROM commerce_payments WHERE offer_id=$1 AND buyer_id=$2",[offerId,buyerId])).rows[0];
  if(!p) throw new Error("Payment not found.");
  return commerceLock(`payment:${p.id}`,async()=>{
    const current=await payment(p.id);
    if(current.state==="paid") return `${getAppUrl()}/buyer/orders`;
    if(["canceled","review"].includes(current.state) || new Date(current.expires_at)<=new Date()) throw new Error("This payment window has ended. Check your offers or contact support.");
    if(!current.recovery_params){
      if(!current.payment_intent_id) throw new Error("Your payment is still being processed. Please check again shortly.");
      const stripe=getStripe(),intent=await stripe.paymentIntents.retrieve(current.payment_intent_id);
      if(intent.status==="succeeded"){await finishPayment(current,intent);return `${getAppUrl()}/buyer/orders`;}
      if(!["requires_action","requires_payment_method","canceled"].includes(intent.status)) throw new Error("Your bank is still processing this payment.");
      const quote=current.provider_params.intent!;
      const params:Stripe.Checkout.SessionCreateParams={mode:"payment",payment_method_types:["card"],customer:quote.customer as string,
        expires_at:Math.floor(Date.now()/1000)+31*60,line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:current.provider_params.totalCents,product_data:{name:"TailorGraph accepted offer — item and shipping"}}}],
        metadata:{kind:"offer_recovery",paymentAttempt:current.id},payment_intent_data:{metadata:{paymentAttempt:current.id,offerId},transfer_data:quote.transfer_data,shipping:quote.shipping as Stripe.Checkout.SessionCreateParams.PaymentIntentData.Shipping},
        success_url:`${getAppUrl()}/offers/payment-complete?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${getAppUrl()}/buyer/offers?offerNotice=Payment+was+not+completed.+Please+finish+payment+before+the+reservation+expires.`};
      await requirePool().query("UPDATE commerce_payments SET recovery_params=$2::jsonb,recovery_started_at=NOW(),state='recovering',expires_at=NOW()+INTERVAL '31 minutes' WHERE id=$1",[current.id,JSON.stringify(params)]);
      await requirePool().query("UPDATE offers SET expires_at=(SELECT expires_at FROM commerce_payments WHERE id=$2) WHERE id=$1",[offerId,current.id]);
    }
    const session=await createCheckout(await payment(p.id));
    if(session.status!=="open"||!session.url) throw new Error("This checkout has ended. Check your offers for its status.");
    return session.url;
  });
}

export async function handleCommerceSession(session:Stripe.Checkout.Session) {
  const id=session.metadata?.paymentAttempt;
  if(!id) return false;
  const p=await payment(id);
  if(!p) return false;
  await commerceLock(`payment:${id}`,async()=>{
    if(session.mode!=="payment" || session.metadata?.kind!==(p.kind==="offer"?"offer_recovery":"marketplace_payment") || (p.kind==="offer"&&!p.recovery_params)) throw new Error("Checkout does not match this purchase.");
    if(p.session_id && p.session_id!==session.id) throw new Error("Checkout session mismatch.");
    // Persist even if the creation response was lost before its ID reached the database.
    await requirePool().query("UPDATE commerce_payments SET session_id=$2 WHERE id=$1",[id,session.id]);
    await requirePool().query("UPDATE orders SET stripe_checkout_session_id=$2 WHERE id=ANY($1::text[])",[p.order_ids,session.id]);
    if(!await inspectSession(p,session) && session.status==="expired") await cancelPayment({...p,session_id:session.id});
  });return true;
}

export async function processCommercePayments() {
  if(!isStripeConfigured() || !process.env.DATABASE_URL) return;
  await ensureSchema();
  const started=Date.now();
  await reconcileLegacyCheckouts();
  const rows=await requirePool().query("SELECT id FROM commerce_payments WHERE state NOT IN ('paid','canceled','review') ORDER BY updated_at LIMIT 10");
  for(const row of rows.rows){
    if(Date.now()-started>=12000) break;
    try{await processCommercePayment(row.id);}catch{await requirePool().query("UPDATE commerce_payments SET error_code='provider_or_storage_error',updated_at=NOW() WHERE id=$1",[row.id]);}
  }
}

async function reconcileLegacyCheckouts() {
  const db=requirePool();
  const rows=await db.query(`SELECT DISTINCT o.stripe_checkout_session_id AS id FROM orders o
    WHERE o.status='pending_payment' AND o.stripe_checkout_session_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM commerce_payments p WHERE o.id=ANY(p.order_ids)) LIMIT 2`);
  for(const row of rows.rows) {
    try {
      const session=await getStripe().checkout.sessions.retrieve(row.id);
      // Expired sessions are no longer payable. An ambiguous legacy order with
      // no session ID stays blocked for manual Stripe review.
      if(session.status==="expired") await db.query("UPDATE orders SET status='failed' WHERE stripe_checkout_session_id=$1 AND status='pending_payment'",[row.id]);
      else if(session.payment_status==="paid") {
        const {markOrderPaidBySessionId,listOrdersByStripeCheckoutSessionId}=await import("./store");
        await markOrderPaidBySessionId(row.id,typeof session.payment_intent==="string"?session.payment_intent:null);
        for(const order of await listOrdersByStripeCheckoutSessionId(row.id)) await db.query("INSERT INTO notification_events(kind,payload) VALUES('purchase_paid',$1::jsonb)",[JSON.stringify({orderId:order.id})]);
      }
    } catch { /* Keep legacy inventory blocked if Stripe cannot verify it. */ }
  }
}
