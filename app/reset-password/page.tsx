import Link from "next/link";
import { redirect } from "next/navigation";
import { resetPasswordAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle } from "@/components/ui";
import { findValidPasswordResetUserByTokenHash } from "@/lib/store";
import { createHash } from "node:crypto";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = firstValue(params.token) ?? "";
  const authError = firstValue(params.authError);

  if (!token) {
    redirect("/forgot-password?authError=Password+reset+link+is+missing");
  }

  const user = await findValidPasswordResetUserByTokenHash(hashResetToken(token));

  if (!user) {
    redirect("/forgot-password?authError=That+reset+link+is+invalid+or+has+expired");
  }

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Account"
            title="Choose a New Password"
            description={`Set a new password for ${user.email}.`}
          />

          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}

          <form action={resetPasswordAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <input type="hidden" name="token" value={token} />
            <Input name="newPassword" label="New Password" type="password" required />
            <Input name="confirmPassword" label="Confirm New Password" type="password" required />
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                Reset Password
              </button>
              <Link href="/forgot-password" className="text-sm font-semibold text-stone-700 transition hover:text-stone-950">
                Start Over
              </Link>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
