import Link from "next/link";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {getStripe} from "@/lib/stripe";
import {requirePool} from "@/lib/store";
import {handleCommerceSession} from "@/lib/commerce-payments";
import {AppShell,PageWrap,SectionTitle} from "@/components/ui";
export default async function OfferPaymentComplete({searchParams}:{searchParams:Promise<{session_id?:string}>}){
  const user=await getCurrentUser();if(!user) redirect("/login");
  const {session_id}=await searchParams;if(!session_id) redirect("/buyer/offers");
  const session=await getStripe().checkout.sessions.retrieve(session_id);
  const id=session.metadata?.paymentAttempt;
  if(!id || !(await requirePool().query("SELECT 1 FROM commerce_payments WHERE id=$1 AND buyer_id=$2",[id,user.id])).rows.length) redirect("/buyer/offers");
  try{await handleCommerceSession(session);}catch{/* Webhook/worker reconciliation remains authoritative. */}
  const row=(await requirePool().query("SELECT state FROM commerce_payments WHERE id=$1",[id])).rows[0];
  return <AppShell><PageWrap maxWidth="max-w-3xl"><section className="panel rounded-3xl p-8"><SectionTitle eyebrow="Offers" title={row.state==="paid"?"Purchase confirmed":"Payment not yet confirmed"} description={row.state==="paid"?"Your accepted offer has been paid. The seller can now prepare your order for shipment.":"Check your offers for the current payment status. We will confirm your purchase after Stripe confirms payment."}/><Link className="mt-6 block underline" href={row.state==="paid"?"/buyer/orders":"/buyer/offers"}>{row.state==="paid"?"View My Purchases":"View my offers"}</Link></section></PageWrap></AppShell>;
}
