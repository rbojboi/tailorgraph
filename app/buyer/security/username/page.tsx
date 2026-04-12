import { redirect } from "next/navigation";

export default function BuyerSecurityUsernameRedirect() {
  redirect("/account/security/username");
}
