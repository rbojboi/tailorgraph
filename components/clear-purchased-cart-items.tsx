"use client";

import { useEffect } from "react";

export function ClearPurchasedCartItems({ listingIds }: { listingIds: string[] }) {
  useEffect(() => {
    if (!listingIds.length) {
      return;
    }

    void fetch("/api/cart/clear-purchased", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ listingIds }),
      keepalive: true
    });
  }, [listingIds]);

  return null;
}
