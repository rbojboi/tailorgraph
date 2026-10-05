import assert from "node:assert/strict";
import { test, before, after, beforeEach, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";

const engine = new PGlite();
let failEnqueue = false;
let failReturnEnqueue = false;
let labelGate = null;
const labelInputs = [];
const sentEmails = [];
mock.module("resend", {namedExports:{Resend:class {
 emails={send:async(message,options)=>{sentEmails.push({message,options});return {data:{id:"mail_"+sentEmails.length},error:null};}};
}}});
class Pool {
  on() {}
  async end() {}
  async connect() { return { query: this.query.bind(this), release() {} }; }
  async query(sql, params = []) {
    if (failEnqueue && /INSERT INTO email_outbox/i.test(sql)) throw new Error("Audit injected queue failure");
    if (failReturnEnqueue && /INSERT INTO return_notification_outbox/i.test(sql)) throw new Error("Audit injected return event failure");
    const result = params.length ? await engine.query(sql, params) : (await engine.exec(sql)).at(-1);
    return { rows: result?.rows || [], rowCount: result?.rows?.length || result?.affectedRows || 0 };
  }
}
mock.module("pg", { namedExports: { Pool } });
const refunds = [], reversals = [], sessions = new Map();
let refundCalls = 0, reversalCalls = 0, labelCalls = 0, reversalFails = false, labelFails = false;
let currentScans = [], pendingRefund = false;
const stripe = {
  accounts: {retrieve:async()=>({charges_enabled:true,payouts_enabled:true,details_submitted:true})},
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
mock.module(new URL("../lib/stripe.ts",import.meta.url).href,{ namedExports:{getStripe:()=>stripe,getAppUrl:()=>"https://example.com",isStripeConfigured:()=>true} });
mock.module(new URL("../lib/shippo.ts",import.meta.url).href,{ namedExports:{
  createShippoShipmentQuote:async()=>({shipmentId:'ship-out',rates:[{rateId:'rate-out',provider:'USPS',amount:8,currency:'USD'}]}),
  recoverShippoOutboundLabel:async()=>({carrier:'USPS',trackingNumber:'OUTBOUND',shippingProviderTransactionId:'tx_out',shippingLabelUrl:'https://example.com/label.pdf'}),
  getShippoReturnTracking:async(_carrier,number)=>({tracking_number:number,tracking_history:currentScans,tracking_status:currentScans.at(-1)}),
  purchaseShippoLabel:async()=>{throw Error("Unexpected automatic rate");},
  purchaseShippoLabelForRate:async(input)=>{labelCalls++;labelInputs.push(input);if(labelGate) await labelGate;if(labelFails)throw Error("Timeout after sending purchase");return {carrier:"USPS",trackingNumber:"TRACK_RETURN",shippingProviderTransactionId:"tx_return",shippingLabelUrl:"https://example.com/label.pdf"};},
  recoverShippoReturnLabel:async()=>({carrier:"USPS",trackingNumber:"TRACK_RETURN",shippingProviderTransactionId:"tx_return",shippingLabelUrl:"https://example.com/label.pdf"})
} });
mock.module("next/cache",{namedExports:{revalidatePath:()=>{}}});
mock.module("next/navigation",{namedExports:{redirect:url=>{throw new Error("REDIRECT:"+url);}}});
mock.module("../lib/auth.ts",{namedExports:{
 getCurrentUser:async()=>store.findUserById("seller"),
 clearSession:async()=>{},createSession:async()=>{},hashPassword:async()=>"",verifyPassword:async()=>true
}});
process.env.SHIPPO_WEBHOOK_SECRET="audit-only-webhook-secret";
delete process.env.RESEND_API_KEY;
delete process.env.TWILIO_ACCOUNT_SID;
process.env.STRIPE_WEBHOOK_SECRET="whsec_audit_only";
stripe.webhooks=new Stripe("sk_test_audit_not_real").webhooks;
process.env.DATABASE_URL="postgres://test";
process.env.VERCEL="1";
const store=await import("../lib/store.ts");
const returns=await import("../lib/returns.ts");
const pool=store.requirePool();
const actions=await import("../app/actions.ts");
const shippoWebhook=await import("../app/api/shippo/webhook/route.ts");
const stripeWebhook=await import("../app/api/stripe/webhook/route.ts");
const commerce=await import("../lib/commerce-payments.ts");
const notifications=await import("../lib/notifications.ts");
const events=await import("../lib/notification-events.ts");
const returnMail=await import("../lib/return-notifications.ts");
const {createShippoSignature}=await import("../lib/shippo-webhook-auth.ts");

before(async()=>{ await store.runSchemaMigrationsForDeployment(); await store.runSchemaMigrationsForDeployment(); });
after(async()=>{await engine.close();});
beforeEach(async()=>{
  sentEmails.length=0;delete process.env.RESEND_API_KEY;
  failEnqueue=false;labelGate=null;labelInputs.length=0;
  failReturnEnqueue=false;
  refunds.length=0;reversals.length=0;sessions.clear();refundCalls=0;reversalCalls=0;labelCalls=0;reversalFails=false;labelFails=false;pendingRefund=false;currentScans=[];
  await pool.query("TRUNCATE users CASCADE; TRUNCATE return_workflow_locks,notification_events,email_outbox,email_delivery_log,notification_deliveries;");
  // Populate via the real schema while keeping provider calls mocked.
  await pool.query(`INSERT INTO users(id,name,email,password_hash,role) VALUES('buyer','Buyer','buyer@example.com','hash','buyer'),('seller','Seller','seller@example.com','hash','seller');`);
  await pool.query(`INSERT INTO listings(id,seller_id,seller_display_name,title,brand,category,size_label,chest,shoulder,waist,sleeve,inseam,outseam,material,pattern,primary_color,lapel,condition,vintage,returns_accepted,return_policy,allow_offers,price,shipping_price,location,distance_miles,description,status)
    VALUES('listing_a','seller','Seller','Suit','Brand','two_piece_suit','M',40,18,32,24,30,40,'wool','solid','navy','notch','good','modern',TRUE,'automatic_returns',TRUE,100,10,'NY',0,'Suit','sold'),
    ('listing_b','seller','Seller','Jacket','Brand','jacket','M',40,18,32,24,30,40,'wool','solid','navy','notch','good','modern',TRUE,'automatic_returns',TRUE,50,20,'NY',0,'Jacket','sold');`);
  await pool.query(`INSERT INTO orders(id,buyer_id,buyer_name,seller_id,seller_name,listing_id,listing_title,amount,subtotal,shipping_amount,payment_method,status,return_policy,stripe_checkout_session_id,stripe_payment_intent_id,delivered_at)
    VALUES('order_a','buyer','Buyer','seller','Seller','listing_a','Suit',110,100,10,'stripe_checkout','delivered','automatic_returns','cs_original','pi_original',NOW()-INTERVAL '1 day'),
    ('order_b','buyer','Buyer','seller','Seller','listing_b','Jacket',70,50,20,'stripe_checkout','delivered','automatic_returns','cs_original','pi_original',NOW()-INTERVAL '1 day');`);
  await pool.query(`INSERT INTO outbound_quotes(shipment_id,order_id,rates) VALUES('ship-out','order_a',$1)`,[JSON.stringify([{rateId:'rate-out',provider:'USPS',amount:8,currency:'USD'}])]);
  await pool.query('TRUNCATE payment_refund_reviews');
});
async function prepare(orderId="order_a") {
  await returns.requestReturn(orderId,"buyer");
  await pool.query("UPDATE order_returns SET approved_at=NOW()-INTERVAL '1 hour' WHERE order_id=$1",[orderId]);
  await pool.query("UPDATE orders SET return_carrier='usps',return_tracking_number='TRACK_RETURN',return_provider_transaction_id='tx_return' WHERE id=$1",[orderId]);
}
function scan(status) {currentScans=[...currentScans,{status,status_date:new Date(Date.now()-1000).toISOString()}];}


function shipForm(overrides={}) {
 const form=new FormData();
 for(const [key,value] of Object.entries({orderId:"order_a",shipmentId:"ship-out",rateId:"rate-out",provider:"USPS",rateAmount:"8",currency:"USD",carrier:"USPS",trackingNumber:"OUTBOUND",...overrides}))form.set(key,value);
 return form;
}
async function webhook(data) {
 const body=JSON.stringify({event:"track_updated",data});
 const timestamp=String(Math.floor(Date.now()/1000));
 return shippoWebhook.POST(new Request("https://tailorgraph.test/api/shippo/webhook",{
 method:"POST",body,headers:{"shippo-signature":`t=${timestamp},v1=${createShippoSignature(body,timestamp,process.env.SHIPPO_WEBHOOK_SECRET)}`}
 }));
}
test("audit: outbound track_updated delivery should update the order and start the return window",async()=>{
 await pool.query("UPDATE orders SET status='shipped',delivered_at=NULL,carrier='USPS',tracking_number='OUTBOUND',shipping_provider_transaction_id='tx_out' WHERE id='order_a'");
 const response=await webhook({object_id:"track_object_not_transaction",carrier:"usps",tracking_number:"OUTBOUND",tracking_status:{status:"DELIVERED",status_date:new Date().toISOString()}});
 assert.equal(response.status,200);
 const order=await store.findOrderById("order_a");
 assert.equal(order.status,"delivered","Verified outbound tracking delivery was silently ignored");
 assert.ok(order.deliveredAt);
});
test("audit: replaying a closed return must not remove stock belonging to a later sale",async()=>{
 await prepare();scan("TRANSIT");scan("DELIVERED");await returns.processReturn("order_a");
 await returns.acceptReturnedItem("order_a","seller");
 await pool.query("UPDATE listings SET status='sold' WHERE id='listing_a'");
 await pool.query(`INSERT INTO orders(id,buyer_id,buyer_name,seller_id,seller_name,listing_id,listing_title,amount,subtotal,shipping_amount,payment_method,status,return_policy,stripe_payment_intent_id)
 VALUES('new_order','buyer','Buyer','seller','Seller','listing_a','Suit',110,100,10,'stripe_checkout','processing','automatic_returns','pi_new')`);
 await returns.processReturn("order_a");
 assert.equal((await store.findListingById("listing_a")).status,"sold","Old closed return changed the later sale's inventory");
});
test("audit: concurrent outbound label requests must purchase only one label",async()=>{
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 let release;labelGate=new Promise(resolve=>{release=resolve;});
 const a=actions.buySelectedShippoRateAction(shipForm()).catch(error=>error);
 const b=actions.buySelectedShippoRateAction(shipForm()).catch(error=>error);
 for(let i=0;i<100 && labelCalls<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
 release();await Promise.all([a,b]);
 assert.equal(labelCalls,1,"Both requests purchased a paid label before either saved the order");
});
test("audit: lost outbound label response must not trigger a second purchase on retry",async()=>{
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 labelFails=true;
 await assert.rejects(actions.buySelectedShippoRateAction(shipForm()),/Timeout/);
 assert.equal((await store.findOrderById("order_a")).status,"processing");
 labelFails=false;await assert.rejects(actions.buySelectedShippoRateAction(shipForm()),/REDIRECT/);
 assert.equal(labelCalls,1,"Retry bought a second label after the provider's first result was uncertain");
});
test("audit: shipment email must remain recoverable after queue insertion fails",async()=>{
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 failEnqueue=true;await assert.rejects(actions.shipOrderAction(shipForm()),/queue failure/);
 failEnqueue=false;
 await assert.rejects(actions.shipOrderAction(shipForm()),/REDIRECT/);
 await events.processNotificationEvents();
 assert.ok((await pool.query("SELECT * FROM email_outbox WHERE event_key LIKE '%order_a%'")).rows.length>0,"Shipment persisted but retry is blocked and no durable email event exists");
});
test("audit: manual shipping happy path updates the order and queues a buyer notice once",async()=>{
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 await assert.rejects(actions.shipOrderAction(shipForm()),/saved=shipment/);
 assert.equal((await store.findOrderById("order_a")).status,"shipped");
 const emails=await pool.query("SELECT * FROM email_outbox WHERE event_key LIKE '%order_a%'");
 assert.equal(emails.rows.length,1);assert.match(emails.rows[0].payload.subject,/shipment update/i);
 await assert.rejects(actions.shipOrderAction(shipForm()),/Payment/);
 assert.equal((await pool.query("SELECT * FROM email_outbox WHERE event_key LIKE '%order_a%'")).rows.length,1);
});
test("audit: paid cancellation is explicitly blocked and neither money nor stock changes",async()=>{
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 await assert.rejects(actions.resolveIssueAction(shipForm({resolution:"cancel"})),/Contact\+support/);
 assert.equal((await store.findOrderById("order_a")).status,"processing");assert.equal(refundCalls,0);
 assert.equal((await store.findListingById("listing_a")).status,"sold");
});
test("audit: return notifications queue buyer and seller once for approval and confirmed refund",async()=>{
 process.env.RESEND_API_KEY="re_audit_mock";process.env.EMAIL_FROM="TailorGraph <noreply@mail.tailorgraph.com>";
 await prepare();await returnMail.deliverReturnNotifications();await returnMail.deliverReturnNotifications();
 assert.equal(sentEmails.length,2);assert.ok(sentEmails.every(row=>/return is approved/i.test(row.message.text)));
 scan("TRANSIT");await returns.processReturn("order_a");await returnMail.deliverReturnNotifications();await returnMail.deliverReturnNotifications();
 assert.equal(sentEmails.length,4);assert.ok(sentEmails.slice(2).every(row=>/100.00/.test(row.message.text)));
 assert.equal(refundCalls,1);assert.equal(reversalCalls,1);
});
test("audit: delayed delivered webhook must use carrier delivery time for the seven-day return window",async()=>{
 const carrierDate=new Date(Date.now()-9*86400000).toISOString();
 await pool.query("UPDATE orders SET status='shipped',delivered_at=NULL,carrier='USPS',tracking_number='OUTBOUND',shipping_provider_transaction_id='tx_out' WHERE id='order_a'");
 const data={transaction:"tx_out",carrier:"usps",tracking_number:"OUTBOUND",tracking_status:{status:"DELIVERED",status_date:carrierDate}};
 assert.equal((await webhook(data)).status,200);
 assert.equal((await store.findOrderById("order_a")).status,"delivered");
 assert.equal(Math.floor(Date.parse((await store.findOrderById("order_a")).deliveredAt)/1000),Math.floor(Date.parse(carrierDate)/1000),"Delivery time was replaced with webhook processing time");
});
test("audit: normal cart purchase and repeated real-signed Stripe webhooks update orders, stock and emails once",async()=>{
 await pool.query("DELETE FROM outbound_quotes; DELETE FROM orders; UPDATE listings SET status='active'; UPDATE users SET stripe_account_id='acct_seller' WHERE id='seller'; TRUNCATE notification_events");
 const retrieve=stripe.paymentIntents.retrieve;
 const create=stripe.checkout.sessions.create;
 let receipt;
 stripe.paymentIntents.retrieve=async id=>id===receipt?.id?receipt:retrieve(id);
 stripe.checkout.sessions.create=async(input)=>{const s=await create(input);s.amount_total=input.line_items.reduce((n,l)=>n+l.quantity*l.price_data.unit_amount,0);return s;};
 try {
  const buyer=await store.findUserById("buyer");
  const items=await Promise.all(["listing_a","listing_b"].map(store.findListingById));
  await commerce.startMarketplaceCheckout(items,buyer,{fullName:"Buyer",line1:"1 Main St",line2:"",city:"Boston",state:"MA",postalCode:"02108",country:"US"});
  const session=[...sessions.values()][0];
  session.status="complete";session.payment_status="paid";session.payment_intent="pi_cart";
  receipt={...session.payment_intent_data,id:"pi_cart",amount:session.amount_total,amount_received:session.amount_total,currency:"usd",status:"succeeded"};
  const body=JSON.stringify({id:"evt_audit_repeat",type:"checkout.session.completed",data:{object:{id:session.id}}});
  const request=()=>new Request("https://tailorgraph.test/api/stripe/webhook",{method:"POST",body,headers:{"stripe-signature":stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET})}});
  assert.equal((await stripeWebhook.POST(request())).status,200);assert.equal((await stripeWebhook.POST(request())).status,200);
  assert.equal((await pool.query("SELECT * FROM orders WHERE status='processing'")).rows.length,2);
  assert.equal((await pool.query("SELECT * FROM listings WHERE status='sold'")).rows.length,2);
  assert.equal((await pool.query("SELECT * FROM notification_events WHERE kind='purchase_paid'")).rows.length,2);
  await events.processNotificationEvents();await events.processNotificationEvents();
  const mail=(await pool.query("SELECT * FROM email_outbox")).rows;
  assert.equal(mail.length,4);assert.equal(mail.filter(row=>row.payload.to==="buyer@example.com").length,2);
  assert.ok(mail.every(row=>/payment is complete/i.test(row.payload.text)));
 } finally {stripe.paymentIntents.retrieve=retrieve;stripe.checkout.sessions.create=create;}
});
test("audit: Stripe webhook rejects tampered signatures without changing inventory",async()=>{
 const response=await stripeWebhook.POST(new Request("https://tailorgraph.test/api/stripe/webhook",{method:"POST",body:"{}",headers:{"stripe-signature":"invalid"}}));
 assert.equal(response.status,400);assert.equal((await store.findListingById("listing_a")).status,"sold");
});
test("audit: forged shipping webhooks cannot update orders",async()=>{
 const response=await shippoWebhook.POST(new Request("https://tailorgraph.test/api/shippo/webhook",{method:"POST",body:"{}"}));
 assert.equal(response.status,401);
});
test("audit: return approval notice must recover if its outbox insertion fails",async()=>{
 failReturnEnqueue=true;
 await assert.rejects(returns.requestReturn("order_a","buyer"),/return event failure/);
 failReturnEnqueue=false;await returns.requestReturn("order_a","buyer");
 assert.equal((await store.findOrderById("order_a")).returnStatus,"approved");
 assert.equal((await pool.query("SELECT * FROM return_notification_outbox WHERE id='return:order_a:approved'")).rows.length,1,"Repeat request returned the saved approval without restoring its missing email event");
});
test("audit: full refund made directly in Stripe must stop fulfillment of a paid order",async()=>{
 refunds.push({id:'re_external',payment_intent:'pi_original',amount:18000,currency:'usd',status:'succeeded',metadata:{}});
 await pool.query("UPDATE orders SET status='processing',delivered_at=NULL WHERE id='order_a'");
 const body=JSON.stringify({id:"evt_external_refund",type:"charge.refunded",data:{object:{
 id:"ch_original",payment_intent:"pi_original",amount:18000,amount_refunded:18000,refunded:true,metadata:{}
 }}});
 const response=await stripeWebhook.POST(new Request("https://tailorgraph.test/api/stripe/webhook",{
 method:"POST",body,headers:{"stripe-signature":stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET})}
 }));
 assert.equal(response.status,200);
 assert.equal((await store.findOrderById("order_a")).status,"refunded","Manual Stripe refund left an order eligible to ship");
});
test("audit: a refund.failed webhook after initial success must flag the return for review",async()=>{
 await prepare();scan("TRANSIT");await returns.processReturn("order_a");
 assert.equal((await returns.getReturn("order_a")).refund_status,"succeeded");
 refunds[0].status="failed";
 const body=JSON.stringify({id:"evt_refund_failed_late",type:"refund.failed",data:{object:refunds[0]}});
 const response=await stripeWebhook.POST(new Request("https://tailorgraph.test/api/stripe/webhook",{
 method:"POST",body,headers:{"stripe-signature":stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET})}
 }));
 assert.equal(response.status,200);
 assert.equal((await returns.getReturn("order_a")).refund_status,"failed","A previously successful refund is never read back after its failure event");
 assert.equal(refundCalls,1,"Failure must not silently issue a second refund");
 assert.equal((await store.findOrderById('order_a')).status,'issue_open');
 assert.equal((await pool.query("SELECT * FROM return_notification_outbox WHERE kind='refund_failed'")).rows.length,1);
});

