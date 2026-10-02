import Link from "next/link";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {getStripe} from "@/lib/stripe";
import {completeOfferAuthorization,getOfferAuthorization} from "@/lib/offer-authorization";
import {AppShell,PageWrap,SectionTitle} from "@/components/ui";

export default async function OfferAuthorizationComplete({searchParams}:{searchParams:Promise<{session_id?:string}>}){
  const user=await getCurrentUser();if(!user) redirect("/login");
  const {session_id}=await searchParams;if(!session_id) redirect("/buyer/offers");
  const session=await getStripe().checkout.sessions.retrieve(session_id);
  const id=session.metadata?.authorizationId;
  if(!id||!await getOfferAuthorization(id,user.id)) redirect("/buyer/offers");
  let pending=false;
  try{await completeOfferAuthorization(session);}catch{pending=true;}
  const auth=await getOfferAuthorization(id,user.id);
  const done=auth&&["ready","used"].includes(auth.state);
  return <AppShell><PageWrap maxWidth="max-w-3xl"><section className="panel rounded-3xl p-8">
    <SectionTitle eyebrow="Offers" title={done?"Card authorization complete":"Checking your authorization"} description={done?(auth.purpose==="accept"?"Your acceptance has been recorded. Check your offers for the payment result; we only confirm a purchase after payment succeeds.":"Your offer is now available for the seller to review. If accepted, your authorized total will be charged automatically."):pending?"We are checking the result with Stripe. Refresh your offers shortly; do not submit another payment.":"This offer may have changed or expired. Check your offers before trying again."}/>
    <Link className="mt-6 inline-block rounded-full bg-stone-950 px-5 py-3 text-white" href="/buyer/offers">View my offers</Link>
  </section></PageWrap></AppShell>;
}
