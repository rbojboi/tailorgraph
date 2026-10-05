import { trackEmail, recipientSuppressed, refreshEmailDeliveryStatuses } from "./email-monitor";
import { unsubscribeToken } from "./email-unsubscribe";
import { emailFrequency, type OptionalEmailKey } from "./notification-preferences";
import { requirePool, ensureSchema } from "./store";
import { createHash } from "node:crypto";
import { renderEmailTemplate, type EmailLayoutInput } from "@/lib/email-template";
import { enqueueEmail, drainEmailOutbox, EmailDeliveryError } from "@/lib/email-outbox";
import { Resend } from "resend";
import twilio from "twilio";
import { getAdminEmails } from "@/lib/admin";
import { getAppUrl } from "@/lib/stripe";
import { hasNotificationDelivery, recordNotificationDelivery } from "@/lib/store";
import type { Listing, MessageThread, Order, Offer, SupportRequest, User } from "@/lib/types";

let resendClient: Resend | null = null;
let twilioClient: ReturnType<typeof twilio> | null = null;

/** Send outside the outbox so a stalled worker or unavailable database cannot block its alert. */
export async function sendEmailWorkerHealthAlert(health: import("./email-worker-health").WorkerHealth) {
  const recipients = [...new Set(getAdminEmails())];
  if (!recipients.length) throw new Error("ADMIN_EMAILS is not configured");
  const from = getEmailSenderForCategory("support");
  const status = health.reason === "unavailable"
    ? "TailorGraph could not check the email worker's database."
    : "TailorGraph has not recorded a successful email worker run within ten minutes.";
  const lastSuccess = health.lastSuccess ?? "No successful run available";
  const subject = "TailorGraph email worker needs attention";
  const url = "https://www.tailorgraph.com/admin/emails";
  const html = renderEmailTemplate({
    eyebrow: "Site operations", title: "Email worker needs attention",
    introParagraphs: [status],
    details: [{ label: "Last successful run", value: lastSuccess }],
    primaryAction: { label: "Review email delivery", url },
    footerMessage: "Check QStash delivery logs and the production application logs."
  }, "https://www.tailorgraph.com");
  // Stable content/key for each incident and UTC day prevents repeated watchdog mail.
  for (const to of recipients) {
    const incident = createHash("sha256").update(JSON.stringify([
      health.reason, lastSuccess, to, new Date().toISOString().slice(0, 10)
    ])).digest("hex");
    const result = await getResendClient().emails.send({
      from, to: [to], replyTo: getReplyToForCategory("support", from), subject, html,
      text: `${status}\nLast successful run: ${lastSuccess}\nReview email delivery: ${url}`
    }, { idempotencyKey: `email-worker-health-${incident}` });
    if (result.error || !result.data?.id) throw new Error("Email worker health alert failed");
  }
  return recipients.length;
}

export type EmailInput = {
  durable?: boolean;
  recipientUserId?: string;
  preferenceKey?: OptionalEmailKey;
  digest?: boolean;
  digestFrequency?: "daily" | "weekly";
  digestItems?: EmailInput[];
  digestSummary?: string;
  digestAction?: EmailLayoutInput["primaryAction"];
  listingId?: string;
  savedSearchId?: string;
  requireSavedItem?: boolean;
  maximumPrice?: number;
  orderId?: string;
  offerId?: string;
  offerPaymentState?: string;
  requireUnshipped?: boolean;
  messageId?: string;
  eventKey: string;
  eventType: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: EmailSenderCategory;
  fromOverride?: string;
  replyToOverride?: string;
  skipDedupe?: boolean;
};

type SmsInput = {
  eventKey: string;
  eventType: string;
  to: string;
  body: string;
};

type OrderNotificationContext = {
  order: Order;
  listing: Listing | null;
  buyer: User;
  seller: User;
};

type DirectMessageNotificationContext = {
  messageId: string;
  thread: MessageThread;
  sender: User;
  recipient: User;
  body: string;
};

type NewListingNotificationContext = {
  listing: Listing;
  seller: User;
  recipient: User;
};

type AccountEmailVerificationContext = {
  user: User;
  verificationUrl: string;
};

type PasswordResetNotificationContext = {
  user: User;
  resetUrl: string;
};

type WelcomeNotificationContext = {
  user: User;
};

type SupportRequestNotificationContext = {
  request: SupportRequest;
};

export type EmailSenderCategory =
  | "buyer_orders"
  | "seller_orders"
  | "messages"
  | "fit"
  | "alerts"
  | "support"
  | "hello"
  | "updates"
  | "no_reply";

export const EMAIL_SENDER_TEST_CATEGORIES: EmailSenderCategory[] = [
  "buyer_orders",
  "seller_orders",
  "messages",
  "fit",
  "alerts",
  "support",
  "hello",
  "updates",
  "no_reply"
];

type ParsedEmailSender = {
  name: string | null;
  address: string;
  localPart: string;
  domain: string;
};

