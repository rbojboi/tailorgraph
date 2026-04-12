import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { countUnreadMessageThreadsForUser } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { getCartIds } from "@/lib/cart";

function fallbackUsername(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "account";
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const [cartIds, unreadMessageCount] = await Promise.all([
    getCartIds(),
    user ? countUnreadMessageThreadsForUser(user.id) : Promise.resolve(0)
  ]);
  const cartCount = cartIds.length;
  const navItems = [
    { href: "/marketplace", label: "Marketplace", accent: true },
    { href: "/how-to-use", label: "How to Use" },
    { href: "/messages", label: "Messages", icon: true }
  ];

  return (
    <header className="grain relative z-[100] border-b border-stone-300/70 px-4 py-4 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--nav-surface)" }}>
      <div className="relative z-[100] mx-auto flex max-w-7xl flex-col gap-4 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="editorial text-lg font-semibold tracking-[0.2em] text-stone-950">
          LOGO
        </Link>
        <nav className="flex flex-wrap items-center gap-5 sm:justify-end">
          {navItems.map((item) => (
            item.icon ? (
              <Link key={item.href} href={item.href} aria-label={item.label} className="relative text-stone-700 transition hover:text-stone-950">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                {unreadMessageCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-semibold transition hover:text-stone-950 ${
                  item.accent ? "text-[var(--accent)]" : "text-stone-700"
                }`}
              >
                {item.label}
              </Link>
            )
          ))}
          <Link href="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} item${cartCount === 1 ? "" : "s"}` : ""}`} className="relative text-stone-700 transition hover:text-stone-950">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" />
            </svg>
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-4 text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
          <AccountMenu
            signedIn={Boolean(user)}
            username={user ? user.username || fallbackUsername(user.name) : undefined}
          />
        </nav>
      </div>
    </header>
  );
}
