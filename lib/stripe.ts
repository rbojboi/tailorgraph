import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function isStripeConfigured() {
  return Boolean(stripeSecretKey);
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover"
  });
}
