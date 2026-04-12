import Link from "next/link";
import { redirect } from "next/navigation";
import { resendEmailVerificationAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
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

export default async function AccountSecurityPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+your+account");
  }

  const params = await searchParams;
  const saved = firstValue(params.saved);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Settings"
                title="Log In Information"
                description="Manage your username, login email, and password here."
              />
            </div>
            <Link href="/account" className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Back to Account Settings
            </Link>
          </div>
          {saved ? (
            <p className="mt-6 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              {saved === "username"
                ? "Username updated successfully."
                : saved === "email"
                  ? "Email updated successfully."
                  : saved === "email-verification"
                    ? "Email updated. Please verify the new address from the link we sent."
                    : saved === "verification-sent"
                      ? "Verification email sent."
                      : saved === "email-verified"
                        ? "Email verified successfully."
                  : saved === "password"
                    ? "Password updated successfully."
                    : `Saved ${saved}.`}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.5rem] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="max-w-sm">
                    <Spec label="Username" value={user.username || "bobbyveebee"} />
                  </div>
                </div>
                <Link href="/account/security/username" className={saveButtonClass}>
                  Change Username
                </Link>
              </div>
            </section>

            <section className="rounded-[1.5rem] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="max-w-sm">
                    <Spec label="Email" value={user.email} />
                    <div className="mt-3 max-w-sm">
                      <Spec label="Verification" value={user.emailVerified ? "Verified" : "Not Verified"} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/account/security/email" className={saveButtonClass}>
                    Change Email
                  </Link>
                  {!user.emailVerified ? (
                    <form action={resendEmailVerificationAction}>
                      <button className={actionButtonClass}>Resend Verification</button>
                    </form>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] bg-white p-6 lg:col-start-1">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Password</p>
                    <p className="mt-1 text-sm text-stone-700">Update your password here.</p>
                  </div>
                </div>
                <Link href="/account/security/password" className={saveButtonClass}>
                  Change Password
                </Link>
              </div>
            </section>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
