import {randomUUID} from "node:crypto";
import type Stripe from "stripe";
import {ensureSchema,findListingById,findUserById,requirePool} from "./store";
import {getAppUrl,isStripeConfigured} from "./stripe";
import {cents,commerceLock,validAmount,validateOfferAddress,getPaymentStripe as getStripe} from "./commerce-common";
import {prepareOfferPayment,processCommercePayment} from "./commerce-payments";
import type {ShippingAddress} from "./types";

export async function createBindingOffer(buyerId:string,listingId:string,amount:number,message:string) {
  await ensureSchema();
  if (!validAmount(amount) || message.length>1000) throw new Error("Enter a valid offer amount and a note of no more than 1,000 characters.");
  const id=randomUUID();
  const result=await requirePool().query(`INSERT INTO offers(id,buyer_id,seller_id,listing_id,amount,status,message,last_actor_id,auto_charge)
    SELECT $1,$2,seller_id,id,$3,'draft',$4,$2,TRUE FROM listings WHERE id=$5 AND status='active' AND allow_offers=TRUE AND seller_id<>$2 RETURNING id`,[id,buyerId,amount,message||null,listingId]);
  if (!result.rows.length) throw new Error("This listing is not available for offers.");
  return prepareOfferAuthorization(id,buyerId,"submit");
}