export function isEmailNotificationConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function isSmsNotificationConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

function parseEmailSender(value: string | undefined | null): ParsedEmailSender | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const angleMatch = trimmed.match(/^(.*?)<([^<>]+)>$/);
  const rawAddress = angleMatch ? angleMatch[2].trim() : trimmed;
  const addressParts = rawAddress.split("@");
  if (addressParts.length !== 2 || !addressParts[0] || !addressParts[1]) {
    return null;
  }

  const rawName = angleMatch ? angleMatch[1].trim().replace(/^"|"$/g, "") : null;

  return {
    name: rawName || null,
    address: rawAddress,
    localPart: addressParts[0],
    domain: addressParts[1]
  };
}

function formatEmailSender(name: string, address: string) {
  return `${name} <${address}>`;
}

function senderDisplayNameForCategory(category: EmailSenderCategory) {
  switch (category) {
    case "buyer_orders":
      return "TailorGraph Buyer Orders";
    case "seller_orders":
      return "TailorGraph Seller Orders";
    case "messages":
      return "TailorGraph Messages";
    case "fit":
      return "TailorGraph Fit";
    case "alerts":
      return "TailorGraph Alerts";
    case "support":
      return "TailorGraph Support";
    case "hello":
      return "TailorGraph Hello";
    case "updates":
      return "TailorGraph Updates";
    case "no_reply":
      return "TailorGraph";
  }
}

function senderLocalPartForCategory(category: EmailSenderCategory) {
  switch (category) {
    case "buyer_orders":
      return "buyer-orders";
    case "seller_orders":
      return "seller-orders";
    case "messages":
      return "messages";
    case "fit":
      return "fit";
    case "alerts":
      return "alerts";
    case "support":
      return "support";
    case "hello":
      return "hello";
    case "updates":
      return "updates";
    case "no_reply":
      return "noreply";
  }
}

function explicitSenderForCategory(category: EmailSenderCategory) {
  switch (category) {
    case "buyer_orders":
      return process.env.EMAIL_FROM_BUYER_ORDERS;
    case "seller_orders":
      return process.env.EMAIL_FROM_SELLER_ORDERS;
    case "messages":
      return process.env.EMAIL_FROM_MESSAGES;
    case "fit":
      return process.env.EMAIL_FROM_FIT;
    case "alerts":
      return process.env.EMAIL_FROM_ALERTS;
    case "support":
      return process.env.EMAIL_FROM_SUPPORT;
    case "hello":
      return process.env.EMAIL_FROM_HELLO;
    case "updates":
      return process.env.EMAIL_FROM_UPDATES;
    case "no_reply":
      return process.env.EMAIL_FROM_NOREPLY;
  }
}

export function getEmailSenderForCategory(category: EmailSenderCategory) {
  const explicit = explicitSenderForCategory(category);
  if (explicit) {
    return explicit;
  }

  const emailFrom = process.env.EMAIL_FROM;
  const parsedDefault = parseEmailSender(emailFrom);
  if (!parsedDefault) {
    return emailFrom ?? "";
  }

  return formatEmailSender(
    senderDisplayNameForCategory(category),
    `${senderLocalPartForCategory(category)}@${parsedDefault.domain}`
  );
}

function deriveReplyDomain(domain: string) {
  return domain.startsWith("mail.") ? domain.slice("mail.".length) : domain;
}

function getReplyToForCategory(category: EmailSenderCategory, sender: string) {
  if (category === "no_reply") {
    return undefined;
  }

  const supportReplyTo = category === "support" ? process.env.EMAIL_REPLY_TO_SUPPORT?.trim() : undefined;
  const configuredReplyTo = supportReplyTo || process.env.EMAIL_REPLY_TO?.trim();
  if (configuredReplyTo) {
    return configuredReplyTo;
  }

  const parsedSender = parseEmailSender(sender);
  const replyLocalPart = senderLocalPartForCategory(category);

  if (!parsedSender) {
    return `${replyLocalPart}@tailorgraph.com`;
  }

  return `${replyLocalPart}@${deriveReplyDomain(parsedSender.domain)}`;
}

function getResendClient() {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }

  return resendClient;
}

function getTwilioClient() {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error("Twilio SMS is not configured");
  }

  if (!twilioClient) {
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  }

  return twilioClient;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeSmsNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (value.startsWith("+")) {
    return value;
  }

  return null;
}

function shouldSendOptionalEmail(
  user: Pick<User, "notificationPreferences">,
  preferenceKey: OptionalEmailKey
) {
  return emailFrequency(user.notificationPreferences, preferenceKey) !== "off";
}

async function sendEmailNotification(input: EmailInput) {
  if (input.durable && !input.skipDedupe) {
    await enqueueEmail(input);
    if (isEmailNotificationConfigured() && !input.messageId) {
      await drainEmailOutbox(deliverEmailNotification, input.eventKey);
    }
    return;
  }
  await deliverEmailNotification(input);
}

