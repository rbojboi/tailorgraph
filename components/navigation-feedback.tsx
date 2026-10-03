"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function shouldShowLinkProgress(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || anchor.target || anchor.hasAttribute("download")) {
    return false;
  }

  const nextUrl = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);

  return nextUrl.origin === currentUrl.origin && nextUrl.href !== currentUrl.href;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearHideTimer() {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    function showBriefly(duration = 1400) {
      clearHideTimer();
      setPending(true);
      hideTimerRef.current = window.setTimeout(() => setPending(false), duration);
    }

    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a");
      if (anchor instanceof HTMLAnchorElement && shouldShowLinkProgress(anchor)) {
        showBriefly(2400);
      }
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.method.toLowerCase() !== "dialog") {
        showBriefly();
      }
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      clearHideTimer();
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPending(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className={`navigation-feedback ${pending ? "navigation-feedback--active" : ""}`}
    />
  );
}
