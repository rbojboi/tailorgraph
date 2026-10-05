import assert from "node:assert/strict";
import {test,beforeEach,mock} from "node:test";

const queries=[],calls=[];
let locked=true,fail=false,released=false;
mock.module(new URL("../lib/store.ts",import.meta.url).href,{namedExports:{
 ensureSchema:async()=>{},findUserById:async()=>null,hasNotificationDelivery:async()=>false,recordNotificationDelivery:async()=>{},
 requirePool:()=>({connect:async()=>({query:async sql=>{queries.push(sql);return {rows:[{locked}]};},release(){released=true;}})})
}});
mock.module(new URL("../lib/email-outbox.ts",import.meta.url).href,{namedExports:{
 enqueueEmail:async()=>{},EmailDeliveryError:class extends Error{},drainEmailOutbox:async()=>{calls.push("drain");return {sent:1};}
}});
mock.module(new URL("../lib/email-monitor.ts",import.meta.url).href,{namedExports:{trackEmail:async()=>{},recipientSuppressed:async()=>false,refreshEmailDeliveryStatuses:async()=>calls.push("status")}});
mock.module(new URL("../lib/email-digests.ts",import.meta.url).href,{namedExports:{flushEmailDigests:async()=>calls.push("digests")}});
mock.module(new URL("../lib/notification-events.ts",import.meta.url).href,{namedExports:{processNotificationEvents:async()=>{calls.push("events");if(fail)throw Error("storage failed");},queueShippingReminders:async()=>calls.push("shipping")}});
mock.module(new URL("../lib/offers.ts",import.meta.url).href,{namedExports:{expireOffers:async()=>calls.push("offers")}});
mock.module(new URL("../lib/return-notifications.ts",import.meta.url).href,{namedExports:{deliverReturnNotifications:async()=>calls.push("returns")}});
const {deliverPendingEmails}=await import("../lib/notifications.ts");
beforeEach(()=>{queries.length=0;calls.length=0;locked=true;fail=false;released=false;process.env.RESEND_API_KEY="fake";process.env.EMAIL_FROM="sender@example.com";});
test("worker holds a transaction lock across the pipeline and records completion only after sending",async()=>{
 assert.equal((await deliverPendingEmails()).sent,1);
 assert.deepEqual(calls,["offers","events","returns","shipping","digests","drain","status"]);
 assert.equal(queries[0],"BEGIN");assert.match(queries[1],/pg_try_advisory_xact_lock/);
 assert.ok(queries.some(sql=>sql.includes("email_worker_health")));assert.ok(queries.includes("COMMIT"));assert.ok(released);
});
test("a competing worker performs no work and rolls back its transaction",async()=>{
 locked=false;assert.equal((await deliverPendingEmails()).busy,true);assert.deepEqual(calls,[]);
 assert.equal(queries.at(-1),"ROLLBACK");assert.ok(!queries.includes("COMMIT"));assert.ok(released);
});
test("pipeline failures release the transaction lock without recording success",async()=>{
 fail=true;await assert.rejects(deliverPendingEmails(),/storage failed/);
 assert.equal(queries.at(-1),"ROLLBACK");assert.ok(!queries.some(sql=>sql.includes("email_worker_health")));assert.ok(released);
});