export async function deliverPendingEmails() {
  if (!isEmailNotificationConfigured()) return { configured: false, sent: 0, skipped: 0, retried: 0, failed: 0 };
  const { flushEmailDigests } = await import("./email-digests");
  const { processNotificationEvents, queueShippingReminders } = await import("./notification-events");
  const { expireOffers } = await import("./offers");
  await ensureSchema();
  const client=await requirePool().connect();
  let committed=false;
  try {
    // A transaction-scoped lock also works with transaction-pooling database proxies.
    await client.query("BEGIN");
    const lock=await client.query("SELECT pg_try_advisory_xact_lock(1208224399,37) AS locked");
    if (!lock.rows[0].locked) return {configured:true,busy:true};
    await expireOffers();
    await processNotificationEvents();
    await queueShippingReminders();
    await flushEmailDigests();
    const result=await drainEmailOutbox(deliverEmailNotification);
    await refreshEmailDeliveryStatuses();
    await client.query("INSERT INTO email_worker_health(id,last_success_at) VALUES(1,NOW()) ON CONFLICT(id) DO UPDATE SET last_success_at=NOW()");
    await client.query("COMMIT");
    committed=true;
    return {configured:true,...result};
  } finally { try { if (!committed) await client.query("ROLLBACK"); } finally { client.release(); } }
}

async function deliverEmailNotification(input: EmailInput) {
  if (!isEmailNotificationConfigured()) {
    return;
  }

  const recipient = input.to.trim();
  if (!recipient) {
    throw new EmailDeliveryError("missing_recipient", false);
  }

  if (!input.skipDedupe && (await hasNotificationDelivery(input.eventKey))) {
    return;
  }

  if (await recipientSuppressed(recipient)) { await trackEmail(input,"suppressed");return; }
  let html=input.html;let text=input.text;
  let headers:Record<string,string>|undefined;
  if (input.preferenceKey && input.recipientUserId) {
    const token=encodeURIComponent(unsubscribeToken(input.recipientUserId,input.to,input.preferenceKey));
    const url=`${getAppUrl()}/email/unsubscribe?token=${token}`;
    html=html.replace("</body>",`<p style="text-align:center;font:12px Arial;color:#6e6258"><a href="${url}">Unsubscribe from this category</a></p></body>`);
    text+=`\n\nUnsubscribe from this category: ${url}`;
    headers={"List-Unsubscribe":`<${getAppUrl()}/api/email/unsubscribe?token=${token}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"};
  }
  const category = input.category ?? "no_reply";
  const from = input.fromOverride || getEmailSenderForCategory(category);
  const emailReplyTo = input.replyToOverride ?? getReplyToForCategory(category, from);
  await trackEmail(input,"sending");
  const result = await getResendClient().emails.send({
    from,
    to: [recipient],
    replyTo: emailReplyTo,
    subject: input.subject,
    html,
    text,
    headers
  }, input.skipDedupe ? undefined : { idempotencyKey: input.eventKey }).catch(async error=>{
    await trackEmail(input,"failed",undefined,"provider_connection_error");
    throw error;
  });
  if (result.error) {
    await trackEmail(input,"failed",undefined,result.error.name);
    const status = result.error.statusCode;
    throw new EmailDeliveryError(result.error.name, !status || status === 429 || status >= 500 || result.error.name === "concurrent_idempotent_requests");
  }
  if (!result.data?.id) throw new EmailDeliveryError("missing_provider_receipt", true);

  await trackEmail(input,"sent",result.data.id);
  if (!input.skipDedupe) {
    await recordNotificationDelivery({
      eventKey: input.eventKey,
      channel: "email",
      recipient,
      eventType: input.eventType
    });
  }
}

async function sendSmsNotification(input: SmsInput) {
  if (!isSmsNotificationConfigured()) {
    return;
  }

  const normalizedTo = normalizeSmsNumber(input.to);
  if (!normalizedTo) {
    return;
  }

  if (await hasNotificationDelivery(input.eventKey)) {
    return;
  }

  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

  await getTwilioClient().messages.create({
    from: twilioFromNumber!,
    to: normalizedTo,
    body: input.body
  });

  await recordNotificationDelivery({
    eventKey: input.eventKey,
    channel: "sms",
    recipient: normalizedTo,
    eventType: input.eventType
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function addBusinessDays(startDate: Date, businessDays: number) {
  const date = new Date(startDate);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return date;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function renderEmailLayout(input: EmailLayoutInput) {
  return renderEmailTemplate(input, getAppUrl());
}

function purchaseBuyerEmail(context: OrderNotificationContext) {
  const { order, listing, seller } = context;
  const itemTitle = escapeHtml(order.listingTitle);
  const orderUrl = `${getAppUrl()}/buyer/orders`;
  const imageHtml =
    listing?.media[0]?.kind === "image"
      ? `<div style="margin:6px 0 0"><img src="${escapeHtml(listing.media[0].url)}" alt="${itemTitle}" style="width:100%;max-width:240px;border-radius:20px;display:block;border:1px solid #e4dbcf" /></div>`
      : "";

  return {
    subject: `TailorGraph purchase confirmed: ${order.listingTitle}`,
    text: `Your payment is complete. The seller will prepare your order.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTotal paid: ${formatCurrency(order.amount)}\n\nView order: ${orderUrl}`,
    html: renderEmailLayout({
      eyebrow: "Buyer Orders",
      title: "Purchase confirmed",
      introParagraphs: [
        "Your payment is complete. The seller will prepare your order."
      ],
      bodyHtml: imageHtml,
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Seller", value: `@${seller.username || order.sellerName}` },
        { label: "Total paid", value: formatCurrency(order.amount) }
      ],
      primaryAction: {
        label: "View order",
        url: orderUrl
      }
    })
  };
}

function purchaseSellerEmail(context: OrderNotificationContext) {
  const { order, buyer } = context;
  const sellerUrl = `${getAppUrl()}/seller/orders/${encodeURIComponent(order.id)}`;

  return {
    subject: `TailorGraph order received: ${order.listingTitle}`,
    text: `The buyer's payment is complete. Please ship by the deadline shown in your order.\n\nItem: ${order.listingTitle}\nBuyer: ${buyer.name}\nTotal paid: ${formatCurrency(order.amount)}\n\nManage order: ${sellerUrl}`,
    html: renderEmailLayout({
      eyebrow: "Seller Orders",
      title: "New order received",
      introParagraphs: [
        "The buyer's payment is complete. Please ship by the deadline shown in your order."
      ],
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Buyer", value: buyer.name },
        { label: "Total paid", value: formatCurrency(order.amount) }
      ],
      primaryAction: {
        label: "Manage order",
        url: sellerUrl
      }
    })
  };
}

