import { mkdir, writeFile, cp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emailPreviews } from "../lib/notifications.ts";
import { renderDigestEmail } from "../lib/email-digest-template.ts";
import { renderEmailTemplate } from "../lib/email-template.ts";
import { offerEmailCopy } from "../lib/offer-email.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "artifacts/email-preview");
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.tailorgraph.com";
process.env.NEXT_PUBLIC_APP_URL = appUrl;
await mkdir(output, { recursive: true });
await cp(path.join(root, "public/brand"), path.join(output, "brand"), { recursive: true });
// These fixtures never call a sending function or access a real account.
const buyer = { id: "preview-buyer", name: "Alex", username: "alex", email: "alex@example.com" };
const seller = { id: "preview-seller", name: "Morgan", username: "morgan", email: "morgan@example.com" };
const order = { id: "preview-order", listingTitle: "Gieves & Hawkes houndstooth wool suit", amount: 297, subtotal: 275,
  shippingAmount: 22, sellerName: "morgan", carrier: "USPS", trackingNumber: "9400 1000 0000 0000 0000 00" };
const context = { order, listing: null, buyer, seller };
const listingUrl = appUrl + "/listings/preview-listing";
const digestItems = [{
  subject: "A saved item has a lower price",
  text: `${order.listingTitle} dropped from $300.00 to $275.00.\n\nView listing: ${listingUrl}`,
  digestSummary: `${order.listingTitle} dropped from $300.00 to $275.00.`,
  digestAction: { label: "View listing", url: listingUrl }
}, {
  subject: "A new match for your saved search",
  text: `Navy wool jacket matches “Jackets in my size”. Listed at $180.00.\n\nView listing: ${listingUrl}`,
  digestSummary: "Navy wool jacket matches “Jackets in my size”. Listed at $180.00.",
  digestAction: { label: "View listing", url: listingUrl }
}];
const labelContext = { ...context, order: { ...order,
  shippingLabelUrl: appUrl + "/seller#sample-label", shippingQrCodeUrl: appUrl + "/seller#sample-qr",
  returnLabelUrl: appUrl + "/buyer/orders#sample-label", returnQrCodeUrl: appUrl + "/buyer/orders#sample-qr"
}};
function offerPreview(status, isBuyer, paymentState) {
  const copy = offerEmailCopy({status,autoCharge:true,paymentState,actorId:buyer.id,buyerId:buyer.id,amount:250},order.listingTitle,isBuyer,272);
  const url=appUrl+(isBuyer?paymentState==="paid"?"/buyer/orders":"/buyer/offers":"/seller");
  return { ...copy, text:copy.text+`\n\n${copy.button}: ${url}`, html: renderEmailTemplate({title:copy.subject,introParagraphs:[copy.text],optional:!paymentState,
    primaryAction:{label:copy.button,url}},appUrl) };
}
const previews = {
  "digest": renderDigestEmail(digestItems, appUrl),
  "digest-legacy": renderDigestEmail(digestItems.map(({subject,text})=>({subject,text})), appUrl),
  "purchase-confirmed": emailPreviews.purchaseBuyerEmail(context),
  "new-sale": emailPreviews.purchaseSellerEmail(context),
  "order-shipped": emailPreviews.shipmentBuyerEmail(context),
  "new-message": emailPreviews.directMessageEmail({ thread: { id: "preview-thread" }, sender: buyer, recipient: seller, body: "Hello! Could you confirm whether the trousers have room to let out at the waist?" }),
  "new-offer": offerPreview("active", false),
  "counteroffer": offerPreview("countered", true),
  "offer-paid-buyer": offerPreview("accepted", true, "paid"),
  "offer-paid-seller": offerPreview("accepted", false, "paid"),
  "offer-payment-needed": offerPreview("accepted", true, "needs_payment"),
  "shipping-label": emailPreviews.shipmentSellerEmail(labelContext),
  "return-label": emailPreviews.returnLabelBuyerEmail(labelContext),
  "welcome": emailPreviews.welcomeEmail({ user: buyer }),
  "verify-email": emailPreviews.emailVerificationEmail({user:buyer,verificationUrl:appUrl+"/#sample-verification"}),
  "password-reset": emailPreviews.passwordResetEmail({user:buyer,resetUrl:appUrl+"/#sample-reset"}),
  "support-received": emailPreviews.supportRequestConfirmationEmail({request:{kind:"support",subject:"A shipping question",topic:"Shipping"}})
};
for (const [name, email] of Object.entries(previews)) {
  await writeFile(path.join(output, name + ".html"), email.html.replace(/src="[^"]*\/brand\//g, 'src="/brand/'));
  await writeFile(path.join(output, name + ".txt"), email.subject + "\n\n" + email.text);
}
await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TailorGraph email previews</title><body style="background:#f5f1eb;color:#1c1712;font:16px/1.7 Helvetica,Arial,sans-serif;max-width:760px;margin:48px auto;padding:0 24px"><p style="color:#6e3521;letter-spacing:2px;font-size:12px">TAILORGRAPH / EMAILS</p><h1 style="font:38px Georgia,serif">A familiar look. A clear next step.</h1><p>Preview the actual email templates with sample data. No emails are sent.</p><ul>${Object.entries(previews).map(([name,email]) => `<li><a style="color:#6e3521" href="/${name}.html">${email.subject}</a> · <a href="/${name}.txt">Plain text</a></li>`).join("")}</ul></body></html>`);
console.log("Email previews written to " + output);
if (process.argv.includes("--serve")) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(output, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(output + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const data = await readFile(file);
      const types = { ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpeg": "image/jpeg" };
      res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data);
    } catch { res.writeHead(404).end("Not found"); }
  });
  server.listen(3117, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:3117"));
}
