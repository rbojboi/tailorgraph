import Link from "next/link";
import { redirect } from "next/navigation";
import { changePasswordAction, requestCurrentUserPasswordResetAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle } from "@/components/ui";
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

export default async function AccountSecurityPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();
  if (!user) redirect("/?authError=Please+log+in+to+access+your+account");
  const params = await searchParams;
  const authError = firstValue(params.authError);
  const sent = firstValue(params.sent);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle eyebrow="Settings" title="Change Password" description="Choose a new password with at least 8 characters." />
            </div>
            <Link href="/account/security" className={`${actionButtonClass} shrink-0 self-start`}>Back</Link>
          </div>
          {authError ? <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
          {sent ? <div className="mt-6 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900"><p>A password reset link was sent to {user.email}.</p></div> : null}
          <form action={changePasswordAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <Input name="currentPassword" label="Current Password" type="password" required />
            <Input name="newPassword" label="New Password" type="password" required />
            <Input name="confirmPassword" label="Confirm New Password" type="password" required />
            <div className="flex flex-wrap items-center gap-3">
              <button className={saveButtonClass}>Save Password</button>
              <button formAction={requestCurrentUserPasswordResetAction} className="text-sm font-semibold text-[var(--accent)] transition hover:text-stone-950">Forgot your password?</button>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
