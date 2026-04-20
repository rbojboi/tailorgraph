import { redirect } from "next/navigation";
import { updateNotificationPreferencesAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalEmailPreferences = [
  {
    key: "messagesEmail",
    title: "Messages",
    description: "Buyer-seller conversation updates."
  },
  {
    key: "fitEmail",
    title: "Fit Feed",
    description: "New marketplace items that fit your measurements."
  },
  {
    key: "savedSearchEmail",
    title: "Saved Searches",
    description: "Alerts when new listings match your saved search criteria."
  },
  {
    key: "savedSellerEmail",
    title: "Saved Sellers",
    description: "Alerts when sellers you follow publish something new."
  },
  {
    key: "savedItemEmail",
    title: "Saved Items",
    description: "Updates about items you are watching closely."
  },
  {
    key: "offerAndPriceDropEmail",
    title: "Offers and Price Drops",
    description: "Offer activity, discounts, and marketplace-wide price reductions."
  },
  {
    key: "sellerActivityEmail",
    title: "Seller Activity",
    description: "Seller-side performance and activity emails."
  },
  {
    key: "helloEmail",
    title: "Onboarding",
    description: "Helpful getting-started and account onboarding messages."
  },
  {
    key: "updatesEmail",
    title: "Product Updates",
    description: "News, product improvements, and editorial updates from TailorGraph."
  }
] as const;

export default async function AccountNotificationsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+manage+notification+preferences");
  }

  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Settings"
            title="Notification Preferences"
            description="Control the optional alerts you want from TailorGraph. Security, order, support, and account-critical emails stay on so purchases and account recovery still work."
          />
        </section>

        {saved === "preferences" ? (
          <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            Notification preferences saved.
          </p>
        ) : null}
        {authError ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Email"
              title="Optional email alerts"
              description="These are the categories you can turn on and off yourself."
            />

            <form action={updateNotificationPreferencesAction} className="mt-6 grid gap-4">
              {optionalEmailPreferences.map((preference) => (
                <label
                  key={preference.key}
                  className="flex items-start justify-between gap-4 rounded-[1.4rem] border border-stone-300 bg-white px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{preference.title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-700">{preference.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    name={preference.key}
                    defaultChecked={user.notificationPreferences[preference.key]}
                    className="mt-1 h-5 w-5 rounded border-stone-300 text-[var(--accent)]"
                  />
                </label>
              ))}

              <label className="flex items-start justify-between gap-4 rounded-[1.4rem] border border-stone-300 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-stone-950">Shipment SMS</p>
                  <p className="mt-1 text-sm leading-6 text-stone-700">
                    Turn SMS shipping updates on or off. This will activate once Twilio is connected and your phone number is saved.
                  </p>
                </div>
                <input
                  type="checkbox"
                  name="shipmentSms"
                  defaultChecked={user.notificationPreferences.shipmentSms}
                  className="mt-1 h-5 w-5 rounded border-stone-300 text-[var(--accent)]"
                />
              </label>

              <button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                Save Preferences
              </button>
            </form>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Always On"
              title="Critical notifications"
              description="These remain enabled because they are tied to security, orders, or support resolution."
            />
            <div className="mt-6 grid gap-4">
              {[
                ["Account security", "Password resets, email verification, and other account-protection messages."],
                ["Buyer and seller orders", "Purchase confirmations, shipping updates, and order state changes."],
                ["Support and disputes", "Messages confirming requests, disputes, and trust-and-safety cases."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-[1.4rem] border border-stone-300 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-950">{title}</p>
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                      Required
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{description}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
