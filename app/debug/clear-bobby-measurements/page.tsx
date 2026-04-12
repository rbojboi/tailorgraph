import { AppShell, PageWrap } from "@/components/ui";
import { findUserByUsername, updateUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClearBobbyMeasurementsPage() {
  const user = await findUserByUsername("bobbyveebee");

  if (!user) {
    return (
      <AppShell>
        <PageWrap>
          <section className="panel rounded-[1.75rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Debug</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">Clear Bobby Measurements</h1>
            <div className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-950">
              <p className="font-semibold">Could not find @bobbyveebee.</p>
            </div>
          </section>
        </PageWrap>
      </AppShell>
    );
  }

  await updateUser(user.id, {
    ...user.buyerProfile,
    jacketMeasurements: null,
    shirtMeasurements: null,
    waistcoatMeasurements: null,
    trouserMeasurements: null,
    coatMeasurements: null,
    sweaterMeasurements: null,
    suggestedMeasurementRanges: null
  });

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[1.75rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Debug</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Clear Bobby Measurements</h1>
          <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            <p className="font-semibold">Cleared Bobby Veebee&apos;s saved My Measurements data.</p>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
