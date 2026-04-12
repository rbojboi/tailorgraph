import Link from "next/link";
import { redirect } from "next/navigation";
import { changeEmailAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const actionButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950";
const saveButtonClass =
  "rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-800";

export default async function AccountSecurityEmailPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();
  if (!user) redirect("/?authError=Please+log+in+to+access+your+account");
  const params = await searchParams;
  const authError = firstValue(params.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle eyebrow="Settings" title="Change Email" description="Your login email is also used for password reset links." />
            </div>
            <Link href="/account/security" className={`${actionButtonClass} shrink-0 self-start`}>Back</Link>
          </div>
          <div className="mt-6 max-w-sm">
            <Spec label="Current Email" value={user.email} />
          </div>
          {authError ? <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
          <form action={changeEmailAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <Input name="email" label="New Email" type="email" defaultValue={user.email} required />
            <Input name="confirmEmail" label="Confirm New Email" type="email" defaultValue={user.email} required />
            <Input name="currentPassword" label="Current Password" type="password" required />
            <div className="flex flex-wrap gap-3">
              <button className={saveButtonClass}>Save Email</button>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