test('a label must use a server-stored quote belonging to this order',async()=>{
 await pool.query("UPDATE orders SET status='processing' WHERE id='order_a'");
 await assert.rejects(actions.buySelectedShippoRateAction(shipForm({rateId:'forged-rate'})),/Refresh/);
 await pool.query("UPDATE outbound_quotes SET order_id='order_b'");
 await assert.rejects(actions.buySelectedShippoRateAction(shipForm()),/Refresh/);
 assert.equal(labelCalls,0);
});

test('manual shipment cannot race a paid label purchase',async()=>{
 await pool.query("UPDATE orders SET status='processing' WHERE id='order_a'");
 let release;labelGate=new Promise(resolve=>{release=resolve;});
 const purchase=actions.buySelectedShippoRateAction(shipForm()).catch(e=>e);
 for(let i=0;i<100 && !labelCalls;i++)await new Promise(resolve=>setTimeout(resolve,5));
 try {await assert.rejects(actions.shipOrderAction(shipForm()),/being processed/);}
 finally {release();await purchase;}
 assert.equal(labelCalls,1);
 assert.equal((await store.findOrderById('order_a')).shippingProviderTransactionId,'tx_return');
 assert.equal((await pool.query("SELECT * FROM notification_events WHERE kind='order_shipped'")).rows.length,1);
});

