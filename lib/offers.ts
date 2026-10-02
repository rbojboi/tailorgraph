import { ensureSchema, requirePool } from "./store";
import type { Listing } from "./types";

export async function respondToOffer(userId:string,offerId:string,revision:number,action:string,amount?:number) {
  if (!["accept","decline","counter"].includes(action) || !Number.isSafeInteger(revision)) throw new Error("Invalid offer response.");
  if (action==="counter" && (typeof amount!=="number" || !Number.isFinite(amount) || amount<0.5 || amount>100000 || Math.abs(Math.round(amount*100)-amount*100)>0.000001)) throw new Error("Enter an amount between $0.50 and $100,000 with no more than two decimal places.");
  await ensureSchema();
  const client=await requirePool().connect();
  try {
    await client.query("BEGIN");
    const result=await client.query(`SELECT o.*,l.status AS listing_status FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=$1 FOR UPDATE OF o,l`,[offerId]);
    const offer=result.rows[0];
    if (!offer || ![offer.buyer_id,offer.seller_id].includes(userId)) throw new Error("Offer not found.");
    if (offer.last_actor_id===userId) throw new Error("Wait for the other person to respond.");
    if (offer.revision!==revision || !["active","countered"].includes(offer.status) || new Date(offer.expires_at)<=new Date() || offer.listing_status!=="active") throw new Error("This offer has changed or is no longer available. Refresh to see its status.");
    const status=action==="accept"?"accepted":action==="decline"?"rejected":"countered";
    await client.query(`UPDATE offers SET status=$2,amount=$3,last_actor_id=$4,revision=revision+1,updated_at=NOW(),
      expires_at=NOW()+INTERVAL '7 days' WHERE id=$1`,[offerId,status,action==="counter"?amount:offer.amount,userId]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK");throw error; } finally {client.release();}
}

export async function applyAcceptedOfferPrices(listings:Listing[],buyerId:string|undefined) {
  if (!buyerId || !listings.length || !process.env.DATABASE_URL) return listings;
  await ensureSchema();
  const result=await requirePool().query(`SELECT listing_id,MIN(amount) AS amount FROM offers WHERE buyer_id=$1 AND listing_id=ANY($2::text[])
    AND status='accepted' AND expires_at>NOW() GROUP BY listing_id`,[buyerId,listings.map(l=>l.id)]);
  const prices=new Map(result.rows.map(row=>[row.listing_id,Number(row.amount)]));
  return listings.map(listing=>prices.has(listing.id)?{...listing,price:Math.min(listing.price,prices.get(listing.id)!)}:listing);
}

export async function expireOffers() {
  return requirePool().query(`UPDATE offers SET status='expired',revision=revision+1,updated_at=NOW()
    WHERE expires_at<=NOW() AND status IN ('active','countered','accepted')
    AND EXISTS(SELECT 1 FROM listings l WHERE l.id=offers.listing_id AND l.status='active')`);
}