function shipmentBuyerEmail(context: OrderNotificationContext) {
  const { order, seller } = context;
  const buyerUrl = `${getAppUrl()}/buyer/orders`;
  const tracking = order.trackingNumber ? `${order.carrier || "Carrier"} - ${order.trackingNumber}` : "Tracking pending";

  return {
    subject: `TailorGraph shipment update: ${order.listingTitle}`,
    text: `Your seller has marked this order as shipped.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTracking: ${tracking}\n\nView order: ${buyerUrl}${order.trackingUrl ? `\nTrack shipment: ${order.trackingUrl}` : ""}`,
    html: renderEmailLayout({
      eyebrow: "Buyer Orders",
      title: "Your order has shipped",
      introParagraphs: ["Your seller has marked this order as shipped."],
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Seller", value: `@${seller.username || order.sellerName}` },
        { label: "Tracking", value: tracking }
      ],
      primaryAction: {
        label: "View order",
        url: buyerUrl
      },
      secondaryAction: order.trackingUrl ? { label: "Track shipment", url: order.trackingUrl } : undefined
    })
  };
}

function shipmentSellerEmail(context: OrderNotificationContext) {
  const { order, buyer } = context;
  const sellerUrl = `${getAppUrl()}/seller/orders/${encodeURIComponent(order.id)}`;
  const tracking = order.trackingNumber ? `${order.carrier || "Carrier"} - ${order.trackingNumber}` : "Tracking pending";

  return {
    subject: `TailorGraph shipping label ready: ${order.listingTitle}`,
    text: `Your shipping label is ready. ${order.shippingQrCodeUrl ? "Print the label or show the QR code at a carrier counter that accepts QR drop-off." : "This label must be printed. A carrier QR code is not available."}\n\nItem: ${order.listingTitle}\nBuyer: ${buyer.name}\nTracking: ${tracking}\nView shipping label: ${order.shippingLabelUrl || "Not available"}\nView carrier QR: ${order.shippingQrCodeUrl || "Not available for this label"}\n\nManage order: ${sellerUrl}`,
    html: renderEmailLayout({
      eyebrow: "Seller Orders",
      title: "Shipping label ready",
      introParagraphs: [
        "Your shipping label is ready.",
        order.shippingQrCodeUrl
          ? "Print the label or show the QR code at a carrier counter that accepts QR drop-off."
          : "This label must be printed. A carrier QR code is not available."
      ],
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Buyer", value: buyer.name },
        { label: "Tracking", value: tracking },
        { label: "QR", value: order.shippingQrCodeUrl ? "Available" : "Not available for this label" }
      ],
      primaryAction: order.shippingLabelUrl
        ? {
            label: "View shipping label",
            url: order.shippingLabelUrl
          }
        : {
            label: "Manage order",
            url: sellerUrl
          },
      secondaryAction: order.shippingQrCodeUrl
        ? {
            label: "View carrier QR",
            url: order.shippingQrCodeUrl
          }
        : order.trackingUrl
          ? {
              label: "Track shipment",
              url: order.trackingUrl
            }
          : undefined
    })
  };
}

