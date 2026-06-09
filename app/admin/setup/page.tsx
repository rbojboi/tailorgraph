import { redirect } from "next/navigation";
import { claimFirstAdminAccessAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { countAdminUsers } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSetupPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  const adminCount = await countAdminUsers();
  const params = await searchParams;
  const authError = firstValue(params.authError);

  if (!user) {
    redirect("/login?authError=Please+log+in+to+set+up+admin+access");
  }

  if (isAdminUser(user)) {
    redirect("/admin");
  }

  if (adminCount > 0) {
    redirect("/?authError=Admin+access+has+already+been+configured");
  }

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Admin Setup"
            title="Claim the first admin account"
            description="This one-time step turns your current TailorGraph account into the first admin so the internal tools can live inside the product, not inside environment variables."
          />
          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}
          <div className="mt-6 rounded-[1.5rem] bg-white p-6">
            <p className="text-sm leading-6 text-stone-700">
              You are signed in as <strong>{user.email}</strong>. If you continue, this account will become the first
              TailorGraph admin and will get access to the temporary operations dashboard.
            </p>
            <form action={claimFirstAdminAccessAction} className="mt-6">
              <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
                Claim Admin Access
              </button>
            </form>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
