import assert from "node:assert/strict";
import test from "node:test";
import { renderDigestEmail } from "./email-digest-template";

const appUrl = "https://www.tailorgraph.com";
const visibleText = (html: string) => html.replace(/<[^>]*>/g, "");

test("digest uses a summary and branded listing button without displaying the plain-text URL", () => {
  const url = `${appUrl}/listings/example`;
  const email = renderDigestEmail([{
    subject: "A new match for your saved search",
    text: `Wool suit matches your search.\n\nView listing: ${url}`,
    digestSummary: "Wool suit matches your search.",
    digestAction: { label: "View listing", url }
  }], appUrl);
  assert.match(email.html, /class="button" href="https:\/\/www.tailorgraph.com\/listings\/example"/);
  assert.doesNotMatch(visibleText(email.html), /https?:\/\//);
  assert.ok(email.text.includes(url), "Plain-text readers retain the destination");
  assert.doesNotMatch(email.html, /Visit TailorGraph/);
  assert.match(email.subject, /1 update$/);
});

test("older digest items omit navigation URL lines without losing the summary or text links", () => {
  const email = renderDigestEmail([{
    subject: "Price drop",
    text: `Wool suit dropped from $300 to $250.\n\n${appUrl}/marketplace`
  }, {
    subject: "New message",
    text: `Email preferences: ${appUrl}/account/notifications\n\nA new message from Alex.\n\nReply here: ${appUrl}/messages`
  }], appUrl);
  assert.doesNotMatch(visibleText(email.html), /https?:\/\//);
  assert.match(email.html, /Wool suit dropped/);
  assert.match(email.html, /A new message from Alex/);
  assert.match(email.html, /Visit TailorGraph/);
  assert.match(email.text, /\/marketplace/);
  assert.match(email.subject, /2 updates$/);
});

test("digest summaries and action labels are escaped and unsafe destinations are rejected", () => {
  const email = renderDigestEmail([{
    subject: '<img onerror="bad">', text: "Fallback", digestSummary: "<script>bad</script>",
    digestAction: { label: "View <listing>", url: "javascript:alert(1)" }
  }], appUrl);
  assert.doesNotMatch(email.html, /<script>|<img onerror|href="javascript:/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /View &lt;listing&gt;/);
});