function returnLabelBuyerEmail(context: OrderNotificationContext) {
  const { order, seller } = context;
  const buyerUrl = `${getAppUrl()}/buyer/orders`;
  const tracking = order.returnTrackingNumber
    ? `${order.returnCarrier || "Carrier"} - ${order.returnTrackingNumber}`
    : "Tracking pending";

  return {
    subject: `TailorGraph return label ready: ${order.listingTitle}`,
    text: `Your return label is ready. ${order.returnQrCodeUrl ? "Print the label or show the QR code at a carrier counter that accepts QR drop-off." : "This label must be printed. A carrier QR code is not available."}\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTracking: ${tracking}\nView return label: ${order.returnLabelUrl || "Not available"}\nView carrier QR: ${order.returnQrCodeUrl || "Not available for this label"}\n\nView order: ${buyerUrl}`,
    html: renderEmailLayout({
      eyebrow: "Buyer Returns",
      title: "Return label ready",
      introParagraphs: [
        "Your return label is ready.",
        order.returnQrCodeUrl
          ? "Print the label or show the QR code at a carrier counter that accepts QR drop-off."
          : "This label must be printed. A carrier QR code is not available."
      ],
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Seller", value: `@${seller.username || order.sellerName}` },
        { label: "Return tracking", value: tracking },
        { label: "QR", value: order.returnQrCodeUrl ? "Available" : "Not available for this label" }
      ],
      primaryAction: order.returnLabelUrl
        ? {
            label: "View return label",
            url: order.returnLabelUrl
          }
        : {
            label: "View order",
            url: buyerUrl
          },
      secondaryAction: order.returnQrCodeUrl
        ? {
            label: "View carrier QR",
            url: order.returnQrCodeUrl
          }
        : order.returnTrackingUrl
          ? {
              label: "Track return",
              url: order.returnTrackingUrl
            }
          : undefined
    })
  };
}

function shipmentBuyerSms(context: OrderNotificationContext) {
  const { order } = context;
  return `TailorGraph: your order for "${order.listingTitle}" has shipped.${order.trackingNumber ? ` Tracking: ${order.trackingNumber}.` : ""} View updates in My Purchases.`;
}

function directMessageEmail(context: DirectMessageNotificationContext) {
  const messagesUrl = `${getAppUrl()}/messages?thread=${encodeURIComponent(context.thread.id)}`;
  const senderName = context.sender.username || context.sender.name;
  const preview = context.body.length > 160 ? `${context.body.slice(0, 157)}...` : context.body;

  return {
    subject: `New TailorGraph message from @${senderName}`,
    text: `You have a new message from @${senderName}.\n\n"${preview}"\n\nView message: ${messagesUrl}\nEmail preferences: ${getAppUrl()}/account/notifications`,
    digestSummary: `You have a new message from @${senderName}. "${preview}"`,
    digestAction: { label: "View message", url: messagesUrl },
    html: renderEmailLayout({
      optional: true,
      eyebrow: "Messages",
      title: "New message",
      introParagraphs: [`You have a new message from @${senderName}.`],
      bodyHtml: `<div style="margin:18px 0 0;padding:18px;border-radius:20px;background:#fbf8f4;border:1px solid #e4dbcf;color:#44403c;font-size:16px;line-height:1.65">"${escapeHtml(
        preview
      )}"</div>`,
      primaryAction: {
        label: "View message",
        url: messagesUrl
      }
    })
  };
}

function newListingFollowerEmail(context: NewListingNotificationContext) {
  const listingUrl = `${getAppUrl()}/listings/${context.listing.id}`;
  const sellerName = context.seller.username || context.seller.name;

  return {
    subject: `New TailorGraph listing from @${sellerName}`,
    text: `A seller you follow, @${sellerName}, listed a new item.\n\n${context.listing.title}\n${formatCurrency(context.listing.price)}\n\nView listing: ${listingUrl}\nEmail preferences: ${getAppUrl()}/account/notifications`,
    digestSummary: `${context.listing.title} — ${formatCurrency(context.listing.price)}. Listed by @${sellerName}, a seller you follow.`,
    digestAction: { label: "View listing", url: listingUrl },
    html: renderEmailLayout({
      optional: true,
      eyebrow: "Alerts",
      title: `New listing from @${sellerName}`,
      introParagraphs: ["A seller you follow listed a new item."],
      details: [
        { label: "Listing", value: context.listing.title },
        { label: "Price", value: formatCurrency(context.listing.price) }
      ],
      primaryAction: {
        label: "View listing",
        url: listingUrl
      }
    })
  };
}