export async function prepareOfferAuthorization(offerId:string,buyerId:string,purpose:"submit"|"counter"|"accept",proposedAmount?:number) {
  await ensureSchema();
  const offer=(await requirePool().query("SELECT * FROM offers WHERE id=$1 AND buyer_id=$2",[offerId,buyerId])).rows[0];
  if (!offer?.auto_charge || new Date(offer.expires_at)<=new Date()) throw new Error("This offer is no longer available.");
  if (purpose==="submit" ? offer.status!=="draft" : !["active","countered"].includes(offer.status)||offer.last_actor_id===buyerId) throw new Error("This offer has changed. Refresh your offers.");
  const amount=purpose==="counter"?proposedAmount: Number(offer.amount);
  if (typeof amount!=="number" || !validAmount(amount)) throw new Error("Enter an amount between $0.50 and $100,000 with no more than two decimal places.");
  const listing=await findListingById(offer.listing_id);
  const seller=await findUserById(offer.seller_id);
  if (!listing || listing.status!=="active" || !listing.allowOffers || !seller?.stripeAccountId) throw new Error("This seller or listing cannot currently accept offers.");
  const id=randomUUID();
  await requirePool().query(`INSERT INTO offer_authorizations(id,offer_id,buyer_id,revision,purpose,amount_cents,shipping_cents,seller_account_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,offerId,buyerId,offer.revision,purpose,cents(amount),cents(listing.shippingPrice),seller.stripeAccountId,offer.expires_at]);
  return id;
}

export async function getOfferAuthorization(id:string,buyerId:string) {
  await ensureSchema();
  return (await requirePool().query(`SELECT a.*,o.listing_id,l.title AS listing_title FROM offer_authorizations a
    JOIN offers o ON o.id=a.offer_id JOIN listings l ON l.id=o.listing_id WHERE a.id=$1 AND a.buyer_id=$2`,[id,buyerId])).rows[0]??null;
}

export function offerConsent(amountCents:number,shippingCents:number,purpose:string,expiresAt:Date) {
  const total=((amountCents+shippingCents)/100).toFixed(2);
  return `I authorize TailorGraph to save my card with Stripe and charge $${total} USD ($${(amountCents/100).toFixed(2)} for the item plus $${(shippingCents/100).toFixed(2)} shipping) ${purpose==="accept"?"when I complete this acceptance":"if the seller accepts this offer"}. This offer must be accepted before ${expiresAt.toISOString()}; an authorized payment may finish afterward. This permission applies only to this offer and total. A changed offer requires my approval again. My bank may require additional verification.`;
}

export async function startOfferAuthorization(id:string,buyerId:string,address:ShippingAddress,consent:boolean) {
  if (!consent) throw new Error("Please authorize the displayed total before continuing.");
  validateOfferAddress(address);
  return commerceLock(`authorization:${id}`,async()=>{
    let auth=await getOfferAuthorization(id,buyerId);
    if (!auth || !["draft","authorizing"].includes(auth.state) || new Date(auth.expires_at)<=new Date() || Date.now()-new Date(auth.created_at).getTime()>23*3600000) throw new Error("This authorization has expired. Return to your offers and review it again.");
    const buyer=await findUserById(buyerId);
    if (!buyer || !["buyer","both"].includes(buyer.role)) throw new Error("A buyer account is required.");
    const stripe=getStripe();
    const account=await stripe.accounts.retrieve(auth.seller_account_id);
    if (!account.charges_enabled || !account.payouts_enabled || !account.details_submitted) throw new Error("The seller must complete payout setup before you can submit this offer.");
    if (auth.state==="draft") {
      await requirePool().query("UPDATE offer_authorizations SET shipping_address=$2::jsonb,consent_text=$3,consented_at=NOW(),state='authorizing' WHERE id=$1 AND state='draft'",[id,JSON.stringify(address),offerConsent(auth.amount_cents,auth.shipping_cents,auth.purpose,new Date(auth.expires_at))]);
      auth=await getOfferAuthorization(id,buyerId);
    } else if (JSON.stringify(auth.shipping_address)!==JSON.stringify(address)) {
      // A pending Stripe request must retain its original quote and address.
      for (const key of Object.keys(address) as (keyof ShippingAddress)[]) if (auth.shipping_address[key]!==address[key]) throw new Error("This authorization already uses a different shipping address. Start a new authorization from your offers.");
    }
    if (!auth.customer_id) {
      const customer=await stripe.customers.create({email:buyer.email,name:buyer.name,metadata:{tailorgraphBuyer:buyer.id,offerAuthorization:id}},{idempotencyKey:`offer-auth:${id}:customer`});
      await requirePool().query("UPDATE offer_authorizations SET customer_id=$2 WHERE id=$1",[id,customer.id]);auth.customer_id=customer.id;
    }
    let session;
    if (auth.setup_session_id) session=await stripe.checkout.sessions.retrieve(auth.setup_session_id);
    else {
      session=await stripe.checkout.sessions.create({mode:"setup",customer:auth.customer_id,payment_method_types:["card"],
        metadata:{kind:"offer_authorization",authorizationId:id},setup_intent_data:{metadata:{authorizationId:id}},
        custom_text:{submit:{message:auth.consent_text}},
        success_url:`${getAppUrl()}/offers/authorization-complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:`${getAppUrl()}/offers/authorize/${id}?notice=Card+setup+was+canceled.+Your+offer+has+not+been+submitted.`},
        {idempotencyKey:`offer-auth:${id}:checkout`});
      await requirePool().query("UPDATE offer_authorizations SET setup_session_id=$2 WHERE id=$1",[id,session.id]);
    }
    if (session.status!=="open" || !session.url) throw new Error("This card setup is no longer open. Return to your offers to see its status.");
    return session.url;
  });
}

