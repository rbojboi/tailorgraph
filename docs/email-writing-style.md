# Email writing and actions

Use a short status heading, the facts the recipient needs, and one primary action.
Use sentence case for headings and buttons. Prefer a specific verb and object:
View order, Manage order, Review offer, Complete payment, View listing, View
message, View shipping label, View return label, Verify email, Reset password.

Use an outlined secondary button only for a useful alternative, such as carrier
tracking, a QR code, or browsing the marketplace during onboarding. Keep help,
notification preferences, and unsubscribe links in the footer. Avoid instructions
that repeat the button or explain how to navigate the site.

Keep payment status, payment and shipping deadlines, return windows, refund
exclusions, and carrier drop-off requirements explicit. Email buttons open the
appropriate site page; accepting an offer, paying, or issuing a refund still
requires the site's existing authentication and confirmation flow.

Preserve the approved new-offer and counteroffer paragraphs. Buyer counteroffers
use the same general new-offer wording when received by the seller.

Optional email payloads provide a separate digestSummary and digestAction. HTML
digests display those summaries with branded buttons, never the plain-text
navigation URLs. A fallback removes navigation lines from older queued payloads.
Plain-text alternatives retain usable links. Both digest creation and the final
delivery refresh use renderDigestEmail, including the refreshed item count.

Run npm run email:render for sample HTML and plain-text previews, or npm run
email:preview to browse them locally. Preview rendering does not send email.
