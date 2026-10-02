import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {getOfferAuthorization,offerConsent} from "@/lib/offer-authorization";
import {CheckoutAddressFields} from "@/components/checkout-address-fields";
import {AppShell,PageWrap,SectionTitle} from "@/components/ui";
import {authorizeOfferAction} from "@/app/offers/actions";

export default async function AuthorizeOfferPage({params,searchParams}:{params:Promise<{authorizationId:string}>;searchParams:Promise<{notice?:string}>}) {
  const user=await getCurrentUser();if(!user) redirect("/login");
  const {authorizationId}=await params, {notice}=await searchParams;
  const auth=await getOfferAuthorization(authorizationId,user.id);if(!auth) notFound();
  const saved=(user.buyerProfile.addresses.length?user.buyerProfile.addresses:[user.buyerProfile.address]).filter(a=>a.line1&&a.city&&a.state&&a.postalCode&&a.country);
  const expired=new Date(auth.expires_at)<=new Date()||!["draft","authorizing"].includes(auth.state);
  return <AppShell><PageWrap maxWidth="max-w-3xl"><section className="panel rounded-3xl p-6 sm:p-8">
    <SectionTitle eyebrow="Offers" title={auth.purpose==="accept"?"Accept and authorize payment":"Review your binding offer"} description="Your card stays securely with Stripe. TailorGraph does not receive your card number."/>
    <h2 className="mt-6 text-xl font-semibold">{auth.listing_title}</h2>
    <dl className="my-6 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4"><dt>Item</dt><dd>${(auth.amount_cents/100).toFixed(2)} USD</dd><dt>Shipping</dt><dd>${(auth.shipping_cents/100).toFixed(2)} USD</dd><dt className="font-semibold">Total authorized</dt><dd className="font-semibold">${((auth.amount_cents+auth.shipping_cents)/100).toFixed(2)} USD</dd></dl>
    <p className="mb-4 text-sm">{auth.purpose==="accept"?"Completing card authorization accepts this counteroffer and starts payment automatically.":"Your offer is sent after card authorization. If the seller accepts before the offer expires, we charge this total automatically. A counteroffer requires your approval of the new total."} Your bank may still require verification. An offer is not a completed purchase until payment succeeds.</p>
    {notice?<p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">{notice}</p>:null}
    {expired?<p>This authorization has ended. Return to your offers to see the current status.</p>:<form action={authorizeOfferAction}>
      <input type="hidden" name="authorizationId" value={authorizationId}/>
      <CheckoutAddressFields savedAddresses={saved} defaultFullName={user.name} allowSave={false}/>
      <label className="my-5 flex items-start gap-3 rounded-xl border border-stone-300 p-4 text-sm leading-6"><input className="mt-1" type="checkbox" name="consent" value="yes" required/>
        <span>{offerConsent(auth.amount_cents,auth.shipping_cents,auth.purpose,new Date(auth.expires_at))}</span></label>
      <button className="rounded-full bg-stone-950 px-6 py-3 font-semibold text-white">Continue to secure card authorization</button>
    </form>}
    <Link className="mt-5 block underline" href="/buyer/offers">Back to my offers</Link>
  </section></PageWrap></AppShell>;
}
