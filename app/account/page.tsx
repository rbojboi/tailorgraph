import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

export default async function AccountPage() {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+your+account");
  }

  const accountLinks = [
    {
      href: "/account/personal",
      title: "Personal Information",
      description: "Manage your name, phone number, ZIP-based location, and saved addresses."
    },
    {
      href: "/account/security",
      title: "Log In Information",
      description: "Update your username, login email, and password."
    },
    {
      href: "/account/notifications",
      title: "Notification Preferences",
      description: "Choose which optional marketplace, fit, seller, and product alerts you want to receive."
    },
    {
      href: "/account/profile",
      title: "Profile Settings",
      description: "Control how your public profile appears across the marketplace."
    },
    {
      href: "/account/payment",
      title: "Payment Information",
      description: "Review saved payment methods and billing tools as this area is built out."
    },
    {
      href: "/account/banking",
      title: "Banking Information",
      description: "Manage payout and receiving-funds details for seller activity."
    }
  ];

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Settings"
            title="Account Settings"
            description="Manage the personal, login, payment, and payout settings that apply across your whole account."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {accountLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[1.5rem] bg-white p-6 transition hover:border-stone-950 hover:shadow-sm"
              >
                <h2 className="text-lg font-semibold text-stone-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-700">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