test('recovering a lost label saves its existing transaction without a new purchase',async()=>{
 const labels=await import('../lib/outbound-labels.ts');
 await pool.query("UPDATE orders SET status='processing' WHERE id='order_a'");
 labelFails=true;await assert.rejects(actions.buySelectedShippoRateAction(shipForm()),/Timeout/);
 await labels.recoverOutboundLabel('order_a','tx_out');
 assert.equal(labelCalls,1);assert.equal((await store.findOrderById('order_a')).status,'shipped');
 assert.equal((await pool.query("SELECT state FROM outbound_labels WHERE order_id='order_a'")).rows[0].state,'complete');
});

test('a refund during label creation cannot be overwritten by shipment completion',async()=>{
 await pool.query("UPDATE orders SET status='processing' WHERE id='order_a'");
 let release;labelGate=new Promise(resolve=>{release=resolve;});
 const purchase=actions.buySelectedShippoRateAction(shipForm()).catch(e=>e);
 for(let i=0;i<100 && !labelCalls;i++)await new Promise(resolve=>setTimeout(resolve,5));
 await pool.query("UPDATE orders SET status='refunded' WHERE id='order_a'");
 release();await purchase;
 assert.equal((await store.findOrderById('order_a')).status,'refunded');
 assert.ok((await pool.query("SELECT label FROM outbound_labels WHERE order_id='order_a'")).rows[0].label);
 assert.equal((await pool.query("SELECT * FROM notification_events WHERE kind='order_shipped'")).rows.length,0);
});

