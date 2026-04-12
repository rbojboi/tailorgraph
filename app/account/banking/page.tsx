import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

export default async function AccountBankingPage() {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+your+account");
  }

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Settings"
                title="Banking Information"
                description="Seller payout destinations and receiving-funds settings will live here."
              />
            </div>
            <Link href="/account" className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Back to Account Settings
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Spec label="Username" value={user.username || "bobbyveebee"} />
            <Spec label="Seller Account" value={user.role === "seller" || user.role === "both" ? "Enabled" : "Not Enabled"} />
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white px-6 py-8 text-sm text-stone-700">
            Banking information is not built out yet, but this is where payout accounts, bank details, and seller receiving preferences will go.
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
