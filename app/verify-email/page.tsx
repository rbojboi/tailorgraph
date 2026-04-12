import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { createHash } from "node:crypto";
import { findValidEmailVerificationUserByTokenHash } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = firstValue(params.token) ?? "";
  const authError = firstValue(params.authError);

  if (!token) {
    redirect("/login?authError=Verification+link+is+missing");
  }

  const user = await findValidEmailVerificationUserByTokenHash(hashVerificationToken(token));

  if (!user) {
    return (
      <AppShell>
        <PageWrap maxWidth="max-w-3xl">
          <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
            <SectionTitle
              eyebrow="Account"
              title="Verify Email"
              description="That verification link is invalid or has expired."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                Return to Log In
              </Link>
            </div>
          </section>
        </PageWrap>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Account"
            title="Verify Email"
            description={`Confirm that ${user.email} belongs to your TailorGraph account.`}
          />
          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}
          <form action={verifyEmailAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <input type="hidden" name="token" value={token} />
            <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
              Verify Email Address
            </button>
            <Link href="/login" className="text-sm font-semibold text-stone-700 transition hover:text-stone-950">
              Return to Log In
            </Link>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
