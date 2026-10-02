"use server";
import { getCurrentUser } from "@/lib/auth";
import { respondToOffer } from "@/lib/offers";
import { prepareOfferAuthorization,startOfferAuthorization } from "@/lib/offer-authorization";
import { startOfferPaymentRecovery } from "@/lib/commerce-payments";
import { requirePool } from "@/lib/store";
import type { ShippingAddress } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function respondToOfferAction(formData:FormData) {
  const user=await getCurrentUser();
  if (!user) redirect("/login");
  const destination=formData.get("destination")==="seller"?"/seller":"/buyer/offers";
  const offerId=String(formData.get("offerId"));
  const decision=String(formData.get("decision"));
  let errorMessage="";
  let authorizationId:string|undefined;
  try {
    const offer=(await requirePool().query("SELECT buyer_id,auto_charge,revision FROM offers WHERE id=$1",[offerId])).rows[0];
    if(offer?.auto_charge && offer.buyer_id===user.id && ["accept","counter","submit"].includes(decision)) {
      if(offer.revision!==Number(formData.get("revision"))) throw new Error("This offer has changed. Refresh your offers.");
      authorizationId=await prepareOfferAuthorization(offerId,user.id,decision as "accept"|"counter"|"submit",Number(formData.get("amount")));
    } else await respondToOffer(user.id,offerId,Number(formData.get("revision")),decision,Number(formData.get("amount")));
  }
  catch(error) { errorMessage=error instanceof Error && !('code' in error) && !('type' in error)?error.message:"Unable to update this offer. Please try again."; }
  revalidatePath("/seller");revalidatePath("/buyer/offers");revalidatePath("/cart");revalidatePath("/checkout");
  if(authorizationId) redirect(`/offers/authorize/${authorizationId}`);
  redirect(`${destination}?offerNotice=${encodeURIComponent(errorMessage || "Offer updated.")}`);
}

export async function authorizeOfferAction(formData:FormData) {
  const user=await getCurrentUser();if(!user) redirect("/login");
  const id=String(formData.get("authorizationId"));
  let url="",errorMessage="";
  try{
    const selection=String(formData.get("shippingAddressSelection")??"");
    const saved=(user.buyerProfile.addresses.length?user.buyerProfile.addresses:[user.buyerProfile.address]).filter(a=>a.line1&&a.city&&a.state&&a.postalCode&&a.country);
    const address:ShippingAddress=selection.startsWith("saved:")?saved[Number(selection.slice(6))]:{
      fullName:String(formData.get("shippingFullName")??""),line1:String(formData.get("shippingLine1")??""),line2:String(formData.get("shippingLine2")??""),
      city:String(formData.get("shippingCity")??""),state:String(formData.get("shippingState")??""),postalCode:String(formData.get("shippingPostalCode")??""),country:String(formData.get("shippingCountry")??"US")};
    if(!address) throw new Error("Choose a valid shipping address.");
    url=await startOfferAuthorization(id,user.id,address,formData.get("consent")==="yes");
  }catch(error){errorMessage=error instanceof Error&&!('code' in error)&&!('type' in error)?error.message:"Unable to start card authorization. Please try again.";}
  if(errorMessage) redirect(`/offers/authorize/${encodeURIComponent(id)}?notice=${encodeURIComponent(errorMessage)}`);
  redirect(url);
}

export async function recoverOfferPaymentAction(formData:FormData) {
  const user=await getCurrentUser();if(!user) redirect("/login");
  let url="",message="";
  try{url=await startOfferPaymentRecovery(String(formData.get("offerId")),user.id);}catch(error){message=error instanceof Error&&!('code' in error)&&!('type' in error)?error.message:"Payment is still processing. Check your offers shortly.";}
  if(message) redirect(`/buyer/offers?offerNotice=${encodeURIComponent(message)}`);
  redirect(url);
}
