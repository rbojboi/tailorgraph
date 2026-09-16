import assert from "node:assert/strict";
import { test, before, after, beforeEach, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const engine = new PGlite();
class Pool {
  on() {}
  async query(sql, params = []) {
    const result = params.length ? await engine.query(sql, params) : (await engine.exec(sql)).at(-1);
    return { rows: result?.rows || [], rowCount: result?.affectedRows ?? result?.rows?.length ?? 0 };
  }
}
mock.module("pg", { namedExports: { Pool } });
const refunds = [], reversals = [], sessions = new Map();
let refundCalls = 0, reversalCalls = 0, labelCalls = 0, reversalFails = false, labelFails = false;
let currentScans = [], pendingRefund = false;
const stripe = {
  paymentIntents: { retrieve: async () => ({ id:"pi_original", status:"succeeded", currency:"usd", latest_charge:{ id:"ch_original",amount:18000,amount_refunded:refunds.filter(r=>r.status==="succeeded").reduce((s,r)=>s+r.amount,0),disputed:false, transfer:{id:"tr_original",amount:13500} } }) },
  refunds: {
    list: () => (async function*(){ yield* refunds; })(),
    retrieve: async id => refunds.find(r=>r.id===id),
    create: async input => { refundCalls++; const r={...input,id:`re_${refundCalls}`,status:pendingRefund?"pending":"succeeded"}; refunds.push(r); return r; }
  },
  transfers: {
    listReversals: () => (async function*(){ yield* reversals; })(),
    createReversal: async (_id,input) => { reversalCalls++; if(reversalFails) throw Error("Insufficient seller funds"); const r={...input,id:`trr_${reversalCalls}`}; reversals.push(r); return r; }
  },
  checkout: { sessions: {
    create: async input => { const s={...input,id:`cs_label_${sessions.size}`,url:"https://checkout.stripe.com/test",status:"open",payment_status:"unpaid",amount_total:input.line_items[0].price_data.unit_amount,currency:"usd",payment_intent:"pi_label"}; sessions.set(s.id,s); return s; },
    retrieve: async id => sessions.get(id)
  } }
};
mock.module(new URL("../lib/stripe.ts",import.meta.url).href,{ namedExports:{getStripe:()=>stripe,getAppUrl:()=>"https://example.com"} });
mock.module(new URL("../lib/shippo.ts",import.meta.url).href,{ namedExports:{
  getShippoReturnTracking:async(_carrier,number)=>({tracking_number:number,tracking_history:currentScans,tracking_status:currentScans.at(-1)}),
  purchaseShippoLabelForRate:async()=>{labelCalls++;if(labelFails)throw Error("Timeout after sending purchase");return {carrier:"USPS",trackingNumber:"TRACK_RETURN",shippingProviderTransactionId:"tx_return",shippingLabelUrl:"https://example.com/label.pdf"};},
  recoverShippoReturnLabel:async()=>({carrier:"USPS",trackingNumber:"TRACK_RETURN",shippingProviderTransactionId:"tx_return",shippingLabelUrl:"https://example.com/label.pdf"})
} });
process.env.DATABASE_URL="postgres://test";
process.env.VERCEL="1";
const store=await import("../lib/store.ts");
const returns=await import("../lib/returns.ts");
const pool=store.requirePool();

before(async()=>{ await store.runSchemaMigrationsForDeployment(); await store.runSchemaMigrationsForDeployment(); });
after(async()=>{await engine.close();});
beforeEach(async()=>{
  refunds.length=0;reversals.length=0;sessions.clear();refundCalls=0;reversalCalls=0;labelCalls=0;reversalFails=false;labelFails=false;pendingRefund=false;currentScans=[];
  await pool.query("TRUNCATE users CASCADE; TRUNCATE return_workflow_locks;");
  // Populate via the real schema while keeping provider calls mocked.
  await pool.query(`INSERT INTO users(id,name,email,password_hash,role) VALUES('buyer','Buyer','buyer@example.com','hash','buyer'),('seller','Seller','seller@example.com','hash','seller');`);
  await pool.query(`INSERT INTO listings(id,seller_id,seller_display_name,title,brand,category,size_label,chest,shoulder,waist,sleeve,inseam,outseam,material,pattern,primary_color,lapel,condition,vintage,returns_accepted,return_policy,allow_offers,price,shipping_price,location,distance_miles,description,status)
    VALUES('listing_a','seller','Seller','Suit','Brand','two_piece_suit','M',40,18,32,24,30,40,'wool','solid','navy','notch','good','modern',TRUE,'automatic_returns',TRUE,100,10,'NY',0,'Suit','sold'),
    ('listing_b','seller','Seller','Jacket','Brand','jacket','M',40,18,32,24,30,40,'wool','solid','navy','notch','good','modern',TRUE,'automatic_returns',TRUE,50,20,'NY',0,'Jacket','sold');`);
  await pool.query(`INSERT INTO orders(id,buyer_id,buyer_name,seller_id,seller_name,listing_id,listing_title,amount,subtotal,shipping_amount,payment_method,status,return_policy,stripe_checkout_session_id,stripe_payment_intent_id,delivered_at)
    VALUES('order_a','buyer','Buyer','seller','Seller','listing_a','Suit',110,100,10,'stripe_checkout','delivered','automatic_returns','cs_original','pi_original',NOW()-INTERVAL '1 day'),
    ('order_b','buyer','Buyer','seller','Seller','listing_b','Jacket',70,50,20,'stripe_checkout','delivered','automatic_returns','cs_original','pi_original',NOW()-INTERVAL '1 day');`);
});
async function prepare(orderId="order_a") {
  await returns.requestReturn(orderId,"buyer");
  await pool.query("UPDATE order_returns SET approved_at=NOW()-INTERVAL '1 hour' WHERE order_id=$1",[orderId]);
  await pool.query("UPDATE orders SET return_carrier='usps',return_tracking_number='TRACK_RETURN',return_provider_transaction_id='tx_return' WHERE id=$1",[orderId]);
}
function scan(status) {currentScans=[...currentScans,{status,status_date:new Date(Date.now()-1000).toISOString()}];}

test("request authorization, policy snapshot and repeat requests",async()=>{
  await assert.rejects(()=>returns.requestReturn("order_a","stranger"),/not found/);
  await pool.query("UPDATE orders SET return_policy='no_returns' WHERE id='order_a'");
  assert.equal((await store.findOrderById("order_a")).returnsAccepted,false);
  await assert.rejects(()=>returns.requestReturn("order_a","buyer"),/does not accept/);
  await pool.query("UPDATE orders SET return_policy='automatic_returns' WHERE id='order_a'");
  await pool.query("UPDATE listings SET returns_accepted=FALSE,return_policy='no_returns' WHERE id='listing_a'");
  assert.equal((await store.findOrderById("order_a")).returnsAccepted,true);
  const first=await returns.requestReturn("order_a","buyer");
  const second=await returns.requestReturn("order_a","buyer");
  assert.equal(first.ship_by.getTime(),second.ship_by.getTime());
});
test("refund only on carrier acceptance; retries never duplicate refund or seller reversal",async()=>{
  await prepare();scan("PRE_TRANSIT");await returns.processReturn("order_a");assert.equal(refundCalls,0);
  scan("TRANSIT");await returns.processReturn("order_a");await returns.processReturn("order_a");
  assert.equal(refundCalls,1);assert.equal(refunds[0].amount,10000);assert.equal(reversals[0].amount,9000);
  assert.equal((await store.findOrderById("order_a")).status,"refunded");
  assert.equal((await pool.query("SELECT status FROM listings WHERE id='listing_a'")).rows[0].status,"sold");
  assert.equal((await store.findOrderById("order_b")).status,"delivered");
});
test("multiple item returns reconcile to the original seller transfer",async()=>{
  await prepare("order_a");await prepare("order_b");scan("TRANSIT");
  await returns.processReturn("order_b");await returns.processReturn("order_a");
  assert.equal(refunds.reduce((s,r)=>s+r.amount,0),15000);
  assert.equal(reversals.reduce((s,r)=>s+r.amount,0),13500);
});
test("seller recovery failure preserves buyer refund and recovers without a second refund",async()=>{
  await prepare();scan("TRANSIT");reversalFails=true;
  await assert.rejects(()=>returns.processReturn("order_a"),/Insufficient/);
  assert.equal((await returns.getReturn("order_a")).recovery_status,"needs_attention");
  assert.equal((await store.findOrderById("order_a")).status,"refunded");
  reversalFails=false;await returns.processReturn("order_a");assert.equal(refundCalls,1);
});
test("pending refund does not mark the order refunded or reverse money prematurely",async()=>{
  await prepare();scan("TRANSIT");pendingRefund=true;await returns.processReturn("order_a");
  assert.equal(reversalCalls,0);assert.notEqual((await store.findOrderById("order_a")).status,"refunded");
  refunds[0].status="succeeded";await returns.processReturn("order_a");assert.equal(refundCalls,1);assert.equal(reversalCalls,1);
});
test("lost Stripe responses recover using provider metadata even after 24 hours",async()=>{
  await prepare();scan("TRANSIT");
  refunds.push({id:"re_lost",payment_intent:"pi_original",amount:10000,status:"succeeded",metadata:{tailorgraphReturn:"order_a"}});
  await pool.query("UPDATE order_returns SET refund_started_at=NOW()-INTERVAL '2 days' WHERE order_id='order_a'");
  await returns.processReturn("order_a");assert.equal(refundCalls,0);assert.equal(reversalCalls,1);
});
test("unconfirmed refund older than idempotency retention is not reissued",async()=>{
  await prepare();scan("TRANSIT");await pool.query("UPDATE order_returns SET refund_started_at=NOW()-INTERVAL '2 days' WHERE order_id='order_a'");
  await assert.rejects(()=>returns.processReturn("order_a"),/uncertain/);assert.equal(refundCalls,0);
});
test("seller disputes after return delivery retain the completed refund and block relisting",async()=>{
  await prepare();scan("TRANSIT");await returns.processReturn("order_a");
  await assert.rejects(()=>returns.disputeReturnedItem("order_a","seller","The wrong jacket was returned.","https://example.com/evidence"),/cannot be disputed/);
  scan("DELIVERED");await returns.processReturn("order_a");
  await returns.disputeReturnedItem("order_a","seller","The wrong jacket was returned.","https://example.com/evidence");
  await assert.rejects(()=>returns.acceptReturnedItem("order_a","seller"),/not ready/);
  await returns.processReturn("order_a");assert.equal(refundCalls,1);
  assert.equal((await store.findOrderById("order_a")).status,"refunded");
});
test("48-hour inspection expiry closes return and moves listing to draft",async()=>{
  await prepare();scan("TRANSIT");await returns.processReturn("order_a");
  await pool.query("UPDATE order_returns SET received_at=NOW()-INTERVAL '49 hours' WHERE order_id='order_a'");
  await returns.processReturn("order_a");assert.ok((await returns.getReturn("order_a")).closed_at);
  assert.equal((await pool.query("SELECT status FROM listings WHERE id='listing_a'")).rows[0].status,"draft");
});
test("verified stored rate and buyer payment are required for a label",async()=>{
  await returns.requestReturn("order_a","buyer");
  await returns.saveReturnQuote("order_a",{shipmentId:"ship",rates:[{rateId:"rate",provider:"usps",amount:8,currency:"USD"}]});
  await assert.rejects(()=>returns.startReturnLabelCheckout("order_a","buyer","ship","tampered"),/Refresh/);
  await returns.startReturnLabelCheckout("order_a","buyer","ship","rate");
  const s=[...sessions.values()][0];assert.equal(s.amount_total,800);
  await returns.fulfillReturnLabel(s);assert.equal(labelCalls,0);
  s.payment_status="paid";await returns.fulfillReturnLabel(s);await returns.fulfillReturnLabel(s);assert.equal(labelCalls,1);
});
test("an uncertain Shippo purchase is never repeated",async()=>{
  await returns.requestReturn("order_a","buyer");
  await returns.saveReturnQuote("order_a",{shipmentId:"ship",rates:[{rateId:"rate",provider:"usps",amount:8,currency:"USD"}]});
  await returns.startReturnLabelCheckout("order_a","buyer","ship","rate");
  const s=[...sessions.values()][0];s.payment_status="paid";labelFails=true;
  await assert.rejects(()=>returns.fulfillReturnLabel(s),/Timeout/);
  await returns.fulfillReturnLabel(s);assert.equal(labelCalls,1);
  assert.equal((await returns.getReturnLabelPayment("order_a")).status,"needs_attention");
});
test("late successful payment webhook cannot resurrect a refunded order or relist a sold item",async()=>{
  await prepare();scan("TRANSIT");await returns.processReturn("order_a");
  await store.markOrderPaidBySessionId("cs_original","pi_original");
  assert.equal((await store.findOrderById("order_a")).status,"refunded");
});

test("late outbound and return tracking cannot reopen a refunded, closed return",async()=>{
  await prepare();scan("TRANSIT");scan("DELIVERED");await returns.processReturn("order_a");
  await returns.acceptReturnedItem("order_a","seller");
  await store.updateOrderTrackingFromProvider("order_a",{carrier:"USPS",trackingNumber:"OUTBOUND",trackingUrl:null,trackingStatus:"DELIVERED",shippingEta:null});
  await store.updateOrderReturnTrackingFromProvider("order_a",{carrier:"USPS",trackingNumber:"TRACK_RETURN",trackingUrl:null,trackingStatus:"TRANSIT",returnEta:null});
  const order=await store.findOrderById("order_a");
  assert.equal(order.status,"refunded");assert.equal(order.returnStatus,"closed");
});

test("a live database lease prevents concurrent duplicate work",async()=>{
  await prepare();scan("TRANSIT");
  await pool.query("INSERT INTO return_workflow_locks(key,token,expires_at) VALUES('return:order_a','other-worker',NOW()+INTERVAL '1 minute')");
  await assert.rejects(()=>returns.processReturn("order_a"),/already being processed/);
  assert.equal(refundCalls,0);assert.equal(reversalCalls,0);
});

test("failed refunds remain visible and are never silently reissued",async()=>{
  await prepare();scan("TRANSIT");pendingRefund=true;await returns.processReturn("order_a");
  refunds[0].status="failed";await returns.processReturn("order_a");await returns.processReturn("order_a");
  assert.equal(refundCalls,1);assert.equal(reversalCalls,0);
  assert.equal((await returns.getReturn("order_a")).refund_status,"failed");
});
