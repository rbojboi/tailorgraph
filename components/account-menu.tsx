"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/actions";

const accountGroups = [
  { title: "Buying", links: [
    ["/buyer/measurements", "My Measurements"],
    ["/buyer/offers", "My Offers"],
    ["/buyer/orders", "My Orders"],
    ["/buyer/saved-items", "Saved Items"],
    ["/buyer/saved-users", "Saved Users"],
    ["/buyer/saved-searches", "Saved Searches"]
  ] },
  { title: "Selling", links: [
    ["/seller/listings/new", "List an Item"],
    ["/seller/listings", "My Listings"],
    ["/seller", "My Sales"]
  ] },
  { title: "Account", links: [
    ["/account/profile", "My Profile"],
    ["/account", "Settings"],
    ["/account/notifications", "Notifications"]
  ] }
] as const;

const linkClass = "flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800";

export function AccountMenu({ signedIn, username }: { signedIn: boolean; username?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-[120] shrink-0"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={triggerRef} type="button" aria-label="Navigation and account menu"
        aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-stone-950 px-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 md:px-4">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 md:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
        <span className="hidden max-w-40 truncate md:inline">{signedIn ? username || "Account" : "Log In"}</span>
      </button>
      {open ? (
        <nav id={menuId} aria-label="Account navigation" className="absolute right-0 top-full z-[200] mt-2 max-h-[calc(100dvh-7rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[1.25rem] border border-stone-300 bg-white p-2 shadow-lg"
          onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }}>
          <div className="border-b border-stone-200 pb-2 md:hidden">
            <Link href="/marketplace" className={linkClass}>Marketplace</Link>
            <Link href="/how-to-use" className={linkClass}>How to Use</Link>
            <Link href="/support" className={linkClass}>Support</Link>
          </div>
          {signedIn ? <>
            <p className="break-words px-3 py-3 text-sm text-stone-600 md:hidden">Signed in as {username || "Account"}</p>
            {accountGroups.map(({ title, links }) => (
              <div key={title} className="border-b border-stone-200 py-2">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{title}</p>
                {links.map(([href, label]) => <Link key={href} href={href} className={linkClass}>{label}</Link>)}
              </div>
            ))}
            <form action={logoutAction}>
              <button className={`${linkClass} w-full text-left text-[var(--accent)]`}>Log Out</button>
            </form>
          </> : <>
            <Link href="/login" className={linkClass}>Log In</Link>
            <Link href="/signup" className={linkClass}>Sign Up</Link>
          </>}
        </nav>
      ) : null}
    </div>
  );
}
