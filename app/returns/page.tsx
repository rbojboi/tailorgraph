import Link from "next/link";
import { AppShell, PageWrap } from "@/components/ui";
import { RETURN_POLICY_TEXT } from "@/lib/return-policy";
export default function Page() {
  return <AppShell><PageWrap maxWidth="max-w-3xl"><section className="panel rounded-[2rem] p-8 space-y-5">
    <h1 className="text-3xl font-semibold">Returns on TailorGraph</h1>
    <p className="leading-7">{RETURN_POLICY_TEXT}</p>
    <p>Sellers choose whether to allow returns when publishing a listing. Your order keeps the return policy from the time of purchase.</p>
    <p>Refunds cover the full item price, including TailorGraph’s fee. The original shipping charge and the separately purchased return label are excluded. There are no partial item refunds.</p>
    <p>Use the tracked return label purchased through your order. Printing a label does not trigger a refund. Carrier acceptance must occur before your return’s shipping deadline.</p>
    <p>Sellers can report damage, missing pieces, the wrong item, or an empty package within 48 hours of return delivery, with photographic and packaging evidence. TailorGraph reviews the case; the buyer is not automatically charged again.</p>
    <p>If a listing does not allow returns, you can still contact support about a damaged, missing, or misrepresented item.</p>
    <Link href="/support" className="block underline">Contact support</Link>
  </section></PageWrap></AppShell>;
}
