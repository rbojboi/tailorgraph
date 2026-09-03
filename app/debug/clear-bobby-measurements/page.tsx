import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AppShell, PageWrap } from "@/components/ui";
import { areDebugRoutesEnabled } from "@/lib/debug-routes";
import { findUserByUsername, updateUser } from "@/lib/store";

export const dynamic = "force-dynamic";

async function clearBobbyMeasurementsAction() {
  "use server";

  if (!areDebugRoutesEnabled()) {
    notFound();
  }

  const user = await findUserByUsername("bobbyveebee");
  if (!user) {
    return;
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

  revalidatePath("/debug/clear-bobby-measurements");
}

export default async function ClearBobbyMeasurementsPage() {
  if (!areDebugRoutesEnabled()) {
    notFound();
  }

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

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[1.75rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Debug</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Clear Bobby Measurements</h1>
          <p className="mt-2 text-sm text-stone-600">
            This local-only debug action clears Bobby Veebee&apos;s saved measurement data. It is disabled in production.
          </p>
          <form action={clearBobbyMeasurementsAction} className="mt-6">
            <button className="rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800">
              Clear Saved Measurements
            </button>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
