import { redirect } from "next/navigation";

export default function BuyerPersonalRedirect() {
  redirect("/account/personal");
}
