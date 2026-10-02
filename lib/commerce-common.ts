import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { createOrder, requirePool } from "./store";
import type { Listing, ShippingAddress, User } from "./types";
import {getStripe} from "./stripe";

// Durable reconciliation handles retries without exhausting a serverless worker.
export const getPaymentStripe=()=>getStripe({timeout:4000,maxNetworkRetries:0});

export const cents=(amount:number)=>Math.round(amount*100);
export const sellerProceeds=(amount:number)=>Math.round(cents(amount)*0.9);
export const validAmount=(amount:number)=>Number.isFinite(amount)&&amount>=0.5&&amount<=100000&&Math.abs(cents(amount)-amount*100)<0.000001;
export function validateOfferAddress(address:ShippingAddress) {
  if (![address.fullName,address.line1,address.city,address.state,address.postalCode].every(value=>typeof value==="string"&&value.trim().length>0&&value.length<=200) || !["US","CA"].includes(address.country)) throw new Error("Enter a complete US or Canadian shipping address.");
}
export async function commerceLock<T>(key:string,run:()=>Promise<T>) {
  const token=randomUUID();
  const result=await requirePool().query(`INSERT INTO commerce_locks(key,token,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')
    ON CONFLICT(key) DO UPDATE SET token=$2,expires_at=NOW()+INTERVAL '5 minutes' WHERE commerce_locks.expires_at<NOW() RETURNING key`,[key,token]);
  if (!result.rowCount) throw new Error("This payment is being processed. Please check again shortly.");
  try {return await run();} finally {await requirePool().query("DELETE FROM commerce_locks WHERE key=$1 AND token=$2",[key,token]);}
}
export async function reservePaymentListings(client:PoolClient,ids:string[],paymentId:string) {
  const result=await client.query("SELECT id,status FROM listings WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",[ids]);
  if (result.rows.length!==new Set(ids).size || result.rows.some(row=>row.status!=="active")) throw new Error("An item is no longer available or is being purchased.");
  // Pre-rollout Checkout sessions can still be paid. Do not race them.
  const pending=await client.query("SELECT 1 FROM orders WHERE listing_id=ANY($1::text[]) AND status='pending_payment' LIMIT 1",[ids]);
  if (pending.rows.length) throw new Error("An item has an existing checkout in progress. Please try again later.");
  for (const id of [...ids].sort()) await client.query("INSERT INTO listing_payment_claims(listing_id,payment_id) VALUES($1,$2)",[id,paymentId]);
  await client.query("UPDATE listings SET status='reserved' WHERE id=ANY($1::text[])",[ids]);
}
export async function createCommerceOrder(client:PoolClient,listing:Listing,buyer:User,address:ShippingAddress,price:number,shipping:number) {
  return createOrder({buyerId:buyer.id,buyerName:buyer.name,sellerId:listing.sellerId,sellerName:listing.sellerDisplayName,
    listingId:listing.id,listingTitle:listing.title,amount:(cents(price)+cents(shipping))/100,subtotal:price,shippingAmount:shipping,
    paymentMethod:"stripe_checkout",status:"pending_payment",listingStatus:"reserved",returnsAccepted:listing.returnsAccepted,
    returnPolicy:listing.returnPolicy,stripeCheckoutSessionId:null,stripePaymentIntentId:null,shippingAddress:address,
    shippingMethod:listing.shippingMethod,carrier:null,trackingNumber:null,issueReason:null,sellerNotes:null,shippedAt:null,deliveredAt:null},client);
}
