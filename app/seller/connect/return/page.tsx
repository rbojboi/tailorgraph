import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { isDatabaseConfigured, markUserStripeOnboardingComplete } from "@/lib/store";

export default async function SellerConnectReturnPage() {
  let destination = "/seller/payouts?setupError=Stripe+could+not+verify+seller+payout+setup";

  if (!isDatabaseConfigured()) {
    redirect("/seller?authError=Add+DATABASE_URL+to+enable+seller+payouts");
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      destination = "/login?authError=Please+log+in+again+to+finish+seller+payout+setup";
    } else if (!user.stripeAccountId || !isStripeConfigured()) {
      destination = "/seller/payouts?setupError=Stripe+Connect+is+not+ready";
    } else {
      const account = await getStripe().accounts.retrieve(user.stripeAccountId);
      const completed = Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled);
      await markUserStripeOnboardingComplete(user.id, completed);
      revalidatePath("/");
      revalidatePath("/seller");
      revalidatePath("/seller/payouts");
      destination = completed ? "/seller?saved=stripe-connect" : "/seller/payouts?setupError=onboarding_incomplete";
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe could not verify seller payout setup. Please try again.";
    destination = `/seller/payouts?setupError=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
