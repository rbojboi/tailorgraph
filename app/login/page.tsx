import Link from "next/link";
import { loginAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle } from "@/components/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
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
            title="Log In"
            description="Access your buyer tools, seller tools, saved measurements, and checkout flows."
          />
          <p className="mt-4 text-sm text-stone-700">You can log in with either your username or your email address.</p>
          {authError ? (
            <p className="mt-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}
          <form action={loginAction} className="mt-6 grid gap-4 rounded-[1.5rem] bg-white p-6">
            <Input name="username" label="Username or Email" type="text" required />
            <Input name="password" label="Password" type="password" required />
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                Log In
              </button>
              <Link href="/forgot-password" className="text-sm font-semibold text-[var(--accent)] transition hover:text-stone-950">
                Forgot Password?
              </Link>
              <Link href="/signup" className="text-sm font-semibold text-stone-700 transition hover:text-stone-950">
                Need an account?
              </Link>
            </div>
          </form>
        </section>
      </PageWrap>
    </AppShell>
  );
}
