"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/app/actions";

type AccountMenuProps = {
  signedIn: boolean;
  username?: string;
};

export function AccountMenu({ signedIn, username }: AccountMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative z-[120] shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={signedIn ? "/account/profile" : "/login"}
        className="inline-flex h-10 items-center justify-center rounded-full bg-stone-950 px-4 text-[0.875rem] font-semibold leading-none text-stone-50 transition hover:bg-stone-800"
        aria-expanded={open}
      >
        <span className="relative -translate-y-px">{signedIn ? username : "Log In"}</span>
      </Link>
      {open ? (
        <div className="absolute right-0 top-full z-[200] pt-2">
          <div className="min-w-[12.5rem] rounded-[1.25rem] border border-stone-300 bg-white p-2 shadow-lg">
            {signedIn ? (
              <>
                <div className="px-3 pb-1.5 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">Buying</p>
                </div>
                <div className="grid gap-0.5">
                  <Link
                    href="/buyer/measurements"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Measurements
                  </Link>
                  <Link
                    href="/buyer/offers"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Offers
                  </Link>
                  <Link
                    href="/buyer/orders"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/buyer/saved-items"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    Saved Items
                  </Link>
                  <Link
                    href="/buyer/saved-users"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    Saved Users
                  </Link>
                  <Link
                    href="/buyer/saved-searches"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    Saved Searches
                  </Link>
                </div>

                <div className="my-2 border-t border-stone-200" />

                <div className="px-3 pb-1.5 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">Selling</p>
                </div>
                <div className="grid gap-0.5">
                  <Link
                    href="/seller/listings/new"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    List an Item
                  </Link>
                  <Link
                    href="/seller/listings"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Listings
                  </Link>
                  <Link
                    href="/seller"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Sales
                  </Link>
                </div>

                <div className="my-2 border-t border-stone-200" />

                <div className="px-3 pb-1.5 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">Account</p>
                </div>
                <div className="grid gap-0.5">
                  <Link
                    href="/account/profile"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    My Profile
                  </Link>
                  <Link
                    href="/account"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/account/notifications"
                    className="block rounded-xl px-6 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    Notifications
                  </Link>
                </div>

                <form action={logoutAction}>
                  <button className="block w-full appearance-none bg-transparent p-0 text-left">
                    <span className="block rounded-xl px-6 py-2 text-sm font-normal text-[var(--accent)] transition hover:bg-stone-100 hover:text-stone-950">
                      Log Out
                    </span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block rounded-xl px-4 py-3 text-right text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="block rounded-xl px-4 py-3 text-right text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
