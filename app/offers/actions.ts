"use server";
import { getCurrentUser } from "@/lib/auth";
import { respondToOffer } from "@/lib/offers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function respondToOfferAction(formData:FormData) {
  const user=await getCurrentUser();
  if (!user) redirect("/login");
  const destination=formData.get("destination")==="seller"?"/seller":"/buyer/offers";
  let errorMessage="";
  try { await respondToOffer(user.id,String(formData.get("offerId")),Number(formData.get("revision")),String(formData.get("decision")),Number(formData.get("amount"))); }
  catch(error) { errorMessage=error instanceof Error && !('code' in error)?error.message:"Unable to update this offer. Please try again."; }
  revalidatePath("/seller");revalidatePath("/buyer/offers");revalidatePath("/cart");revalidatePath("/checkout");
  redirect(`${destination}?offerNotice=${encodeURIComponent(errorMessage || "Offer updated.")}`);
}
