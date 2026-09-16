"use client";

import { useId, useState, type ReactNode } from "react";

/** One shared form, collapsible on phones and always visible beside desktop results. */
export function MarketplaceFilterPanel({ children, activeFilterCount }: { children: ReactNode; activeFilterCount: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <aside className="marketplace-tool-panel min-w-0 self-start rounded-[0.9rem] py-2 sm:p-3 xl:p-5 xl:pb-4">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-sm font-semibold text-stone-900 xl:hidden">
        <span>Filters &amp; measurements{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div id={panelId} className={`${open ? "block" : "hidden"} pt-5 xl:block xl:pt-0`}>{children}</div>
    </aside>
  );
}
