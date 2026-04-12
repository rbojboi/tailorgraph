"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function BuyerOfferActionsMenu({
  listingId
}: {
  listingId: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    function updatePosition() {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 208;
      const viewportPadding = 12;
      const left = Math.max(viewportPadding, rect.right - menuWidth);
      const top = rect.bottom + 8;
      setMenuPosition({ top, left });
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleMenuOpen(event: Event) {
      const detail = (event as CustomEvent<{ menuId: string }>).detail;
      if (detail.menuId !== menuId) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("buyer-offer-menu-open", handleMenuOpen as EventListener);

    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("buyer-offer-menu-open", handleMenuOpen as EventListener);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [menuId, open]);

  function toggleOpen() {
    if (!open) {
      window.dispatchEvent(new CustomEvent("buyer-offer-menu-open", { detail: { menuId } }));
    }

    setOpen((current) => !current);
  }

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed z-[300] flex w-52 flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_18px_50px_rgba(28,25,23,0.14)]"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          <Link
            href={`/messages?listingId=${listingId}`}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
          >
            Message Seller
          </Link>
          <Link
            href={`/messages?listingId=${listingId}`}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
          >
            Report Issue
          </Link>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div ref={rootRef} className="relative z-[120]">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Offer actions"
        >
          ...
        </button>
      </div>
      {menu}
    </>
  );
}