function emailVerificationEmail(context: AccountEmailVerificationContext) {
  return {
    subject: "Verify your TailorGraph email address",
    text: `Confirm that this email address belongs to your TailorGraph account.\n\nVerify email: ${context.verificationUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: renderEmailLayout({
      eyebrow: "Account",
      title: "Verify your email",
      introParagraphs: [
        "Confirm that this email address belongs to your TailorGraph account.",
        "If you did not request this, you can ignore this email."
      ],
      primaryAction: {
        label: "Verify email",
        url: context.verificationUrl
      },
      footerMessage: "This verification link was sent because a TailorGraph account used this email address."
    })
  };
}

function passwordResetEmail(context: PasswordResetNotificationContext) {
  return {
    subject: "Reset your TailorGraph password",
    text: `A password reset was requested for your TailorGraph account.\n\nReset password: ${context.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: renderEmailLayout({
      eyebrow: "Account",
      title: "Reset your password",
      introParagraphs: [
        "A password reset was requested for your TailorGraph account.",
        "If you did not request this, you can ignore this email."
      ],
      primaryAction: {
        label: "Reset password",
        url: context.resetUrl
      },
      footerMessage: "This password reset link was requested for a TailorGraph account."
    })
  };
}

function welcomeEmail(context: WelcomeNotificationContext) {
  const measurementsUrl = `${getAppUrl()}/buyer/measurements`;
  const marketplaceUrl = `${getAppUrl()}/marketplace`;
  const supportUrl = `${getAppUrl()}/support`;

  return {
    subject: "Welcome to TailorGraph",
    text: `Welcome to TailorGraph. Your account is ready. Save your measurements to find items that fit.\n\nAdd measurements: ${measurementsUrl}\nBrowse marketplace: ${marketplaceUrl}\nGet help: ${supportUrl}\nEmail preferences: ${getAppUrl()}/account/notifications`,
    digestSummary: "Your account is ready. Save your measurements to find items that fit.",
    digestAction: { label: "Add measurements", url: measurementsUrl },
    html: renderEmailLayout({
      optional: true,
      eyebrow: "Hello",
      title: "Welcome to TailorGraph",
      introParagraphs: [
        "Your account is ready.",
        "Save your measurements to find items that fit."
      ],
      primaryAction: {
        label: "Add measurements",
        url: measurementsUrl
      },
      secondaryAction: {
        label: "Browse marketplace",
        url: marketplaceUrl
      },
      footerMessage: "Need help getting started? We're here to help."
    })
  };
}

function supportRequestConfirmationEmail(context: SupportRequestNotificationContext) {
  const supportUrl = `${getAppUrl()}/support`;
  return {
    subject: `TailorGraph support request received: ${context.request.subject}`,
    text: `We received your request and will follow up as needed.\n\nSubject: ${context.request.subject}\nTopic: ${context.request.topic}\n\nView support: ${supportUrl}`,
    html: renderEmailLayout({
      eyebrow: "Support",
      title: "We received your request",
      introParagraphs: ["We received your request and will follow up as needed."],
      details: [
        { label: "Subject", value: context.request.subject },
        { label: "Topic", value: context.request.topic }
      ],
      primaryAction: {
        label: "View support",
        url: supportUrl
      }
    })
  };
}

function supportRequestInternalEmail(context: SupportRequestNotificationContext) {
  const request = context.request;
  const subject = request.kind === "dispute" ? "New dispute report submitted" : "New support request submitted";

  return {
    subject: `TailorGraph ${subject.toLowerCase()}: ${request.subject}`,
    text: `${subject}\n\nRequester: ${request.requesterName} <${request.requesterEmail}>\nRole: ${request.requesterRole}\nKind: ${request.kind}\nTopic: ${request.topic}\nOrder ID: ${request.orderId || "None"}\nListing ID: ${request.listingId || "None"}\n\n${request.message}\n\nReview request: ${getAppUrl()}/admin`,
    html: renderEmailLayout({
      eyebrow: "Support",
      title: subject,
      details: [
        { label: "Requester", value: `${request.requesterName} <${request.requesterEmail}>` },
        { label: "Role", value: request.requesterRole },
        { label: "Kind", value: request.kind },
        { label: "Topic", value: request.topic },
        { label: "Order ID", value: request.orderId || "None" },
        { label: "Listing ID", value: request.listingId || "None" }
      ],
      bodyHtml: `<div style="margin:20px 0 0;padding:18px;border-radius:20px;background:#fbf8f4;border:1px solid #e4dbcf;color:#44403c;font-size:15px;line-height:1.7;white-space:pre-wrap">${escapeHtml(
        request.message
      )}</div>`,
      primaryAction: { label: "Review request", url: `${getAppUrl()}/admin` },
      footerMessage: "This alert was generated from the TailorGraph support center."
    })
  };
}

export async function sendOrderPurchasedNotifications(context: OrderNotificationContext) {
  const buyerEmail = purchaseBuyerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:buyer_email`,
    eventType: "purchase_confirmation",
    durable: true,
    to: context.buyer.email,
    category: "buyer_orders",
    ...buyerEmail
  });

  const sellerEmail = purchaseSellerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:seller_email`,
    eventType: "seller_order_alert",
    durable: true,
    to: context.seller.email,
    category: "seller_orders",
    ...sellerEmail
  });
}

