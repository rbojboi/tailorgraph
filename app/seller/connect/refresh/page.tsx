import Link from "next/link";
import { createStripeConnectOnboardingAction } from "@/app/actions";

export default function SellerConnectRefreshPage() {
  return (
    <main className="grain px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <section className="panel rounded-[2rem] p-8">
          <p className="eyebrow text-xs text-stone-500">Stripe Connect</p>
          <h1 className="mt-4 text-3xl font-semibold text-stone-950">Seller onboarding needs another pass</h1>
          <p className="mt-4 text-sm leading-7 text-stone-700">
            Stripe sent the seller back here to refresh the onboarding flow. Use the button below to continue.
          </p>
          <div className="mt-6 flex gap-3">
            <form action={createStripeConnectOnboardingAction}>
              <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                Resume onboarding
              </button>
            </form>
            <Link
              href="/"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
            >
              Back
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
