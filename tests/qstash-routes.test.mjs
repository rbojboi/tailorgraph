import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
const calls = [];
let configured = true;
let databaseFails = false;
let alertFails = false;
mock.module("../lib/notifications.ts", { namedExports: {
  deliverPendingEmails: async () => { calls.push("email"); return {configured, sent:0}; },
  sendEmailWorkerHealthAlert: async () => { calls.push("alert"); if(alertFails) throw new Error("provider"); return 1; }
}});
mock.module("../lib/offer-authorization.ts", { namedExports: { processOfferAuthorizations: async()=>{calls.push("offers");} }});
mock.module("../lib/commerce-payments.ts", { namedExports: { processCommercePayments: async()=>{calls.push("payments");} }});
mock.module("../lib/store.ts", { namedExports: { requirePool:()=>({query:async()=>{
  if(databaseFails) throw new Error("db");
  return {rows:[{last_success_at:new Date()}]};
}}) }});
const worker=await import("../app/api/cron/email/route.ts");
const health=await import("../app/api/cron/email-health/route.ts");
const base="https://www.tailorgraph.com/api/cron/";
async function signed(path) {
  const body="{}";
  const signature=await new SignJWT({body:createHash("sha256").update(body).digest("base64url")})
    .setProtectedHeader({alg:"HS256"}).setIssuer("Upstash").setSubject(base+path)
    .setIssuedAt().setNotBefore(0).setExpirationTime("5m")
    .sign(new TextEncoder().encode("current-test"));
  return new Request(base+path,{method:"POST",body,headers:{"upstash-signature":signature}});
}
test("QStash routes authorize before business work, preserve recovery, and report configuration failures",async()=>{
 process.env.QSTASH_CURRENT_SIGNING_KEY="current-test";
 process.env.QSTASH_NEXT_SIGNING_KEY="next-test";
 process.env.CRON_SECRET="manual-test";
 try {
  assert.equal((await worker.POST(new Request(base+"email",{method:"POST"}))).status,401);
  assert.equal((await health.POST(new Request(base+"email-health",{method:"POST"}))).status,401);
  assert.deepEqual(calls,[]);
  assert.equal((await worker.POST(await signed("email"))).status,200);
  assert.deepEqual(calls,["offers","payments","email"]);
  calls.length=0;
  assert.equal((await worker.GET(new Request(base+"email",{headers:{authorization:"Bearer manual-test"}}))).status,200);
  assert.deepEqual(calls,["offers","payments","email"]);
  configured=false;
  assert.equal((await worker.POST(await signed("email"))).status,503);
  calls.length=0;
  const healthy=await health.POST(await signed("email-health"));
  assert.equal((await healthy.json()).healthy,true);
  assert.deepEqual(calls,[]);
  databaseFails=true;
  assert.equal((await health.POST(await signed("email-health"))).status,200);
  assert.deepEqual(calls,["alert"]);
  alertFails=true;
  assert.equal((await health.POST(await signed("email-health"))).status,503);
 } finally {
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
  delete process.env.CRON_SECRET;
 }
});