export async function sendOrderShippedNotifications(context: OrderNotificationContext) {
  const buyerEmail = shipmentBuyerEmail(context);
  await sendEmailNotification({
    eventKey: `shipment:${context.order.id}:buyer_email`,
    eventType: "shipment_update",
    durable: true,
    to: context.buyer.email,
    category: "buyer_orders",
    ...buyerEmail
  });

  if (context.buyer.phoneNumber && context.buyer.notificationPreferences.shipmentSms) {
    await sendSmsNotification({
      eventKey: `shipment:${context.order.id}:buyer_sms`,
      eventType: "shipment_sms",
      to: context.buyer.phoneNumber,
      body: shipmentBuyerSms(context)
    });
  }

  if (context.order.shippingLabelUrl || context.order.shippingQrCodeUrl) {
    await sendSellerShipmentLabelNotification(context);
  }
}

export async function sendSellerShipmentLabelNotification(
  context: OrderNotificationContext,
  options?: { eventKey?: string; skipDedupe?: boolean }
) {
  const sellerEmail = shipmentSellerEmail(context);
  await sendEmailNotification({
    eventKey: options?.eventKey ?? `shipment:${context.order.id}:seller_label_email`,
    eventType: "seller_shipment_label",
    durable: true,
    to: context.seller.email,
    category: "seller_orders",
    skipDedupe: options?.skipDedupe,
    ...sellerEmail
  });
}

export async function sendBuyerReturnLabelNotification(
  context: OrderNotificationContext,
  options?: { eventKey?: string; skipDedupe?: boolean }
) {
  const buyerEmail = returnLabelBuyerEmail(context);
  await sendEmailNotification({
    eventKey: options?.eventKey ?? `return:${context.order.id}:buyer_label_email`,
    eventType: "buyer_return_label",
    durable: true,
    to: context.buyer.email,
    category: "buyer_orders",
    skipDedupe: options?.skipDedupe,
    ...buyerEmail
  });
}

export async function sendDirectMessageNotification(context: DirectMessageNotificationContext) {
  if (!shouldSendOptionalEmail(context.recipient, "messagesEmail")) {
    return;
  }

  const recipientEmail = directMessageEmail(context);
  await sendEmailNotification({
    eventKey: `dm:${context.messageId}:email`,
    eventType: "direct_message",
    durable: true,
    messageId: context.messageId,
    recipientUserId: context.recipient.id,
    preferenceKey: "messagesEmail",
    to: context.recipient.email,
    category: "messages",
    ...recipientEmail
  });
}

export async function sendNewListingFollowerNotification(context: NewListingNotificationContext) {
  if (!shouldSendOptionalEmail(context.recipient, "savedSellerEmail")) {
    return;
  }

  const email = newListingFollowerEmail(context);
  await sendEmailNotification({
    eventKey: `listing:${context.listing.id}:follower:${context.recipient.id}:email`,
    eventType: "new_listing",
    durable: true,
    recipientUserId: context.recipient.id,
    preferenceKey: "savedSellerEmail",
    to: context.recipient.email,
    category: "alerts",
    ...email
  });
}

export async function sendEmailVerificationNotification(context: AccountEmailVerificationContext) {
  const email = emailVerificationEmail(context);
  await sendEmailNotification({
    eventKey: `email-verification:${context.user.id}:${createHash("sha256").update(context.verificationUrl).digest("hex")}`,
    eventType: "email_verification",
    to: context.user.email,
    category: "no_reply",
    ...email
  });
}

export async function sendPasswordResetNotification(context: PasswordResetNotificationContext) {
  const email = passwordResetEmail(context);
  await sendEmailNotification({
    eventKey: `password-reset:${context.user.id}:${createHash("sha256").update(context.resetUrl).digest("hex")}`,
    eventType: "password_reset",
    to: context.user.email,
    category: "no_reply",
    ...email
  });
}

export async function sendWelcomeNotification(context: WelcomeNotificationContext) {
  if (!shouldSendOptionalEmail(context.user, "helloEmail")) {
    return;
  }

  const email = welcomeEmail(context);
  await sendEmailNotification({
    eventKey: `welcome:${context.user.id}:${context.user.email}`,
    eventType: "welcome",
    durable: true,
    recipientUserId: context.user.id,
    preferenceKey: "helloEmail",
    to: context.user.email,
    category: "hello",
    ...email
  });
}

