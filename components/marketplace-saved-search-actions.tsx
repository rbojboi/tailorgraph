"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveMarketplaceSearchAction, updateSavedSearchQueryAction } from "@/app/actions";

type SavedSearchSummary = {
  id: string;
  queryString: string;
};

function serializeMarketplaceForm(form: HTMLFormElement) {
  const params = new URLSearchParams();
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      continue;
    }

    if (!value) {
      continue;
    }

    if (key === "page" || key === "queryString" || key === "returnTo" || key === "savedSearchId") {
      continue;
    }

    params.append(key, value);
  }

  params.delete("page");
  return params.toString();
}

export function MarketplaceSavedSearchActions({
  activeSavedSearchId,
  initialSerializedQuery,
  savedSearches
}: {
  activeSavedSearchId?: string;
  initialSerializedQuery: string;
  savedSearches: SavedSearchSummary[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [currentQuery, setCurrentQuery] = useState(initialSerializedQuery);

  useEffect(() => {
    const form = wrapperRef.current?.closest("form");
    if (!form) {
      return;
    }

    const updateQuery = () => {
      setCurrentQuery(serializeMarketplaceForm(form));
    };

    updateQuery();
    form.addEventListener("input", updateQuery);
    form.addEventListener("change", updateQuery);

    return () => {
      form.removeEventListener("input", updateQuery);
      form.removeEventListener("change", updateQuery);
    };
  }, []);

  const exactSavedSearch = savedSearches.find((savedSearch) => savedSearch.queryString === currentQuery);
  const loadedSavedSearch = activeSavedSearchId
    ? savedSearches.find((savedSearch) => savedSearch.id === activeSavedSearchId) ?? null
    : exactSavedSearch ?? null;
  const showEditOptions = !exactSavedSearch && Boolean(loadedSavedSearch);

  if (showEditOptions) {
    return (
      <div ref={wrapperRef} className="grid gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
          {activeSavedSearchId ? <input type="hidden" name="savedSearchId" value={activeSavedSearchId} /> : null}
          <Link href="/marketplace" className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
            Reset
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            formAction={updateSavedSearchQueryAction}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
          >
            Edit Saved Search
          </button>
          <button
            formAction={saveMarketplaceSearchAction}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
          >
            Save as New Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex flex-wrap gap-3">
      <button
        type="submit"
        className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
      >
        Search
      </button>
      {activeSavedSearchId ? <input type="hidden" name="savedSearchId" value={activeSavedSearchId} /> : null}
      <Link href="/marketplace" className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
        Reset
      </Link>
      {exactSavedSearch ? (
        <button
          type="button"
          className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900"
        >
          Saved
        </button>
      ) : (
        <button
          formAction={saveMarketplaceSearchAction}
          className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
        >
          Save Search
        </button>
      )}
    </div>
  );
}