test('a database failure creating a return event rolls back approval and order changes',async()=>{
 await pool.query(`CREATE FUNCTION fail_return_event() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test event storage unavailable'; END; $$ LANGUAGE plpgsql;
 CREATE TRIGGER fail_return_event BEFORE INSERT ON return_notification_outbox FOR EACH ROW EXECUTE FUNCTION fail_return_event();`);
 try {
  await assert.rejects(returns.requestReturn('order_a','buyer'),/test event storage unavailable/);
  assert.equal(await returns.getReturn('order_a'),null);
  assert.equal((await store.findOrderById('order_a')).status,'delivered');
 } finally {await pool.query('DROP TRIGGER fail_return_event ON return_notification_outbox; DROP FUNCTION fail_return_event();');}
 await returns.requestReturn('order_a','buyer');
 assert.equal((await pool.query("SELECT * FROM return_notification_outbox WHERE kind='approved'")).rows.length,1);
});

test('duplicate and stale external refund events use current Stripe state and notify once',async()=>{
 const reconciliation=await import('../lib/refund-reconciliation.ts');
 refunds.push({id:'re_external',payment_intent:'pi_original',amount:5000,currency:'usd',status:'succeeded',metadata:{}});
 await reconciliation.reconcilePaymentRefund('pi_original');await reconciliation.reconcilePaymentRefund('pi_original');
 assert.equal((await store.findOrderById('order_a')).status,'issue_open');
 assert.equal((await store.findListingById('listing_a')).status,'sold');
 assert.equal((await pool.query("SELECT * FROM notification_events WHERE kind='payment_refund'")).rows.length,1);
 refunds[0].amount=18000;
 await reconciliation.reconcilePaymentRefund('pi_original');await reconciliation.reconcilePaymentRefund('pi_original');
 assert.equal((await store.findOrderById('order_a')).status,'refunded');
 assert.equal((await pool.query("SELECT * FROM notification_events WHERE kind='payment_refund'")).rows.length,2);
 assert.equal(refundCalls,0);assert.equal(reversalCalls,0);
});

