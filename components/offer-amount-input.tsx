"use client";

import { useState } from "react";

function normalizeCurrencyDraft(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("").slice(0, 2);

  if (!cleaned.includes(".")) {
    return whole;
  }

  return `${whole}.${fraction}`;
}

function formatCurrencyDraft(value: string) {
  if (!value) {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return `$${numeric.toFixed(2)}`;
}

export function OfferAmountInput({
  name,
  placeholder
}: {
  name: string;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <input
      name={name}
      type="text"
      inputMode="decimal"
      required
      value={value}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setValue((current) => current.replace(/\$/g, ""));
      }}
      onBlur={() => {
        setFocused(false);
        setValue((current) => formatCurrencyDraft(current.replace(/\$/g, "")));
      }}
      onChange={(event) => {
        const nextValue = normalizeCurrencyDraft(event.target.value);
        setValue(focused ? nextValue : formatCurrencyDraft(nextValue));
      }}
      className="rounded-2xl border border-stone-600 bg-stone-950 px-4 py-3 text-sm text-stone-50 outline-none"
    />
  );
}
