import { redirect } from "next/navigation";

export default function BuyerPaymentRedirect() {
  redirect("/account/payment");
}