test('tracking rejects ambiguous matches and never extends a known delivery date',async()=>{
 await pool.query("UPDATE orders SET status='shipped',delivered_at=NULL,carrier='USPS',tracking_number='SAME'");
 await webhook({carrier:'usps',tracking_number:'SAME',tracking_status:{status:'DELIVERED',status_date:new Date().toISOString()}});
 assert.equal((await store.findOrderById('order_a')).status,'shipped');
 await pool.query("UPDATE orders SET tracking_number='OTHER' WHERE id='order_b'");
 const old=new Date(Date.now()-10*86400000).toISOString();
 await webhook({carrier:'usps',tracking_number:'SAME',tracking_status:{status:'DELIVERED',status_date:old}});
 const original=(await store.findOrderById('order_a')).deliveredAt;
 await webhook({carrier:'usps',tracking_number:'SAME',tracking_status:{status:'DELIVERED',status_date:new Date().toISOString()}});
 assert.equal((await store.findOrderById('order_a')).deliveredAt,original);
 await webhook({carrier:'usps',tracking_number:'SAME',tracking_status:{status:'TRANSIT',status_date:new Date().toISOString()}});
 assert.equal((await store.findOrderById('order_a')).trackingStatus,'DELIVERED');
 await assert.rejects(returns.requestReturn('order_a','buyer'),/7.day|seven|window/i);
});

