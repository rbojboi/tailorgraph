import assert from "node:assert/strict";
import {test,before,beforeEach,after,mock} from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {createHmac} from "node:crypto";
import {NOTIFICATION_SCHEMA} from "../lib/notification-schema.ts";
import {COMMERCE_SCHEMA} from "../lib/commerce-schema.ts";
import {EMAIL_OUTBOX_SCHEMA} from "../lib/email-outbox-schema.ts";
import {nextDigestDate} from "../lib/notification-preferences.ts";
import {unsubscribeToken,readUnsubscribeToken} from "../lib/email-unsubscribe.ts";
const db=new PGlite();
const query=async(sql,args=[])=>{
  if (sql.includes("pg_try_advisory_xact_lock")) return {rows:[{locked:true}]};
  const result=args.length?await db.query(sql,args):(await db.exec(sql)).at(-1);
  return {rows:result?.rows??[],rowCount:result?.affectedRows??0};
};
const pool={query,connect:async()=>({query,release(){}})};
const listing={id:"listing",sellerId:"seller",status:"active",title:"Wool trousers",price:100,category:"trousers",brand:"Other",sizeLabel:"34",material:"wool",pattern:"solid",primaryColor:"gray",secondaryColor:"none",createdAt:new Date().toISOString(),photos:[],description:"Wool trousers",condition:"excellent",trouserMeasurements:{waist:17,inseam:31},shippingPrice:10};
const user=async(id)=>{const row=(await query("SELECT * FROM users WHERE id=$1",[id])).rows[0];return row?{...row,notificationPreferences:row.notification_preferences,buyerProfile:{}}:null;};
mock.module(new URL("../lib/store.ts",import.meta.url).href,{namedExports:{ensureSchema:async()=>{},requirePool:()=>pool,findUserById:user,findListingById:async(id)=>{const row=(await query("SELECT * FROM listings WHERE id=$1",[id])).rows[0];return row?{...listing,id:row.id,status:row.status,price:Number(row.price)}:null;}}});
const {enqueueEmail,drainEmailOutbox,shouldSkipEmail,EmailDeliveryError}=await import("../lib/email-outbox.ts");
const {flushEmailDigests}=await import("../lib/email-digests.ts");
const {respondToOffer,applyAcceptedOfferPrices,expireOffers}=await import("../lib/offers.ts");
const {trackEmail,applyEmailStatus,retryFailedEmail}=await import("../lib/email-monitor.ts");
const {queueShippingReminders,processNotificationEvents,savedSearchFilters}=await import("../lib/notification-events.ts");
const {POST:unsubscribe}=await import("../app/api/email/unsubscribe/route.ts");
before(async()=>{
 process.env.DATABASE_URL="postgres://test";process.env.SESSION_SECRET="test-signing-secret";
 await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,notification_preferences JSONB);
 CREATE TABLE listings(id TEXT PRIMARY KEY,seller_id TEXT,status TEXT,price DOUBLE PRECISION,processing_days INTEGER,allow_offers BOOLEAN DEFAULT TRUE);
 CREATE TABLE offers(id TEXT PRIMARY KEY,buyer_id TEXT,seller_id TEXT,listing_id TEXT,amount DOUBLE PRECISION,status TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE orders(id TEXT PRIMARY KEY,buyer_id TEXT,seller_id TEXT,listing_id TEXT,listing_title TEXT,status TEXT,shipped_at TIMESTAMPTZ,amount DOUBLE PRECISION DEFAULT 100);
 CREATE TABLE user_saved_listings(user_id TEXT,listing_id TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE user_saved_searches(id TEXT PRIMARY KEY,user_id TEXT,query_string TEXT,name TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE notification_deliveries(event_key TEXT PRIMARY KEY);`);
 await db.exec(EMAIL_OUTBOX_SCHEMA);await db.exec(NOTIFICATION_SCHEMA);await db.exec(COMMERCE_SCHEMA);
});
beforeEach(async()=>{
 await db.exec("TRUNCATE users,listings,offers,orders,user_saved_listings,user_saved_searches,notification_events,email_outbox,email_digest_items,email_delivery_log,email_suppressions,notification_deliveries CASCADE");
 const preferences={messagesEmail:true,savedItemEmail:true,savedSearchEmail:true,offerAndPriceDropEmail:true};
 for(const id of ["buyer","seller","outsider"]) await query("INSERT INTO users VALUES($1,$2,$3::jsonb)",[id,id+"@example.com",JSON.stringify(preferences)]);
 await db.exec("INSERT INTO listings VALUES('listing','seller','active',100,3,TRUE); TRUNCATE notification_events;");
});
after(async()=>{delete process.env.DATABASE_URL;delete process.env.SESSION_SECRET;await db.close();});
const email=(extra={})=>({eventKey:"event",eventType:"saved_item",recipientUserId:"buyer",preferenceKey:"savedItemEmail",to:"buyer@example.com",category:"alerts",subject:"Price drop",text:"A new price",html:"<p>A new price</p>",...extra});
const offer=async()=>query("INSERT INTO offers(id,buyer_id,seller_id,listing_id,amount,status,expires_at,last_actor_id) VALUES('offer','buyer','seller','listing',80,'active',NOW()+INTERVAL '7 days','buyer')");

test("digest dates use the next UTC daily or Monday boundary",()=>{
 assert.equal(nextDigestDate("daily",new Date("2026-10-02T09:00:00Z")).toISOString(),"2026-10-03T09:00:00.000Z");
 assert.equal(nextDigestDate("weekly",new Date("2026-10-02T08:00:00Z")).toISOString(),"2026-10-05T09:00:00.000Z");
 assert.equal(nextDigestDate("weekly",new Date("2026-10-05T09:00:00Z")).toISOString(),"2026-10-12T09:00:00.000Z");
});
test("offer replies enforce participants, turn, revision and accepted buyer pricing",async()=>{
 await offer();
 await assert.rejects(respondToOffer("outsider","offer",0,"accept"),/not found/);
 await assert.rejects(respondToOffer("buyer","offer",0,"accept"),/other person/);
 await assert.rejects(respondToOffer("seller","offer",0,"counter",NaN),/amount/);
 await respondToOffer("seller","offer",0,"counter",85.99);
 await assert.rejects(respondToOffer("buyer","offer",0,"accept"),/changed/);
 await respondToOffer("buyer","offer",1,"accept");
 assert.equal((await applyAcceptedOfferPrices([listing],"buyer"))[0].price,85.99);
 assert.equal((await applyAcceptedOfferPrices([listing],"outsider"))[0].price,100);
 assert.equal((await query("SELECT count(*)::int AS n FROM notification_events")).rows[0].n,3);
 await query("UPDATE offers SET expires_at=NOW()-INTERVAL '1 second'");await expireOffers();
 assert.equal((await applyAcceptedOfferPrices([listing],"buyer"))[0].price,100);
 assert.equal((await query("SELECT status FROM offers")).rows[0].status,"expired");
});
test("sold listings cannot accept offers and declined offers cannot reopen",async()=>{
 await offer();await query("UPDATE listings SET status='sold'");
 await assert.rejects(respondToOffer("seller","offer",0,"accept"),/no longer available/);
 await query("UPDATE listings SET status='active'");await respondToOffer("seller","offer",0,"decline");
 await assert.rejects(respondToOffer("buyer","offer",1,"counter",70),/no longer available/);
});

test("automatic offer payment notices bypass optional opt-outs and suppress stale payment states",async()=>{
 await offer();await query("TRUNCATE notification_events");
 await query(`UPDATE users SET notification_preferences='{"offerAndPriceDropEmail":false}'::jsonb`);
 await query("UPDATE offers SET auto_charge=TRUE,status='accepted',payment_state='needs_payment',revision=revision+1");
 await processNotificationEvents();
 const rows=(await query("SELECT payload FROM email_outbox")).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(row=>!row.payload.preferenceKey));
 assert.deepEqual(rows.map(row=>row.payload.category).sort(),['buyer_orders','seller_orders']);
 assert.equal(await shouldSkipEmail(rows[0].payload),false);
 await query("INSERT INTO orders(id,amount) VALUES('paid-order',90)");
 await query("UPDATE offers SET payment_state='paid',paid_order_id='paid-order',revision=revision+1");
 assert.equal(await shouldSkipEmail(rows[0].payload),true);await processNotificationEvents();
 const paid=(await query("SELECT payload FROM email_outbox WHERE payload->>'offerPaymentState'='paid'")).rows;
 assert.equal(paid.length,2);assert.ok(paid.every(row=>row.payload.text.includes('$90.00')));
 assert.ok(paid.every(row=>!row.payload.text.includes('Payment is still required')));
});
test("daily digests batch once, erase item content, and retain stable content on retries",async()=>{
 await query(`UPDATE users SET notification_preferences=notification_preferences||'{"emailFrequency":{"savedItemEmail":"daily"}}'::jsonb WHERE id='buyer'`);
 await enqueueEmail(email());await enqueueEmail(email());await enqueueEmail(email({eventKey:"second"}));
 assert.equal((await query("SELECT count(*)::int AS n FROM email_outbox")).rows[0].n,0);
 await query("UPDATE email_digest_items SET available_at=NOW()-INTERVAL '1 second'");
 await flushEmailDigests();await flushEmailDigests();
 assert.equal((await query("SELECT count(*)::int AS n FROM email_outbox")).rows[0].n,1);
 assert.equal((await query("SELECT count(*)::int AS n FROM email_digest_items WHERE payload IS NOT NULL")).rows[0].n,0);
 let first;
 await drainEmailOutbox(async(input)=>{first=input;throw new EmailDeliveryError("retry",true);});
 await query("UPDATE email_outbox SET available_at=NOW()-INTERVAL '1 second'");
 await drainEmailOutbox(async(input)=>{assert.equal(input.html,first.html);assert.equal(input.eventKey,first.eventKey);assert.equal(input.digestItems.length,2);});
});
test("turning a category off suppresses an already queued digest",async()=>{
 await query(`UPDATE users SET notification_preferences=notification_preferences||'{"emailFrequency":{"savedItemEmail":"weekly"}}'::jsonb WHERE id='buyer'`);
 await enqueueEmail(email());await query("UPDATE email_digest_items SET available_at=NOW()-INTERVAL '1 second'");await flushEmailDigests();
 await query(`UPDATE users SET notification_preferences=notification_preferences||'{"savedItemEmail":false}'::jsonb WHERE id='buyer'`);
 assert.equal((await drainEmailOutbox(async()=>assert.fail("Opted out"))).skipped,1);
});
test("signed one-click unsubscribe affects only its optional category and binds the address",async()=>{
 const token=unsubscribeToken("buyer","buyer@example.com","savedItemEmail");assert.ok(readUnsubscribeToken(token));assert.equal(readUnsubscribeToken(token+"x"),null);
 const req=()=>new Request("https://example.com/api/email/unsubscribe?token="+encodeURIComponent(token),{method:"POST"});
 assert.equal((await unsubscribe(req())).status,200);
 assert.equal((await user("buyer")).notificationPreferences.savedItemEmail,false);
 assert.equal((await user("buyer")).notificationPreferences.messagesEmail,true);
 await query(`UPDATE users SET email='changed@example.com',notification_preferences='{"savedItemEmail":true}' WHERE id='buyer'`);
 await unsubscribe(req());assert.equal((await user("buyer")).notificationPreferences.savedItemEmail,true);
 assert.equal(readUnsubscribeToken(unsubscribeToken("buyer","buyer@example.com","security")),null);
});
test("bounces remain terminal, suppress recipients and block acknowledged retries",async()=>{
 await enqueueEmail(email());await trackEmail(email(),"sent","provider");await applyEmailStatus("provider","bounced");await applyEmailStatus("provider","delivered");
 assert.equal((await query("SELECT status FROM email_delivery_log")).rows[0].status,"bounced");
 assert.equal((await query("SELECT count(*)::int AS n FROM email_suppressions")).rows[0].n,1);
 await query("UPDATE email_outbox SET status='failed',first_attempt_at=NOW(),attempts=1");assert.equal(await retryFailedEmail("event"),false);
 await enqueueEmail(email({eventKey:"safe",to:"seller@example.com",recipientUserId:"seller"}));
 await query("UPDATE email_outbox SET status='failed',first_attempt_at=NOW(),attempts=1 WHERE event_key='safe'");assert.equal(await retryFailedEmail("safe"),true);
 await query("UPDATE email_outbox SET status='failed',first_attempt_at=NOW()-INTERVAL '24 hours' WHERE event_key='safe'");assert.equal(await retryFailedEmail("safe"),false);
});
test("price events notify pre-existing saves only, dedupe, and skip stale prices or removed saves",async()=>{
 await query("INSERT INTO user_saved_listings VALUES('buyer','listing',NOW()-INTERVAL '1 day')");await query("UPDATE listings SET price=90");
 await query("INSERT INTO user_saved_listings VALUES('outsider','listing',NOW()+INTERVAL '1 minute')");
 await processNotificationEvents();await processNotificationEvents();
 const rows=(await query("SELECT payload FROM email_outbox")).rows;assert.equal(rows.length,1);assert.equal(rows[0].payload.recipientUserId,"buyer");
 assert.equal(await shouldSkipEmail(rows[0].payload),false);await query("UPDATE listings SET price=110");assert.equal(await shouldSkipEmail(rows[0].payload),true);
 await query("UPDATE listings SET price=80");await query("DELETE FROM user_saved_listings WHERE user_id='buyer'");assert.equal(await shouldSkipEmail(rows[0].payload),true);
});
test("saved searches preserve repeated filters and only notify matching new listings",async()=>{
 assert.deepEqual(savedSearchFilters("?category=trousers&category=suit&q=wool"),{category:["trousers","suit"],q:"wool"});
 await query("INSERT INTO user_saved_searches VALUES('match','buyer','q=wool&fitMode=browse','Wool',NOW()-INTERVAL '1 day'),('miss','outsider','q=unicorn&fitMode=browse','Other',NOW()-INTERVAL '1 day')");
 await query("INSERT INTO listings VALUES('new','seller','active',100,3,TRUE)");await processNotificationEvents();
 const rows=(await query("SELECT payload FROM email_outbox")).rows;assert.equal(rows.length,1);assert.equal(rows[0].payload.savedSearchId,"match");
});
test("shipping clocks start at payment, avoid weekends, and stop after shipment",async()=>{
 await query("INSERT INTO orders(id,buyer_id,seller_id,listing_id,listing_title,status) VALUES('order','buyer','seller','listing','Wool trousers','pending_payment')");
 assert.equal((await query("SELECT ship_by_at FROM orders")).rows[0].ship_by_at,null);
 await query("UPDATE orders SET status='processing'");
 const order=(await query("SELECT * FROM orders")).rows[0];assert.ok(order.paid_at);assert.ok(new Date(order.ship_by_at)>new Date(order.paid_at));assert.ok(![0,6].includes(new Date(order.ship_by_at).getUTCDay()));
 await query("UPDATE orders SET ship_by_at=NOW()-INTERVAL '1 hour'");await queueShippingReminders();await queueShippingReminders();
 assert.equal((await query("SELECT count(*)::int AS n FROM email_outbox")).rows[0].n,2);
 await query("UPDATE orders SET status='shipped',shipped_at=NOW()");assert.equal((await drainEmailOutbox(async()=>assert.fail("Already shipped"))).skipped,2);
});

test("webhooks reject forged signatures and accept authenticated bounce events",async()=>{
 const {POST}=await import("../app/api/resend/webhook/route.ts");
 const secret=Buffer.from("test-webhook-secret-32-bytes-long!").toString("base64");
 process.env.RESEND_WEBHOOK_SECRET="whsec_"+secret;
 await trackEmail(email(),"sent","provider");
 const body=JSON.stringify({type:"email.bounced",created_at:new Date().toISOString(),data:{email_id:"provider"}});
 const timestamp=String(Math.floor(Date.now()/1000));const id="test-webhook-id";
 const signature=createHmac("sha256",Buffer.from(secret,"base64")).update(`${id}.${timestamp}.${body}`).digest("base64");
 const request=(sig)=>new Request("https://example.com/api/resend/webhook",{method:"POST",body,headers:{"svix-id":id,"svix-timestamp":timestamp,"svix-signature":"v1,"+sig}});
 try {
   assert.equal((await POST(request("forged"))).status,400);
   assert.equal((await query("SELECT status FROM email_delivery_log")).rows[0].status,"sent");
   assert.equal((await POST(request(signature))).status,200);
   assert.equal((await query("SELECT status FROM email_delivery_log")).rows[0].status,"bounced");
 } finally {delete process.env.RESEND_WEBHOOK_SECRET;}
});

test("production migration advances 36 to 37 once and preserves existing data",async()=>{
 await db.exec("CREATE TABLE IF NOT EXISTS tailorgraph_schema_migrations(version INTEGER PRIMARY KEY);INSERT INTO tailorgraph_schema_migrations VALUES(36) ON CONFLICT DO NOTHING");
 mock.module("pg",{namedExports:{Pool:class{async connect(){return {query:async(sql,args=[])=>sql.includes("pg_advisory_xact_lock")?{rows:[]}:query(sql,args),release(){}};}async end(){}}}});
 process.env.VERCEL_ENV="production";
 try {
   await import("../scripts/migrate-notifications.ts?first");await import("../scripts/migrate-notifications.ts?second");
   assert.equal((await query("SELECT MAX(version) AS version FROM tailorgraph_schema_migrations")).rows[0].version,37);
   assert.equal((await query("SELECT count(*)::int AS n FROM listings")).rows[0].n,1);
 }finally{delete process.env.VERCEL_ENV;}
});
