import { redirect } from "next/navigation";

export default function BuyerSecurityRedirect() {
  redirect("/account/security");
}
