import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle } from "@/components/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const authError = firstValue(params.authError);
  const sent = firstValue(params.sent);
  const preview = firstValue(params.preview);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Account"
            title="Reset Your Password"
            description="Enter the email address tied to your account and we will prepare a password reset link."
          />

          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}

          {sent ? (
            <div className="mt-6 rounded-[1.5rem] bg-white p-6">
              <p className="text-sm leading-6 text-stone-700">
                If an account exists for that email, a password reset link is now ready.
              </p>
              {preview ? (
                <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4 text-sm text-stone-700">
                  <p className="font-semibold text-stone-950">Local preview reset link</p>
                  <Link href={preview} className="mt-2 block break-all text-[var(--accent)] transition hover:text-stone-950">
                    {preview}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <form action={requestPasswordResetAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <Input name="email" label="Email" type="email" required />
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                Send Reset Link
              </button>
              <Link href="/" className="text-sm font-semibold text-stone-700 transition hover:text-stone-950">
                Back to Marketplace
              </Link>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
