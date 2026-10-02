import assert from 'node:assert/strict';
import {test,before,beforeEach,after,mock} from 'node:test';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {COMMERCE_SCHEMA} from '../lib/commerce-schema.ts';
import {offerEmailCopy} from '../lib/offer-email.ts';

const db=new PGlite();
const query=async(sql,args=[])=>{
  const result=args.length?await db.query(sql,args):(await db.exec(sql)).at(-1);
  return {rows:result?.rows??[],rowCount:result?.affectedRows??0};
};
const pool={query,connect:async()=>({query,release(){}})};
const address={fullName:'Buyer',line1:'1 Main Street',line2:'',city:'Boston',state:'MA',postalCode:'02108',country:'US'};
const users={buyer:{id:'buyer',name:'Buyer',email:'buyer@example.com',role:'buyer'},other:{id:'other',name:'Other',email:'other@example.com',role:'buyer'},seller:{id:'seller',name:'Seller',email:'seller@example.com',role:'seller',stripeAccountId:'acct_seller'}};
async function listing(id='listing') {
  const row=(await query('SELECT * FROM listings WHERE id=$1',[id])).rows[0];
  return row?{id:row.id,title:'Wool trousers',sellerId:row.seller_id,sellerDisplayName:'Seller',price:Number(row.price),shippingPrice:Number(row.shipping_price),status:row.status,allowOffers:row.allow_offers,returnsAccepted:false,returnPolicy:'no_returns',shippingMethod:'standard'}:null;
}
mock.module(new URL('../lib/store.ts',import.meta.url).href,{namedExports:{
  ensureSchema:async()=>{},requirePool:()=>pool,findListingById:listing,findUserById:async id=>users[id],
  createOrder:async(input,client)=>{
    const id=randomUUID();
    await client.query(`INSERT INTO orders(id,listing_id,buyer_id,seller_id,listing_title,status,amount,subtotal,shipping_amount)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,input.listingId,input.buyerId,input.sellerId,input.listingTitle,input.status,input.amount,input.subtotal,input.shippingAmount]);
    return {id,...input};
  }
}});
const intents=new Map(),sessions=new Map(),setups=new Map(),keys=new Map(),calls=[];
let outcome='succeeded',lostCreate=false,lostConfirm=false,failCancel=false;
const cached=(key,create)=>{if(!keys.has(key)) keys.set(key,create());return keys.get(key);};
const stripe={
  accounts:{retrieve:async()=>({charges_enabled:true,payouts_enabled:true,details_submitted:true})},
  customers:{create:async(params,opts)=>cached(opts.idempotencyKey,()=>({id:'cus_'+randomUUID(),...params}))},
  setupIntents:{retrieve:async id=>setups.get(id)},
  paymentIntents:{
    create:async(params,opts)=>{
      calls.push(['create',opts.idempotencyKey]);
      assert.equal(params.confirm,undefined,'Creation must never charge before persisting its ID');
      const intent=cached(opts.idempotencyKey,()=>{const value={...params,id:'pi_'+randomUUID(),status:'requires_confirmation',amount_received:0};intents.set(value.id,value);return value;});
      if(lostCreate){lostCreate=false;throw Error('Lost response');}return {...intent};
    },
    retrieve:async id=>{assert.ok(intents.has(id),'Unknown payment intent');return {...intents.get(id)};},
    confirm:async(id,params,opts)=>{
      assert.equal(params.off_session,true);
      assert.ok((await query('SELECT 1 FROM commerce_payments WHERE payment_intent_id=$1',[id])).rows.length,'Persist before charging');
      return cached(opts.idempotencyKey,()=>{
        calls.push(['confirm',id]);const intent=intents.get(id);intent.status=outcome;intent.amount_received=outcome==='succeeded'?intent.amount:0;
        if(lostConfirm){lostConfirm=false;throw Error('Lost confirmation response');}return {...intent};
      });
    },
    cancel:async id=>{calls.push(['cancel',id]);if(failCancel)throw Error('Cancellation unavailable');const intent=intents.get(id);assert.notEqual(intent.status,'succeeded');intent.status='canceled';return {...intent};}
  },
  checkout:{sessions:{
    create:async(params,opts)=>cached(opts.idempotencyKey,()=>{
      if(params.mode==='payment' && params.metadata.kind==='offer_recovery') assert.ok([...intents.values()].every(i=>i.status==='canceled'),'Cancel original before recovery checkout');
      calls.push(['checkout',params.mode]);
      const id='cs_'+randomUUID();const value={...params,id,url:'https://checkout.stripe.test/'+id,status:'open',payment_status:'unpaid',payment_intent:null,setup_intent:null,currency:'usd',amount_total:params.line_items?.reduce((sum,l)=>sum+l.price_data.unit_amount,0)};
      sessions.set(id,value);return {...value};
    }),
    retrieve:async id=>{assert.ok(sessions.has(id));return {...sessions.get(id)};},
    expire:async id=>{const value=sessions.get(id);value.status='expired';return {...value};}
  }}
};
mock.module(new URL('../lib/stripe.ts',import.meta.url).href,{namedExports:{getStripe:()=>stripe,getAppUrl:()=> 'https://tailorgraph.test',isStripeConfigured:()=>true}});
const auth=await import('../lib/offer-authorization.ts');
const pay=await import('../lib/commerce-payments.ts');
const offers=await import('../lib/offers.ts');
before(async()=>{
  process.env.DATABASE_URL='postgres://test';
  await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE listings(id TEXT PRIMARY KEY,seller_id TEXT,title TEXT,price DOUBLE PRECISION,shipping_price DOUBLE PRECISION,status TEXT,allow_offers BOOLEAN);
    CREATE TABLE offers(id TEXT PRIMARY KEY,buyer_id TEXT,seller_id TEXT,listing_id TEXT,amount DOUBLE PRECISION,status TEXT,message TEXT,revision INTEGER DEFAULT 0,last_actor_id TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),expires_at TIMESTAMPTZ DEFAULT NOW()+INTERVAL '7 days');
    CREATE TABLE orders(id TEXT PRIMARY KEY,listing_id TEXT,buyer_id TEXT,seller_id TEXT,listing_title TEXT,status TEXT,amount DOUBLE PRECISION,subtotal DOUBLE PRECISION,shipping_amount DOUBLE PRECISION,stripe_checkout_session_id TEXT,stripe_payment_intent_id TEXT);
    CREATE TABLE notification_events(id BIGSERIAL PRIMARY KEY,kind TEXT,payload JSONB,created_at TIMESTAMPTZ DEFAULT NOW(),completed_at TIMESTAMPTZ);`);
  await db.exec(COMMERCE_SCHEMA);await db.exec(COMMERCE_SCHEMA);
});
beforeEach(async()=>{
  await db.exec("TRUNCATE users,listings,offers,orders,offer_authorizations,commerce_payments,listing_payment_claims,commerce_locks,notification_events CASCADE;INSERT INTO users VALUES('buyer'),('other'),('seller');INSERT INTO listings VALUES('listing','seller','Wool trousers',100,10,'active',TRUE)");
  intents.clear();sessions.clear();setups.clear();keys.clear();calls.length=0;outcome='succeeded';lostCreate=false;lostConfirm=false;failCancel=false;
});
after(async()=>{delete process.env.DATABASE_URL;await db.close();});
const one=async(table)=>(await query('SELECT * FROM '+table)).rows[0];
async function authorize(buyer='buyer') {
  const id=await auth.createBindingOffer(buyer,'listing',80,'Offer');
  await auth.startOfferAuthorization(id,buyer,address,true);
  await completeSetup(id);
  return (await query('SELECT o.* FROM offers o JOIN offer_authorizations a ON a.offer_id=o.id WHERE a.id=$1',[id])).rows[0];
}
async function completeSetup(id) {
  const a=(await query('SELECT * FROM offer_authorizations WHERE id=$1',[id])).rows[0];
  const session=sessions.get(a.setup_session_id);session.status='complete';session.setup_intent='seti_'+id;
  setups.set(session.setup_intent,{id:session.setup_intent,status:'succeeded',customer:a.customer_id,payment_method:'pm_'+id,metadata:{authorizationId:id}});
  await auth.completeOfferAuthorization({...session});
}
async function settleCheckout(id) {
  const session=sessions.get(id),params=session.payment_intent_data;
  const intent={...params,id:'pi_checkout_'+id,customer:session.customer,amount:session.amount_total,amount_received:session.amount_total,currency:'usd',status:'succeeded'};
  intents.set(intent.id,intent);session.payment_intent=intent.id;session.status='complete';session.payment_status='paid';
  await pay.handleCommerceSession({...session});
}

test('offer stays private until exact-total consent and successful card setup; setup never charges',async()=>{
  const id=await auth.createBindingOffer('buyer','listing',80,'');
  assert.equal((await one('offers')).status,'draft');assert.equal((await query('SELECT * FROM notification_events')).rows.length,0);
  await assert.rejects(auth.startOfferAuthorization(id,'buyer',address,false),/authorize/);
  await assert.rejects(auth.startOfferAuthorization(id,'other',address,true),/expired/);
  await auth.startOfferAuthorization(id,'buyer',address,true);
  assert.match((await one('offer_authorizations')).consent_text,/\$90.00 USD/);
  await completeSetup(id);assert.equal((await one('offers')).status,'active');assert.equal(intents.size,0);
  assert.deepEqual(calls.map(c=>c[0]),['checkout']);
});
test('an abandoned draft expires privately without notifying the seller',async()=>{
  await auth.createBindingOffer('buyer','listing',80,'Private draft');
  await query("UPDATE offers SET expires_at=NOW()-INTERVAL '1 second'");await offers.expireOffers();
  assert.equal((await one('offers')).status,'expired');assert.equal((await query('SELECT * FROM notification_events')).rows.length,0);
});
test('seller acceptance charges once, freezes shipping, and records a paid order atomically',async()=>{
  const offer=await authorize();await query('UPDATE listings SET shipping_price=50');
  await pay.acceptBindingOffer('seller',offer.id,offer.revision);
  const p=await one('commerce_payments'),order=await one('orders'),intent=intents.get(p.payment_intent_id);
  assert.equal(intent.amount,9000);assert.equal(intent.transfer_data.amount,7200);assert.equal(intent.transfer_data.destination,'acct_seller');
  assert.equal(order.status,'processing');assert.equal(order.amount,90);assert.equal(order.shipping_amount,10);
  assert.equal(p.state,'paid');assert.equal((await one('listings')).status,'sold');assert.equal((await one('offers')).payment_state,'paid');
  await pay.processCommercePayment(p.id);await assert.rejects(pay.acceptBindingOffer('seller',offer.id,offer.revision),/changed/);
  assert.equal(calls.filter(c=>c[0]==='confirm').length,1);assert.equal((await query('SELECT * FROM orders')).rows.length,1);
});
test('unauthorized, stale and expired acceptances never charge',async()=>{
  const offer=await authorize();
  await assert.rejects(pay.acceptBindingOffer('other',offer.id,offer.revision),/changed/);
  await assert.rejects(pay.acceptBindingOffer('buyer',offer.id,offer.revision),/changed/);
  await assert.rejects(pay.acceptBindingOffer('seller',offer.id,0),/changed/);
  await query("UPDATE offers SET expires_at=NOW()-INTERVAL '1 second'");
  await assert.rejects(pay.acceptBindingOffer('seller',offer.id,offer.revision),/changed/);assert.equal(intents.size,0);
});
test('lost create and confirmation responses recover the same attempt without duplicate charges',async()=>{
  const offer=await authorize();lostCreate=true;
  await assert.rejects(pay.acceptBindingOffer('seller',offer.id,offer.revision),/Lost response/);
  assert.equal((await one('listings')).status,'reserved');assert.equal(calls.filter(c=>c[0]==='confirm').length,0);
  lostConfirm=true;const p=await one('commerce_payments');await pay.processCommercePayment(p.id);await pay.processCommercePayment(p.id);
  assert.equal(intents.size,1);assert.equal(calls.filter(c=>c[0]==='confirm').length,1);assert.equal((await one('commerce_payments')).state,'paid');
});
test('two accepted offers cannot purchase the same item; normal checkout respects that reservation',async()=>{
  const first=await authorize(),second=await authorize('other');outcome='processing';
  await pay.acceptBindingOffer('seller',first.id,first.revision);
  await assert.rejects(pay.acceptBindingOffer('seller',second.id,second.revision),/no longer available/);
  await assert.rejects(pay.startMarketplaceCheckout([await listing()],users.other,address),/no longer available/);
  assert.equal(calls.filter(c=>c[0]==='confirm').length,1);assert.equal((await query('SELECT * FROM orders')).rows.length,1);
  await assert.rejects(query("UPDATE listings SET status='active'"),/reserved for a payment/);
});
test('normal checkout wins inventory once and completes through the same verified receipt',async()=>{
  const offer=await authorize();await pay.startMarketplaceCheckout([await listing()],users.other,address);
  await assert.rejects(pay.acceptBindingOffer('seller',offer.id,offer.revision),/no longer available/);
  const p=await one('commerce_payments');await settleCheckout(p.session_id);await pay.handleCommerceSession({...sessions.get(p.session_id)});
  assert.equal((await one('orders')).amount,110);assert.equal((await one('commerce_payments')).state,'paid');
  assert.equal((await query("SELECT * FROM notification_events WHERE kind='purchase_paid'")).rows.length,1);
});
test('bank verification reserves the item without a paid receipt; recovery cancels original before charging',async()=>{
  const offer=await authorize();outcome='requires_action';await pay.acceptBindingOffer('seller',offer.id,offer.revision);
  assert.equal((await one('orders')).status,'pending_payment');assert.equal((await one('offers')).payment_state,'needs_payment');
  assert.equal((await query("SELECT * FROM notification_events WHERE payload->>'paymentState'='paid'")).rows.length,0);
  await assert.rejects(pay.startOfferPaymentRecovery(offer.id,'other'),/not found/);
  failCancel=true;await assert.rejects(pay.startOfferPaymentRecovery(offer.id,'buyer'),/unavailable/);
  assert.equal(calls.filter(c=>c[0]==='checkout'&&c[1]==='payment').length,0);
  failCancel=false;await pay.processCommercePayment((await one('commerce_payments')).id);
  const p=await one('commerce_payments');assert.equal(intents.get(p.payment_intent_id).status,'canceled');
  await pay.startOfferPaymentRecovery(offer.id,'buyer');assert.equal(calls.filter(c=>c[0]==='checkout'&&c[1]==='payment').length,1);
  await settleCheckout(p.session_id);assert.equal((await one('commerce_payments')).state,'paid');assert.equal((await one('orders')).status,'processing');
});
test('declined cards are not repeatedly charged; expiry verifies cancellation before releasing stock',async()=>{
  const offer=await authorize();outcome='requires_payment_method';await pay.acceptBindingOffer('seller',offer.id,offer.revision);
  const p=await one('commerce_payments');await pay.processCommercePayment(p.id);assert.equal(calls.filter(c=>c[0]==='confirm').length,1);
  await query("UPDATE commerce_payments SET expires_at=NOW()-INTERVAL '1 second'");failCancel=true;
  await assert.rejects(pay.processCommercePayment(p.id));assert.equal((await one('listings')).status,'reserved');
  failCancel=false;await pay.processCommercePayment(p.id);assert.equal((await one('listings')).status,'active');assert.equal((await one('orders')).status,'failed');
  assert.equal((await one('offers')).payment_state,'canceled');
});
test('processing payments retain stock past the deadline until Stripe resolves them',async()=>{
  const offer=await authorize();outcome='processing';await pay.acceptBindingOffer('seller',offer.id,offer.revision);
  const p=await one('commerce_payments');await query("UPDATE commerce_payments SET expires_at=NOW()-INTERVAL '1 second'");
  await pay.processCommercePayment(p.id);assert.equal((await one('listings')).status,'reserved');
  const intent=intents.get(p.payment_intent_id);intent.status='succeeded';intent.amount_received=intent.amount;
  await pay.processCommercePayment(p.id);assert.equal((await one('commerce_payments')).state,'paid');
});
test('seller counters invalidate old authorization; buyer acceptance authorizes the changed total',async()=>{
  const offer=await authorize();await offers.respondToOffer('seller',offer.id,offer.revision,'counter',85);
  const counter=await one('offers');assert.equal(counter.authorization_id,null);
  await assert.rejects(offers.respondToOffer('buyer',offer.id,counter.revision,'accept'),/authorize/);
  const id=await auth.prepareOfferAuthorization(offer.id,'buyer','accept');await auth.startOfferAuthorization(id,'buyer',address,true);await completeSetup(id);
  assert.equal((await one('orders')).amount,95);assert.equal((await one('commerce_payments')).state,'paid');
});
test('buyer counters also require fresh card consent and do not charge until seller acceptance',async()=>{
  const offer=await authorize();await offers.respondToOffer('seller',offer.id,offer.revision,'counter',85);
  const id=await auth.prepareOfferAuthorization(offer.id,'buyer','counter',82);
  await auth.startOfferAuthorization(id,'buyer',address,true);await completeSetup(id);assert.equal(intents.size,0);
  const revised=await one('offers');assert.equal(revised.amount,82);
  await pay.acceptBindingOffer('seller',revised.id,revised.revision);assert.equal((await one('orders')).amount,92);
});
test('a stale setup or mismatched customer cannot submit an offer',async()=>{
  const id=await auth.createBindingOffer('buyer','listing',80,'');await auth.startOfferAuthorization(id,'buyer',address,true);
  const a=await one('offer_authorizations');const session=sessions.get(a.setup_session_id);session.customer='cus_intruder';
  await assert.rejects(completeSetup(id),/does not match/);assert.equal((await one('offers')).status,'draft');
  session.customer=a.customer_id;await query('UPDATE offers SET revision=revision+1');await completeSetup(id);
  assert.equal((await one('offer_authorizations')).state,'canceled');assert.equal(intents.size,0);
});
test('checkout receipt mismatches do not mark paid or release a reservation',async()=>{
  await pay.startMarketplaceCheckout([await listing()],users.buyer,address);const p=await one('commerce_payments');
  const session=sessions.get(p.session_id);session.amount_total=1;
  await assert.rejects(settleCheckout(p.session_id),/total does not match/);assert.equal((await one('orders')).status,'pending_payment');
  session.amount_total=11000;const bad=intents.get(session.payment_intent);bad.amount=11000;bad.amount_received=11000;bad.transfer_data.destination='acct_wrong';
  await assert.rejects(pay.handleCommerceSession({...session}),/receipt does not match|recipient does not match/);
  assert.equal((await one('listings')).status,'reserved');
});
test('worker recovers an unrecorded setup session and submits a completed authorization',async()=>{
  const id=await auth.createBindingOffer('buyer','listing',80,'');await auth.startOfferAuthorization(id,'buyer',address,true);
  const a=await one('offer_authorizations');await query('UPDATE offer_authorizations SET setup_session_id=NULL');
  await auth.processOfferAuthorizations();assert.equal((await one('offer_authorizations')).setup_session_id,a.setup_session_id);assert.equal(sessions.size,1);
  const session=sessions.get(a.setup_session_id);session.status='complete';session.setup_intent='seti_worker';
  setups.set('seti_worker',{id:'seti_worker',status:'succeeded',customer:a.customer_id,payment_method:'pm_worker',metadata:{authorizationId:id}});
  await auth.processOfferAuthorizations();assert.equal((await one('offers')).status,'active');assert.equal(intents.size,0);
});
test('expired Checkout recovery keys require review and never create another payable session',async()=>{
  await pay.startMarketplaceCheckout([await listing()],users.buyer,address);const p=await one('commerce_payments');
  await query("UPDATE commerce_payments SET session_id=NULL,created_at=NOW()-INTERVAL '24 hours'");
  await pay.processCommercePayment(p.id);assert.equal((await one('commerce_payments')).state,'review');
  assert.equal(sessions.size,1);assert.equal((await one('listings')).status,'reserved');
});
test('completing counteroffer authorization after another checkout cannot charge the buyer',async()=>{
  const offer=await authorize();await offers.respondToOffer('seller',offer.id,offer.revision,'counter',85);
  const id=await auth.prepareOfferAuthorization(offer.id,'buyer','accept');await auth.startOfferAuthorization(id,'buyer',address,true);
  await pay.startMarketplaceCheckout([await listing()],users.other,address);await completeSetup(id);
  const row=(await query('SELECT state FROM offer_authorizations WHERE id=$1',[id])).rows[0];assert.equal(row.state,'canceled');assert.equal(intents.size,0);
});
test('abandoned checkout expires safely and cannot reopen on a stale webhook',async()=>{
  await pay.startMarketplaceCheckout([await listing()],users.buyer,address);const p=await one('commerce_payments');
  await query("UPDATE commerce_payments SET expires_at=NOW()-INTERVAL '1 second'");await pay.processCommercePayment(p.id);
  assert.equal((await one('listings')).status,'active');assert.equal((await one('commerce_payments')).state,'canceled');
  await pay.handleCommerceSession({...sessions.get(p.session_id)});assert.equal((await one('orders')).status,'failed');
});
test('legacy offers retain checkout pricing and never gain automatic-charge permission',async()=>{
  await query("INSERT INTO offers(id,buyer_id,seller_id,listing_id,amount,status,last_actor_id) VALUES('legacy','buyer','seller','listing',70,'active','buyer')");
  await offers.respondToOffer('seller','legacy',0,'accept');assert.equal((await one('offers')).auto_charge,false);
  const discounted=await offers.applyAcceptedOfferPrices([await listing()],'buyer');assert.equal(discounted[0].price,70);assert.equal(intents.size,0);
});
test('paid copy distinguishes buyer and seller; failed payments never claim a completed purchase',()=>{
  const event={status:'accepted',autoCharge:true,paymentState:'paid',amount:80,actorId:'seller',buyerId:'buyer'};
  const buyer=offerEmailCopy(event,'Trousers',true,90),seller=offerEmailCopy(event,'Trousers',false,90);
  assert.match(buyer.subject,/purchase confirmed/);assert.match(buyer.text,/\$90.00/);assert.match(seller.subject,/payment received/);
  const failure=offerEmailCopy({...event,paymentState:'needs_payment'},'Trousers',false);assert.match(failure.text,/wait for a payment confirmation/);assert.doesNotMatch(failure.text,/is complete/);
  assert.doesNotMatch(offerEmailCopy({...event,status:'rejected'},'Trousers',true).text,/respond/);
});
test('production migration requires the prior schema and applies version 38 idempotently',async()=>{
  await db.exec('CREATE TABLE tailorgraph_schema_migrations(version INTEGER PRIMARY KEY);INSERT INTO tailorgraph_schema_migrations VALUES(37)');
  mock.module('pg',{namedExports:{Pool:class{async connect(){return {query:async(sql,args=[])=>sql.includes('pg_advisory_xact_lock')?{rows:[]}:query(sql,args),release(){}};}async end(){}}}});
  process.env.VERCEL_ENV='production';
  try {
    await import('../scripts/migrate-offer-payments.ts?first');await import('../scripts/migrate-offer-payments.ts?second');
    assert.equal((await query('SELECT MAX(version) AS version FROM tailorgraph_schema_migrations')).rows[0].version,38);
    await query('TRUNCATE tailorgraph_schema_migrations');await assert.rejects(import('../scripts/migrate-offer-payments.ts?empty'),/schema 37/);
  }finally{delete process.env.VERCEL_ENV;}
});
