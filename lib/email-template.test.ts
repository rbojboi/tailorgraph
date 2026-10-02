import assert from "node:assert/strict";
import test from "node:test";
import { renderEmailTemplate, emailUrl } from "./email-template";

test("email layout escapes content and includes a preheader and readable branded fallback", () => {
  const html = renderEmailTemplate({
    title: 'An <img onerror="bad"> offer', preview: "<Preview>",
    introParagraphs: ["Buyer & seller"], details: [{ label: "<Item>", value: "A & B" }],
    primaryAction: { label: "Open <order>", url: "https://example.com/order?a=1&b=2" }
  }, "https://example.com");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.match(html, /&lt;img onerror=&quot;bad&quot;&gt;/);
  assert.match(html, /&lt;Preview&gt;/);
  assert.match(html, /alt="TailorGraph"/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /#6e3521/);
  assert.match(html, /a=1&amp;b=2/);
  assert.doesNotMatch(html, /<img onerror=/);
});

test("optional emails include settings, and unsafe action URLs are rejected", () => {
  assert.equal(emailUrl("javascript:alert(1)"), "#");
  assert.equal(emailUrl("data:text/html,test"), "#");
  assert.equal(emailUrl("//example.com"), "#");
  const html = renderEmailTemplate({ title: "New message", optional: true }, "https://example.com");
  assert.match(html, /https:\/\/example.com\/account\/notifications/);
});
