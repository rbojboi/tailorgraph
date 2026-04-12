import { Resend } from "resend";
import twilio from "twilio";
import { getAppUrl } from "@/lib/stripe";
import { hasNotificationDelivery, recordNotificationDelivery } from "@/lib/store";
import type { Listing, MessageThread, Order, User } from "@/lib/types";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailReplyTo = process.env.EMAIL_REPLY_TO;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

let resendClient: Resend | null = null;
let twilioClient: ReturnType<typeof twilio> | null = null;

type EmailInput = {
  eventKey: string;
  eventType: string;
  to: string;
  subject: string;
  html: string;
  text: string;
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

export function isEmailNotificationConfigured() {
  return Boolean(resendApiKey && emailFrom);
}

export function isSmsNotificationConfigured() {
  return Boolean(twilioAccountSid && twilioAuthToken && twilioFromNumber);
}

function getResendClient() {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }

  return resendClient;
}

function getTwilioClient() {
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

  await getResendClient().emails.send({
    from: emailFrom!,
    to: [recipient],
    replyTo: emailReplyTo || undefined,
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

function purchaseBuyerEmail(context: OrderNotificationContext) {
  const { order, listing, seller } = context;
  const itemTitle = escapeHtml(order.listingTitle);
  const sellerName = escapeHtml(`@${seller.username || order.sellerName}`);
  const orderUrl = `${getAppUrl()}/buyer/orders`;
  const imageHtml =
    listing?.media[0]?.kind === "image"
      ? `<p style="margin:0 0 16px"><img src="${escapeHtml(listing.media[0].url)}" alt="${itemTitle}" style="max-width:220px;border-radius:16px;display:block" /></p>`
      : "";

  return {
    subject: `TailorGraph purchase confirmed: ${order.listingTitle}`,
    text: `Your TailorGraph purchase is confirmed.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTotal paid: ${formatCurrency(order.amount)}\n\nYou can review tracking and delivery updates in My Purchases: ${orderUrl}`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">Purchase confirmed</h1>
        ${imageHtml}
        <p style="margin:0 0 12px">Thank you for your purchase on TailorGraph.</p>
        <p style="margin:0 0 8px"><strong>Item:</strong> ${itemTitle}</p>
        <p style="margin:0 0 8px"><strong>Seller:</strong> ${sellerName}</p>
        <p style="margin:0 0 16px"><strong>Total paid:</strong> ${escapeHtml(formatCurrency(order.amount))}</p>
        <p style="margin:0"><a href="${orderUrl}">View My Purchases</a></p>
      </div>
    `
  };
}

function purchaseSellerEmail(context: OrderNotificationContext) {
  const { order, buyer } = context;
  const sellerUrl = `${getAppUrl()}/seller`;

  return {
    subject: `TailorGraph order received: ${order.listingTitle}`,
    text: `You have a new TailorGraph order.\n\nItem: ${order.listingTitle}\nBuyer: ${buyer.name}\nTotal paid: ${formatCurrency(order.amount)}\n\nReview and ship it from the seller dashboard: ${sellerUrl}`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">New order received</h1>
        <p style="margin:0 0 8px"><strong>Item:</strong> ${escapeHtml(order.listingTitle)}</p>
        <p style="margin:0 0 8px"><strong>Buyer:</strong> ${escapeHtml(buyer.name)}</p>
        <p style="margin:0 0 16px"><strong>Total paid:</strong> ${escapeHtml(formatCurrency(order.amount))}</p>
        <p style="margin:0"><a href="${sellerUrl}">Open Seller Dashboard</a></p>
      </div>
    `
  };
}

function shipmentBuyerEmail(context: OrderNotificationContext) {
  const { order, seller } = context;
  const buyerUrl = `${getAppUrl()}/buyer/orders`;
  const tracking = order.trackingNumber ? `${order.carrier || "Carrier"} - ${order.trackingNumber}` : "Tracking pending";

  return {
    subject: `TailorGraph shipment update: ${order.listingTitle}`,
    text: `Your order has shipped.\n\nItem: ${order.listingTitle}\nSeller: @${seller.username || order.sellerName}\nTracking: ${tracking}\n\nReview shipping updates here: ${buyerUrl}`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">Your order has shipped</h1>
        <p style="margin:0 0 8px"><strong>Item:</strong> ${escapeHtml(order.listingTitle)}</p>
        <p style="margin:0 0 8px"><strong>Seller:</strong> @${escapeHtml(seller.username || order.sellerName)}</p>
        <p style="margin:0 0 16px"><strong>Tracking:</strong> ${escapeHtml(tracking)}</p>
        <p style="margin:0"><a href="${buyerUrl}">View My Purchases</a></p>
      </div>
    `
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
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">New message</h1>
        <p style="margin:0 0 12px">You have a new message from <strong>@${escapeHtml(senderName)}</strong>.</p>
        <p style="margin:0 0 16px">"${escapeHtml(preview)}"</p>
        <p style="margin:0"><a href="${messagesUrl}">Open Messages</a></p>
      </div>
    `
  };
}

function newListingFollowerEmail(context: NewListingNotificationContext) {
  const listingUrl = `${getAppUrl()}/listings/${context.listing.id}`;
  const sellerName = context.seller.username || context.seller.name;

  return {
    subject: `New TailorGraph listing from @${sellerName}`,
    text: `@${sellerName} just listed a new item on TailorGraph.\n\n${context.listing.title}\n${formatCurrency(context.listing.price)}\n\nView listing: ${listingUrl}`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">New listing from @${escapeHtml(sellerName)}</h1>
        <p style="margin:0 0 8px"><strong>${escapeHtml(context.listing.title)}</strong></p>
        <p style="margin:0 0 16px">${escapeHtml(formatCurrency(context.listing.price))}</p>
        <p style="margin:0"><a href="${listingUrl}">View listing</a></p>
      </div>
    `
  };
}

function emailVerificationEmail(context: AccountEmailVerificationContext) {
  return {
    subject: "Verify your TailorGraph email address",
    text: `Verify your TailorGraph email address by opening this link:\n\n${context.verificationUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">Verify your email</h1>
        <p style="margin:0 0 12px">Open the link below to confirm that this email address belongs to your TailorGraph account.</p>
        <p style="margin:0 0 16px"><a href="${context.verificationUrl}">Verify my email address</a></p>
        <p style="margin:0">If you did not request this, you can safely ignore this message.</p>
      </div>
    `
  };
}

function passwordResetEmail(context: PasswordResetNotificationContext) {
  return {
    subject: "Reset your TailorGraph password",
    text: `Reset your TailorGraph password by opening this link:\n\n${context.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Georgia,serif;line-height:1.5;color:#292524">
        <h1 style="font-size:28px;margin:0 0 16px">Reset your password</h1>
        <p style="margin:0 0 12px">Open the link below to choose a new password for your TailorGraph account.</p>
        <p style="margin:0 0 16px"><a href="${context.resetUrl}">Reset my password</a></p>
        <p style="margin:0">If you did not request this, you can safely ignore this message.</p>
      </div>
    `
  };
}

export async function sendOrderPurchasedNotifications(context: OrderNotificationContext) {
  const buyerEmail = purchaseBuyerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:buyer_email`,
    eventType: "purchase_confirmation",
    to: context.buyer.email,
    ...buyerEmail
  });

  const sellerEmail = purchaseSellerEmail(context);
  await sendEmailNotification({
    eventKey: `purchase:${context.order.id}:seller_email`,
    eventType: "seller_order_alert",
    to: context.seller.email,
    ...sellerEmail
  });
}

export async function sendOrderShippedNotifications(context: OrderNotificationContext) {
  const buyerEmail = shipmentBuyerEmail(context);
  await sendEmailNotification({
    eventKey: `shipment:${context.order.id}:buyer_email`,
    eventType: "shipment_update",
    to: context.buyer.email,
    ...buyerEmail
  });

  if (context.buyer.phoneNumber) {
    await sendSmsNotification({
      eventKey: `shipment:${context.order.id}:buyer_sms`,
      eventType: "shipment_sms",
      to: context.buyer.phoneNumber,
      body: shipmentBuyerSms(context)
    });
  }
}

export async function sendDirectMessageNotification(context: DirectMessageNotificationContext) {
  const recipientEmail = directMessageEmail(context);
  await sendEmailNotification({
    eventKey: `dm:${context.messageId}:email`,
    eventType: "direct_message",
    to: context.recipient.email,
    ...recipientEmail
  });
}

export async function sendNewListingFollowerNotification(context: NewListingNotificationContext) {
  const email = newListingFollowerEmail(context);
  await sendEmailNotification({
    eventKey: `listing:${context.listing.id}:follower:${context.recipient.id}:email`,
    eventType: "new_listing",
    to: context.recipient.email,
    ...email
  });
}

export async function sendEmailVerificationNotification(context: AccountEmailVerificationContext) {
  const email = emailVerificationEmail(context);
  await sendEmailNotification({
    eventKey: `email-verification:${context.user.id}:${context.user.email}`,
    eventType: "email_verification",
    to: context.user.email,
    ...email
  });
}

export async function sendPasswordResetNotification(context: PasswordResetNotificationContext) {
  const email = passwordResetEmail(context);
  await sendEmailNotification({
    eventKey: `password-reset:${context.user.id}:${context.user.email}`,
    eventType: "password_reset",
    to: context.user.email,
    ...email
  });
}

export function getEstimatedArrivalLabel(order: Order, listing: Listing | null) {
  const purchasedAt = new Date(order.createdAt);
  const estimatedShipBy = addBusinessDays(purchasedAt, listing?.processingDays ?? 3);
  return formatShortDate(addBusinessDays(estimatedShipBy, 5));
}
