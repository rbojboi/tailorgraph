import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateSellerTransfer, cents, firstAcceptedScan, returnRequestError } from "./return-policy";

test("refund allocations exclude shipping and reconcile to the original seller transfer", () => {
  assert.deepEqual(allocateSellerTransfer([{id:"a",subtotal:100},{id:"b",subtotal:50}],13500), {a:9000,b:4500});
  const items = [{id:"a",subtotal:10.01},{id:"b",subtotal:10.01},{id:"c",subtotal:10.01}];
  const allocation = allocateSellerTransfer(items,2703);
  assert.equal(Object.values(allocation).reduce((a,b)=>a+b,0),2703);
  assert.deepEqual(allocateSellerTransfer([...items].reverse(),2703),allocation);
  assert.throws(()=>cents(NaN));
  assert.throws(()=>allocateSellerTransfer(items,4000));
});
test("carrier acceptance excludes label creation and scans outside the shipping window", () => {
  const start="2025-01-01T00:00:00Z", end="2025-01-06T00:00:00Z";
  assert.equal(firstAcceptedScan([{status:"PRE_TRANSIT",status_date:"2025-01-02T00:00:00Z"}],start,end),null);
  assert.equal(firstAcceptedScan([{status:"TRANSIT",status_date:"2025-01-07T00:00:00Z"}],start,end),null);
  assert.equal(firstAcceptedScan([{status:"TRANSIT",status_date:"2024-12-30T00:00:00Z"}],start,end),null);
  assert.equal(firstAcceptedScan([{status:"TRANSIT",status_date:"2025-01-02T00:00:00Z"},{status:"DELIVERED",status_date:"2025-01-08T00:00:00Z"}],start,end), Date.parse("2025-01-02T00:00:00Z"));
});
test("eligibility uses calendar days and the order policy", () => {
  const order={returnPolicy:"automatic_returns",status:"delivered",deliveredAt:"2025-01-01T00:00:00Z"};
  assert.equal(returnRequestError(order,Date.parse("2025-01-07T23:59:59Z")),null);
  assert.match(returnRequestError(order,Date.parse("2025-01-09T00:00:00Z"))!,/ended/);
  assert.match(returnRequestError({...order,returnPolicy:"no_returns"})!,/does not accept/);
  assert.match(returnRequestError({...order,deliveredAt:null})!,/after delivery/);
});
