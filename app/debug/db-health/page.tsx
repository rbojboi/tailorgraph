import { AppShell, PageWrap } from "@/components/ui";
import { ensureSeedData, findUserByUsername, isDatabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export default async function DatabaseHealthPage() {
  let status: "ok" | "error" = "ok";
  let summary = "Database check passed.";
  let details: string[] = [];

  if (!isDatabaseConfigured()) {
    status = "error";
    summary = "DATABASE_URL is not configured for the app runtime.";
    details = ["The Next.js server does not currently have a database connection string."];
  } else {
    try {
      await ensureSeedData();
      const user = await findUserByUsername("bobbyveebee");

      details = [
        "DATABASE_URL is configured.",
        "Seed/bootstrap path completed without throwing.",
        user
          ? `Lookup for @bobbyveebee succeeded (user id: ${user.id}).`
          : "Lookup for @bobbyveebee returned no row, but the query itself succeeded."
      ];
    } catch (error) {
      status = "error";
      summary = "Database check failed in the app runtime.";
      details = [formatError(error)];
    }
  }

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[1.75rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">Debug</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Database Health</h1>
          <p className="mt-2 text-sm text-stone-600">
            This page runs a real database read through the Next.js app runtime so we can verify whether the app can
            reach Neon.
          </p>

          <div
            className={`mt-6 rounded-[1.5rem] border px-4 py-4 text-sm ${
              status === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-950"
            }`}
          >
            <p className="font-semibold">{summary}</p>
            <div className="mt-3 grid gap-2">
              {details.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
            </div>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
