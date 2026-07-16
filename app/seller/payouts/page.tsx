import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createStripeConnectOnboardingAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setupErrorMessage(error: string | undefined) {
  if (!error) {
    return null;
  }

  if (error === "connect_platform_not_enabled") {
    return "TailorGraph needs to finish enabling Stripe Connect before seller payout onboarding can open.";
  }

  if (error === "onboarding_incomplete") {
    return "Stripe returned you to TailorGraph, but payouts are not fully enabled yet. Continue payout setup to finish any remaining Stripe requirements.";
  }

  return "Stripe could not start payout setup. Please try again in a moment.";
}

export default async function SellerPayoutsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+for+payout+setup");
  }

  const params = await searchParams;
  const setupError = firstValue(params.setupError);
  const stripeEnabled = isStripeConfigured();
  const isAdmin = isAdminUser(user);
  let stripeAccount: Stripe.Account | null = null;

  if (stripeEnabled && user.stripeAccountId) {
    try {
      stripeAccount = await getStripe().accounts.retrieve(user.stripeAccountId);
    } catch {
      stripeAccount = null;
    }
  }

  const detailsSubmitted = Boolean(stripeAccount?.details_submitted);
  const chargesEnabled = Boolean(stripeAccount?.charges_enabled);
  const payoutsEnabled = Boolean(stripeAccount?.payouts_enabled);
  const ready = detailsSubmitted && chargesEnabled && payoutsEnabled;
  const friendlyError = ready ? null : setupErrorMessage(setupError);
  const currentlyDue = stripeAccount?.requirements?.currently_due ?? [];

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Seller Payouts"
                title="Set Up Seller Payouts"
                description="Connect Stripe so TailorGraph can route buyer payments to your seller account."
              />
            </div>
            <Link
              href="/seller"
              className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
            >
              Back to Seller
            </Link>
          </div>

          {friendlyError ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">{friendlyError}</p>
              {setupError === "connect_platform_not_enabled" && isAdmin ? (
                <p className="mt-2">
                  Platform admins can enable Connect from{" "}
                  <a
                    href="https://dashboard.stripe.com/connect"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline decoration-amber-400 underline-offset-4"
                  >
                    Stripe Connect settings
                  </a>
                  .
                </p>
              ) : null}
              {setupError && setupError !== "connect_platform_not_enabled" && isAdmin ? (
                <p className="mt-2 text-amber-900">Technical detail: {setupError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Spec label="Stripe configured" value={stripeEnabled ? "Yes" : "No"} />
            <Spec label="Connected account" value={user.stripeAccountId || "Not connected"} />
            <Spec label="Charges enabled" value={chargesEnabled ? "Yes" : "No"} />
            <Spec label="Payouts enabled" value={payoutsEnabled ? "Yes" : "No"} />
          </div>

          {currentlyDue.length ? (
            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">Stripe needs these items</p>
              <p className="mt-2 text-sm leading-6 text-stone-700">{currentlyDue.join(", ")}</p>
            </div>
          ) : null}

          {!ready ? (
            <div className="mt-6 rounded-[1.5rem] border border-stone-300 bg-white p-5">
              <p className="text-sm font-semibold text-stone-950">What happens on Stripe</p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                Stripe may start by saying <span className="font-semibold text-stone-950">Sign in</span>, even if this is
                your first time setting up seller payouts. Use the same email as this TailorGraph account:
                <span className="font-semibold text-stone-950"> {user.email}</span>.
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                If Stripe shows a different email, sign out of Stripe or open this setup in a private browser window,
                then come back here and restart payout setup.
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {stripeEnabled ? (
              <form action={createStripeConnectOnboardingAction}>
                <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
                  {user.stripeAccountId ? "Continue on Stripe" : "Continue to Stripe"}
                </button>
              </form>
            ) : (
              <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
                Stripe environment variables are not configured yet.
              </p>
            )}
            {ready ? (
              <span className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-950">
                Payouts ready
              </span>
            ) : null}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
