import { redirect } from "next/navigation";

export default function BuyerSecurityPasswordRedirect() {
  redirect("/account/security/password");
}
