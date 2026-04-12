import { redirect } from "next/navigation";

export default function BuyerSecurityEmailRedirect() {
  redirect("/account/security/email");
}