test('transaction production migration is idempotent and rejects missing prerequisites',async()=>{
 process.env.VERCEL_ENV='production';
 await pool.query('INSERT INTO tailorgraph_schema_migrations(version) VALUES(38) ON CONFLICT DO NOTHING');
 await pool.query('DELETE FROM tailorgraph_schema_migrations WHERE version=39');
 try {
  await import('../scripts/migrate-transactions.ts?first');await import('../scripts/migrate-transactions.ts?second');
  assert.equal((await pool.query('SELECT MAX(version) AS version FROM tailorgraph_schema_migrations')).rows[0].version,39);
  await pool.query('DELETE FROM tailorgraph_schema_migrations WHERE version>=38');
  await assert.rejects(import('../scripts/migrate-transactions.ts?missing'),/schema 38/);
 } finally {delete process.env.VERCEL_ENV;await pool.query('INSERT INTO tailorgraph_schema_migrations(version) VALUES(38),(39) ON CONFLICT DO NOTHING');}
});

test('a refund arriving before checkout completion holds the reservation and suppresses purchase mail',async()=>{
 const reconciliation=await import('../lib/refund-reconciliation.ts');
 const retrieve=stripe.paymentIntents.retrieve;
 await pool.query("UPDATE orders SET status='pending_payment',stripe_payment_intent_id=NULL WHERE id='order_a'");
 await pool.query("UPDATE listings SET status='reserved' WHERE id='listing_a'");
 await pool.query(`INSERT INTO commerce_payments(id,kind,buyer_id,listing_ids,order_ids,state,provider_params,expires_at)
 VALUES('early','checkout','buyer',ARRAY['listing_a'],ARRAY['order_a'],'checkout','{"totalCents":11000}',NOW()+INTERVAL '1 day')`);
 stripe.paymentIntents.retrieve=async()=>({id:'pi_early',metadata:{paymentAttempt:'early'},currency:'usd',amount:11000,latest_charge:{id:'ch_early',amount:11000,amount_refunded:11000}});
 refunds.push({id:'re_early',payment_intent:'pi_early',amount:11000,status:'succeeded',metadata:{}});
 try {
  await reconciliation.reconcilePaymentRefund('pi_early');
  assert.equal((await store.findOrderById('order_a')).status,'refunded');
  assert.equal((await store.findListingById('listing_a')).status,'reserved');
  assert.equal((await pool.query("SELECT state FROM commerce_payments WHERE id='early'")).rows[0].state,'review');
  await pool.query(`INSERT INTO notification_events(kind,payload) VALUES('purchase_paid','{"orderId":"order_a"}')`);
  await events.processNotificationEvents();await events.processNotificationEvents();
  assert.equal((await pool.query("SELECT * FROM email_outbox WHERE event_key LIKE 'purchase:%'")).rows.length,0);
 } finally {stripe.paymentIntents.retrieve=retrieve;}
});