export async function completeOfferAuthorization(session:Stripe.Checkout.Session) {
  if (session.mode!=="setup" || session.status!=="complete" || session.metadata?.kind!=="offer_authorization") return;
  const id=session.metadata.authorizationId;
  if (!id || typeof session.setup_intent!=="string") return;
  await commerceLock(`authorization:${id}`,async()=>{
    const setup=await getStripe().setupIntents.retrieve(session.setup_intent as string);
    if (setup.status!=="succeeded" || typeof setup.payment_method!=="string") return;
    const client=await requirePool().connect();let paymentId:string|undefined;
    try {
      await client.query("BEGIN");
      const auth=(await client.query("SELECT * FROM offer_authorizations WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if (!auth || auth.state!=="authorizing") {await client.query("ROLLBACK");return;}
      if (!auth.consented_at || session.customer!==auth.customer_id || setup.customer!==auth.customer_id || setup.metadata?.authorizationId!==id || (auth.setup_session_id && auth.setup_session_id!==session.id)) throw new Error("Payment authorization does not match this offer.");
      const offer=(await client.query("SELECT * FROM offers WHERE id=$1 FOR UPDATE",[auth.offer_id])).rows[0];
      if (!offer || !offer.auto_charge || offer.revision!==auth.revision || new Date(auth.expires_at)<=new Date() || !["draft","active","countered"].includes(offer.status)) {
        await client.query("UPDATE offer_authorizations SET state='canceled' WHERE id=$1",[id]);await client.query("COMMIT");return;
      }
      await client.query("UPDATE offer_authorizations SET state='ready',setup_session_id=$2,setup_intent_id=$3,payment_method_id=$4 WHERE id=$1",[id,session.id,setup.id,setup.payment_method]);
      auth.payment_method_id=setup.payment_method;
      if (auth.purpose==="accept") {
        if (offer.last_actor_id===auth.buyer_id) throw new Error("The offer is no longer awaiting your acceptance.");
        // Lock inventory before reserving so a competing purchase ends this
        // authorization cleanly, instead of making Stripe retry it forever.
        const available=await client.query("SELECT id,status FROM listings WHERE id=$1 FOR UPDATE",[offer.listing_id]);
        const pending=await client.query("SELECT 1 FROM orders WHERE listing_id=$1 AND status='pending_payment' LIMIT 1",[offer.listing_id]);
        if(available.rows[0]?.status!=="active" || pending.rows.length) {
          await client.query("UPDATE offer_authorizations SET state='canceled' WHERE id=$1",[id]);await client.query("COMMIT");return;
        }
        paymentId=await prepareOfferPayment(client,offer,auth,auth.buyer_id);
      } else {
        const available=await client.query("SELECT 1 FROM listings WHERE id=$1 AND status='active' AND allow_offers=TRUE",[offer.listing_id]);
        if (!available.rows.length) {await client.query("UPDATE offer_authorizations SET state='canceled' WHERE id=$1",[id]);await client.query("COMMIT");return;}
        await client.query(`UPDATE offers SET amount=$2,status=$3,last_actor_id=buyer_id,authorization_id=$4,revision=revision+1,updated_at=NOW()
          WHERE id=$1`,[offer.id,auth.amount_cents/100,auth.purpose==="submit"?"active":"countered",id]);
        await client.query("UPDATE offer_authorizations SET revision=$2 WHERE id=$1",[id,offer.revision+1]);
      }
      await client.query("COMMIT");
    } catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    if (paymentId) await processCommercePayment(paymentId);
  });
}

export async function processOfferAuthorizations() {
  if(!isStripeConfigured() || !process.env.DATABASE_URL) return;
  await ensureSchema();
  const rows=await requirePool().query("SELECT * FROM offer_authorizations WHERE state='authorizing' ORDER BY checked_at NULLS FIRST LIMIT 5");
  const started=Date.now();
  for(const row of rows.rows) {
    if(Date.now()-started>=8000) break;
    try {
      if(!row.setup_session_id) {
        if(Date.now()-new Date(row.created_at).getTime()<23*3600000) await startOfferAuthorization(row.id,row.buyer_id,row.shipping_address,true);
        else await requirePool().query("UPDATE offer_authorizations SET state='canceled' WHERE id=$1 AND state='authorizing'",[row.id]);
      }
      const current=await getOfferAuthorization(row.id,row.buyer_id);
      if(!current?.setup_session_id) continue;
      const session=await getStripe().checkout.sessions.retrieve(current.setup_session_id);
      if(session.status==="complete") await completeOfferAuthorization(session);
      else if(session.status==="expired") await requirePool().query("UPDATE offer_authorizations SET state='canceled' WHERE id=$1 AND state='authorizing'",[row.id]);
    } catch { /* Leave the authorization retryable; no charge is assumed. */ }
    await requirePool().query("UPDATE offer_authorizations SET checked_at=NOW() WHERE id=$1",[row.id]);
  }
}
