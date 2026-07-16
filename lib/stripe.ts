import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const DEFAULT_BALANCE_CURRENCY = "usd";

type StripeBalanceEntry = {
  amount: number;
  currency: string;
};

export type StripeBalanceSummary = {
  currency: string;
  availableCents: number;
  pendingCents: number;
  instantAvailableCents: number;
  hasOtherCurrencies: boolean;
};

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

function sumBalanceEntries(entries: StripeBalanceEntry[] | undefined, currency: string) {
  return (entries ?? [])
    .filter((entry) => entry.currency.toLowerCase() === currency)
    .reduce((total, entry) => total + entry.amount, 0);
}

export function summarizeStripeBalance(balance: Stripe.Balance, currency = DEFAULT_BALANCE_CURRENCY): StripeBalanceSummary {
  const normalizedCurrency = currency.toLowerCase();
  const allEntries = [...balance.available, ...balance.pending, ...(balance.instant_available ?? [])];

  return {
    currency: normalizedCurrency,
    availableCents: sumBalanceEntries(balance.available, normalizedCurrency),
    pendingCents: sumBalanceEntries(balance.pending, normalizedCurrency),
    instantAvailableCents: sumBalanceEntries(balance.instant_available ?? [], normalizedCurrency),
    hasOtherCurrencies: allEntries.some((entry) => entry.currency.toLowerCase() !== normalizedCurrency)
  };
}

export async function retrieveConnectedAccountBalance(stripeAccountId: string) {
  return getStripe().balance.retrieve({}, { stripeAccount: stripeAccountId });
}
