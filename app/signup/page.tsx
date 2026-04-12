import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle } from "@/components/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const authError = firstValue(params.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-3xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Access"
            title="Sign Up"
            description="Create an account for the full TailorGraph marketplace experience."
          />
          <p className="mt-4 text-sm text-stone-700">After signup, we will send a verification link to your email address.</p>
          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}
          <form action={signUpAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <Input name="name" label="Name" type="text" required />
            <Input name="email" label="Email" type="email" required />
            <Input name="username" label="Username" type="text" maxLength={30} required />
            <Input name="password" label="Password" type="password" required />
            <Input name="confirmPassword" label="Confirm Password" type="password" required />
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                Sign Up
              </button>
              <Link href="/login" className="text-sm font-semibold text-stone-700 transition hover:text-stone-950">
                Already have an account?
              </Link>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