export async function sendSupportRequestNotifications(context: SupportRequestNotificationContext) {
  const confirmation = supportRequestConfirmationEmail(context);
  await sendEmailNotification({
    eventKey: `support-request:${context.request.id}:requester`,
    eventType: "support_request_confirmation",
    durable: true,
    to: context.request.requesterEmail,
    category: "support",
    ...confirmation
  });

  const adminRecipients = getAdminEmails();
  if (!adminRecipients.length) {
    return;
  }

  const internal = supportRequestInternalEmail(context);
  for (const adminEmail of adminRecipients) {
    await sendEmailNotification({
      eventKey: `support-request:${context.request.id}:admin:${adminEmail}`,
      eventType: "support_request_alert",
    durable: true,
      to: adminEmail,
      category: "support",
      ...internal
    });
  }
}

export async function sendSenderTestNotification(input: {
  to: string;
  category: EmailSenderCategory;
  runToken?: string;
  skipDedupe?: boolean;
}) {
  const sender = getEmailSenderForCategory(input.category);
  const parsedSender = parseEmailSender(sender);
  const senderAddress = parsedSender?.address ?? sender;
  const senderLabel = parsedSender?.name ? `${parsedSender.name} <${parsedSender.address}>` : senderAddress;
  const replyTo = getReplyToForCategory(input.category, sender);
  const replyBehavior =
    replyTo
      ? `Replies should go back to ${replyTo}.`
      : "This sender is configured without a reply-to address.";

  await sendEmailNotification({
    eventKey: input.runToken
      ? `sender-test:${input.runToken}:${input.category}:${input.to.toLowerCase()}`
      : `sender-test:${input.category}:${input.to}:${Date.now()}`,
    eventType: "sender_test",
      to: input.to,
      category: input.category,
      skipDedupe: input.skipDedupe,
      subject: `TailorGraph sender test: ${senderAddress}`,
    text: `This is a TailorGraph sender test.\n\nCategory: ${input.category}\nFrom: ${senderLabel}\n${replyBehavior}`,
    html: renderEmailLayout({
      eyebrow: "Sender Test",
      title: "TailorGraph sender test",
      details: [
        { label: "Category", value: input.category },
        { label: "From", value: senderLabel }
      ],
      introParagraphs: [replyBehavior],
      footerMessage: "This is an internal sender verification email for TailorGraph."
    })
  });
}

export function getEstimatedArrivalLabel(order: Order, listing: Listing | null) {
  const purchasedAt = new Date(order.createdAt);
  const estimatedShipBy = addBusinessDays(purchasedAt, listing?.processingDays ?? 3);
  return formatShortDate(addBusinessDays(estimatedShipBy, 5));
}

export async function sendReturnEmail(to: string, eventKey: string, subject: string, text: string, url: string, button = "View return") {
  if (!isEmailNotificationConfigured()) throw new Error("Return email delivery is not configured");
  await sendEmailNotification({ to, eventKey, eventType: "return_update", category: "support", subject, text: `${text}\n\n${button}: ${url}`,
    html: renderEmailLayout({ title: subject, introParagraphs: [text], primaryAction: { label: button, url } }) });
}

function offerReceivedEmail(offer: Offer) {
  const url = `${getAppUrl()}/seller?offerStatus=active`;
  return {
    subject: `New offer on ${offer.listingTitle}`,
    digestSummary: `@${offer.buyerUsername} offered ${formatCurrency(offer.amount)} for ${offer.listingTitle}. This is an offer, not a paid order.`,
    digestAction: { label: "Review offer", url },
    text: `@${offer.buyerUsername} offered ${formatCurrency(offer.amount)} for ${offer.listingTitle}. This is an offer, not a paid order.\n\nReview offer: ${url}\nEmail preferences: ${getAppUrl()}/account/notifications`,
    html: renderEmailLayout({
      eyebrow: "Offers", title: "An offer for your item", optional: true,
      introParagraphs: [`@${offer.buyerUsername} has made an offer. Review it in your seller dashboard.`, "This is an offer, not a paid order."],
      details: [{ label: "Item", value: offer.listingTitle }, { label: "Offer", value: formatCurrency(offer.amount) }],
      primaryAction: { label: "Review offer", url }
    })
  };
}

export async function sendOfferReceivedNotification(offer: Offer, seller: User) {
  if (!seller.notificationPreferences.offerAndPriceDropEmail) return;
  await sendEmailNotification({
    eventKey: `offer:${offer.id}:seller_email`, eventType: "offer_received", durable: true,
    to: seller.email, recipientUserId: seller.id, preferenceKey: "offerAndPriceDropEmail",
    category: "seller_orders", ...offerReceivedEmail(offer)
  });
}

// Pure rendering entry points for local previews; these never call a delivery provider.
export const emailPreviews = {
  purchaseBuyerEmail, purchaseSellerEmail, shipmentBuyerEmail, shipmentSellerEmail,
  returnLabelBuyerEmail, directMessageEmail, newListingFollowerEmail, offerReceivedEmail,
  welcomeEmail, emailVerificationEmail, passwordResetEmail, supportRequestConfirmationEmail
};
