import { Resend } from "resend";
import twilio from "twilio";
import { getAdminEmails } from "@/lib/admin";
import { getAppUrl } from "@/lib/stripe";
import { hasNotificationDelivery, recordNotificationDelivery } from "@/lib/store";
import type { Listing, MessageThread, Order, SupportRequest, User } from "@/lib/types";

let resendClient: Resend | null = null;
let twilioClient: ReturnType<typeof twilio> | null = null;

type EmailInput = {
  eventKey: string;
  eventType: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: EmailSenderCategory;
  fromOverride?: string;
  replyToOverride?: string;
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

type EmailAction = {
  label: string;
  url: string;
};

type EmailDetail = {
  label: string;
  value: string;
};

type EmailLayoutInput = {
  eyebrow?: string;
  title: string;
  introParagraphs?: string[];
  bodyHtml?: string;
  details?: EmailDetail[];
  primaryAction?: EmailAction;
  secondaryAction?: EmailAction;
  footerMessage?: string;
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
  preferenceKey: keyof User["notificationPreferences"]
) {
  return Boolean(user.notificationPreferences[preferenceKey]);
}

async function sendEmailNotification(input: EmailInput) {
  if (!isEmailNotificationConfigured()) {
    return;
  }

  const recipient = input.to.trim();
  if (!recipient) {
    return;
  }

  if (await hasNotificationDelivery(input.eventKey)) {
    return;
  }

  const category = input.category ?? "no_reply";
  const from = input.fromOverride || getEmailSenderForCategory(category);
  const parsedSender = parseEmailSender(from);
  const emailReplyTo =
    input.replyToOverride ?? (category === "no_reply" ? undefined : parsedSender?.address || process.env.EMAIL_REPLY_TO || undefined);

  await getResendClient().emails.send({
    from,
    to: [recipient],
    replyTo: emailReplyTo,
    subject: input.subject,
    html: input.html,
    text: input.text
  });

  await recordNotificationDelivery({
    eventKey: input.eventKey,
    channel: "email",
    recipient,
    eventType: input.eventType
  });
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

function renderEmailAction(action: EmailAction, variant: "primary" | "secondary" = "primary") {
  const background = variant === "primary" ? "#1f4d3b" : "#efe7dc";
  const color = variant === "primary" ? "#f7f3ee" : "#1f4d3b";
  const border = variant === "primary" ? "none" : "1px solid #d8cfc3";

  return `<a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:${background};color:${color};text-decoration:none;font-weight:600;border:${border}">${escapeHtml(action.label)}</a>`;
}

function renderEmailDetails(details: EmailDetail[]) {
  if (!details.length) {
    return "";
  }

  return `
    <div style="margin:20px 0 0;padding:16px 18px;border:1px solid #e4dbcf;border-radius:18px;background:#fbf8f4">
      ${details
        .map(
          (detail, index) => `
            <div style="padding:${index === 0 ? "0" : "12px 0 0"};margin:${index === details.length - 1 ? "0" : "0 0 12px"};${index === details.length - 1 ? "" : "border-bottom:1px solid #ebe2d6;"}">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#7c6f64;margin:0 0 4px">${escapeHtml(detail.label)}</div>
              <div style="font-size:16px;color:#292524">${escapeHtml(detail.value)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderEmailLayout(input: EmailLayoutInput) {
  const appUrl = getAppUrl();
  const supportUrl = `${appUrl}/support`;
  const footerMessage = input.footerMessage ?? "Need help? Visit TailorGraph Support.";
  const introHtml = (input.introParagraphs ?? [])
    .map((paragraph) => `<p style="margin:0 0 12px;color:#44403c;font-size:16px;line-height:1.65">${escapeHtml(paragraph)}</p>`)
    .join("");
  const detailsHtml = renderEmailDetails(input.details ?? []);
  const actionHtml = [
    input.primaryAction ? renderEmailAction(input.primaryAction, "primary") : "",
    input.secondaryAction ? renderEmailAction(input.secondaryAction, "secondary") : ""
  ]
    .filter(Boolean)
    .join('<span style="display:inline-block;width:12px"></span>');

  return `
    <div style="margin:0;padding:24px;background:#f3eee7;font-family:Georgia,serif;color:#292524">
      <div style="max-width:640px;margin:0 auto">
        <div style="margin:0 0 14px">
          <span style="display:inline-block;padding:7px 12px;border-radius:999px;background:#e7ded1;color:#5f5146;font-size:12px;letter-spacing:0.12em;text-transform:uppercase">${escapeHtml(
            input.eyebrow ?? "TailorGraph"
          )}</span>
        </div>
        <div style="background:#fffdf9;border:1px solid #e4dbcf;border-radius:28px;padding:32px 28px;box-shadow:0 10px 30px rgba(41,37,36,0.06)">
          <h1 style="margin:0 0 18px;font-size:32px;line-height:1.15;color:#1c1917">${escapeHtml(input.title)}</h1>
          ${introHtml}
          ${input.bodyHtml ?? ""}
          ${detailsHtml}
          ${actionHtml ? `<div style="margin:24px 0 0">${actionHtml}</div>` : ""}
        </div>
        <div style="padding:18px 8px 0;color:#6b5f55;font-size:13px;line-height:1.6">
          <p style="margin:0 0 8px">${escapeHtml(footerMessage)}</p>
          <p style="margin:0"><a href="${escapeHtml(supportUrl)}" style="color:#1f4d3b;text-decoration:none">Support</a> | <a href="${escapeHtml(
            appUrl
          )}" style="color:#1f4d3b;text-decoration:none">TailorGraph</a></p>
        </div>
      </div>
    </div>
  `;
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
    text: `Your TailorGraph purchase is confirmed.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTotal paid: ${formatCurrency(order.amount)}\n\nYou can review tracking and delivery updates in My Purchases: ${orderUrl}`,
    html: renderEmailLayout({
      eyebrow: "Buyer Orders",
      title: "Purchase confirmed",
      introParagraphs: [
        "Thank you for your purchase on TailorGraph.",
        "We will keep you updated as the seller ships your order."
      ],
      bodyHtml: imageHtml,
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Seller", value: `@${seller.username || order.sellerName}` },
        { label: "Total paid", value: formatCurrency(order.amount) }
      ],
      primaryAction: {
        label: "View My Purchases",
        url: orderUrl
      }
    })
  };
}

function purchaseSellerEmail(context: OrderNotificationContext) {
  const { order, buyer } = context;
  const sellerUrl = `${getAppUrl()}/seller`;

  return {
    subject: `TailorGraph order received: ${order.listingTitle}`,
    text: `You have a new TailorGraph order.\n\nItem: ${order.listingTitle}\nBuyer: ${buyer.name}\nTotal paid: ${formatCurrency(order.amount)}\n\nReview and ship it from the seller dashboard: ${sellerUrl}`,
    html: renderEmailLayout({
      eyebrow: "Seller Orders",
      title: "New order received",
      introParagraphs: [
        "A new order just came through on TailorGraph.",
        "Review the order details and get shipping started from your seller dashboard."
      ],
      details: [
        { label: "Item", value: order.listingTitle },
        { label: "Buyer", value: buyer.name },
        { label: "Total paid", value: formatCurrency(order.amount) }
      ],
      primaryAction: {
        label: "Open Seller Dashboard",
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
    text: `Your order has shipped.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTracking: ${tracking}\n\nReview shipping updates here: ${buyerUrl}`,
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
        label: "View My Purchases",
        url: buyerUrl
      }
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
    text: `You have a new TailorGraph message from @${senderName}.\n\n"${preview}"\n\nReply here: ${messagesUrl}`,
    html: renderEmailLayout({
      eyebrow: "Messages",
      title: "New message",
      introParagraphs: [`You have a new message from @${senderName}.`],
      bodyHtml: `<div style="margin:18px 0 0;padding:18px;border-radius:20px;background:#fbf8f4;border:1px solid #e4dbcf;color:#44403c;font-size:16px;line-height:1.65">"${escapeHtml(
        preview
      )}"</div>`,
      primaryAction: {
        label: "Open Messages",
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
    text: `@${sellerName} just listed a new item on TailorGraph.\n\n${context.listing.title}\n${formatCurrency(context.listing.price)}\n\nView listing: ${listingUrl}`,
    html: renderEmailLayout({
      eyebrow: "Alerts",
      title: `New listing from @${sellerName}`,
      introParagraphs: ["A seller you follow just listed something new on TailorGraph."],
      details: [
        { label: "Listing", value: context.listing.title },
        { label: "Price", value: formatCurrency(context.listing.price) }
      ],
      primaryAction: {
        label: "View Listing",
        url: listingUrl
      }
    })
  };
}

function emailVerificationEmail(context: AccountEmailVerificationContext) {
  return {
    subject: "Verify your TailorGraph email address",
    text: `Verify your TailorGraph email address by opening this link:\n\n${context.verificationUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: renderEmailLayout({
      eyebrow: "Account",
      title: "Verify your email",
      introParagraphs: [
        "Open the link below to confirm that this email address belongs to your TailorGraph account.",
        "If you did not request this, you can safely ignore this message."
      ],
      primaryAction: {
        label: "Verify my email address",
        url: context.verificationUrl
      },
      footerMessage: "This verification link was sent because a TailorGraph account used this email address."
    })
  };
}

function passwordResetEmail(context: PasswordResetNotificationContext) {
  return {
    subject: "Reset your TailorGraph password",
    text: `Reset your TailorGraph password by opening this link:\n\n${context.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: renderEmailLayout({
      eyebrow: "Account",
      title: "Reset your password",
      introParagraphs: [
        "Open the link below to choose a new password for your TailorGraph account.",
        "If you did not request this, you can safely ignore this message."
      ],
      primaryAction: {
        label: "Reset my password",
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
    text: `Welcome to TailorGraph.\n\nStart with your measurements: ${measurementsUrl}\nBrowse the marketplace: ${marketplaceUrl}\nNeed help? Visit Support: ${supportUrl}`,
    html: renderEmailLayout({
      eyebrow: "Hello",
      title: "Welcome to TailorGraph",
      introParagraphs: [
        "Your account is ready.",
        "The best next step is saving the measurements that fit you well so TailorGraph can work in your favor."
      ],
      primaryAction: {
        label: "Start with your measurements",
        url: measurementsUrl
      },
      secondaryAction: {
        label: "Browse the marketplace",
        url: marketplaceUrl
      },
      footerMessage: `Need help getting started? Visit TailorGraph Support: ${supportUrl}`
    })
  };
}

function supportRequestConfirmationEmail(context: SupportRequestNotificationContext) {
  const supportUrl = `${getAppUrl()}/support`;
  return {
    subject: `TailorGraph support request received: ${context.request.subject}`,
    text: `We received your TailorGraph ${context.request.kind} request.\n\nSubject: ${context.request.subject}\nTopic: ${context.request.topic}\n\nWe're looking into it and will follow up as needed. You can revisit support here: ${supportUrl}`,
    html: renderEmailLayout({
      eyebrow: "Support",
      title: "We received your request",
      introParagraphs: ["We're looking into it and will follow up as needed."],
      details: [
        { label: "Subject", value: context.request.subject },
        { label: "Topic", value: context.request.topic }
      ],
      primaryAction: {
        label: "Return to Support",
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
    text: `${subject}\n\nRequester: ${request.requesterName} <${request.requesterEmail}>\nRole: ${request.requesterRole}\nKind: ${request.kind}\nTopic: ${request.topic}\nOrder ID: ${request.orderId || "None"}\nListing ID: ${request.listingId || "None"}\n\n${request.message}`,
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
      footerMessage: "This alert was generated from the TailorGraph support center."
    })
  };
}

export async function sendOrderPurchasedNotifications(context: OrderNotificationContext) {
  const buyerEmail = purchaseBuyerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:buyer_email`,
    eventType: "purchase_confirmation",
    to: context.buyer.email,
    category: "buyer_orders",
    ...buyerEmail
  });

  const sellerEmail = purchaseSellerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:seller_email`,
    eventType: "seller_order_alert",
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
}

export async function sendDirectMessageNotification(context: DirectMessageNotificationContext) {
  if (!shouldSendOptionalEmail(context.recipient, "messagesEmail")) {
    return;
  }

  const recipientEmail = directMessageEmail(context);
  await sendEmailNotification({
    eventKey: `dm:${context.messageId}:email`,
    eventType: "direct_message",
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
    to: context.recipient.email,
    category: "alerts",
    ...email
  });
}

export async function sendEmailVerificationNotification(context: AccountEmailVerificationContext) {
  const email = emailVerificationEmail(context);
  await sendEmailNotification({
    eventKey: `email-verification:${context.user.id}:${context.user.email}`,
    eventType: "email_verification",
    to: context.user.email,
    category: "no_reply",
    ...email
  });
}

export async function sendPasswordResetNotification(context: PasswordResetNotificationContext) {
  const email = passwordResetEmail(context);
  await sendEmailNotification({
    eventKey: `password-reset:${context.user.id}:${context.user.email}`,
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
      to: adminEmail,
      category: "support",
      ...internal
    });
  }
}

export async function sendSenderTestNotification(input: { to: string; category: EmailSenderCategory }) {
  const sender = getEmailSenderForCategory(input.category);
  const parsedSender = parseEmailSender(sender);
  const senderAddress = parsedSender?.address ?? sender;
  const senderLabel = parsedSender?.name ? `${parsedSender.name} <${parsedSender.address}>` : senderAddress;
  const replyBehavior =
    input.category === "no_reply"
      ? "This sender is configured without a reply-to address."
      : `Replies should go back to ${senderAddress}.`;

  await sendEmailNotification({
    eventKey: `sender-test:${input.category}:${input.to}:${Date.now()}`,
    eventType: "sender_test",
    to: input.to,
    category: input.category,
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
