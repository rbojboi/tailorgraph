import Link from "next/link";
import { readUnsubscribeToken } from "@/lib/email-unsubscribe";

export default async function UnsubscribePage({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token=""}=await searchParams;
  const valid=readUnsubscribeToken(token);
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-3xl font-semibold">Email preferences</h1>
    {valid ? <><p className="my-6">Turn off this category of optional TailorGraph emails. Order and security updates will stay on.</p>
      <form action={`/api/email/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
        <button className="rounded-full bg-stone-950 px-6 py-3 text-white">Unsubscribe</button>
      </form></> : <p className="my-6">This link is invalid. Manage your preferences in your account.</p>}
    <Link className="mt-6 block underline" href="/account/notifications">Manage all notifications</Link></main>;
}
