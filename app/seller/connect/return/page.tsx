import { finalizeStripeOnboardingAction } from "@/app/actions";

export default async function SellerConnectReturnPage() {
  await finalizeStripeOnboardingAction();
  return null;
}