test('tracking ignores future delivery timestamps and mismatched transaction identities',async()=>{
 await pool.query("UPDATE orders SET status='shipped',delivered_at=NULL,carrier='USPS',tracking_number='OUT',shipping_provider_transaction_id='tx_out' WHERE id='order_a'");
 const mismatch=await webhook({transaction:'tx_out',tracking_number:'WRONG',tracking_status:{status:'DELIVERED',status_date:new Date().toISOString()}});
 assert.equal(mismatch.status,400);assert.equal((await store.findOrderById('order_a')).status,'shipped');
 await webhook({transaction:'tx_out',tracking_number:'OUT',tracking_status:{status:'DELIVERED',status_date:new Date(Date.now()+86400000).toISOString()}});
 assert.equal((await store.findOrderById('order_a')).deliveredAt,null);
});

test('a full refund awaiting provider completion holds fulfillment without claiming success',async()=>{
 const reconciliation=await import('../lib/refund-reconciliation.ts');
 const retrieve=stripe.paymentIntents.retrieve;
 stripe.paymentIntents.retrieve=async()=>({id:'pi_original',currency:'usd',latest_charge:{id:'ch_original',amount:18000,amount_refunded:18000}});
 refunds.push({id:'re_pending',payment_intent:'pi_original',amount:18000,status:'pending',metadata:{}});
 try {
  await reconciliation.reconcilePaymentRefund('pi_original');
  assert.equal((await store.findOrderById('order_a')).status,'issue_open');
  assert.equal((await pool.query("SELECT payload FROM notification_events WHERE kind='payment_refund'")).rows[0].payload.full,false);
 } finally {stripe.paymentIntents.retrieve=retrieve;}
});

