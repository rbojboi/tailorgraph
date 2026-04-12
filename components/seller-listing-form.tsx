"use client";

import type { FocusEvent } from "react";
import { useState } from "react";
import { BrandAutocomplete } from "@/components/brand-autocomplete";
import { CountryAutocomplete } from "@/components/country-autocomplete";
import { ListingMediaInput } from "@/components/listing-media-input";
import { Input, Select } from "@/components/ui";
import {
  combineSplitSize,
  getPrimarySizeOptions,
  hasSuitTrousers,
  isShirtSizeCategory,
  isTrouserSizeCategory,
  shirtLengthSizeOptions,
  shirtNeckSizeOptions,
  splitCombinedSize,
  trouserLengthSizeOptions,
  trouserWaistSizeOptions
} from "@/lib/sizing";
import type { Listing } from "@/lib/types";
import type { BuyerBodyMeasurementSanityCheckResult } from "@/lib/measurement-guide-support";

const categoryOptions = [
  ["jacket", "Jacket"],
  ["waistcoat", "Waistcoat"],
  ["trousers", "Trousers"],
  ["two_piece_suit", "Two Piece Suit"],
  ["three_piece_suit", "Three Piece Suit"],
  ["coat", "Coat"],
  ["shirt", "Shirt"],
  ["sweater", "Sweater"]
] as const;

const materialOptions = [
  ["alpaca", "Alpaca"],
  ["camel", "Camel"],
  ["cashmere", "Cashmere"],
  ["cashmere_blend", "Cashmere Blend"],
  ["cotton", "Cotton"],
  ["cotton_blend", "Cotton Blend"],
  ["fur", "Fur"],
  ["faux_fur", "Fur (Faux)"],
  ["leather", "Leather"],
  ["faux_leather", "Leather (Faux)"],
  ["linen", "Linen"],
  ["linen_blend", "Linen Blend"],
  ["mohair", "Mohair"],
  ["mohair_blend", "Mohair Blend"],
  ["silk", "Silk"],
  ["silk_blend", "Silk Blend"],
  ["suede", "Suede"],
  ["synthetic", "Synthetic"],
  ["wool", "Wool"],
  ["wool_blend", "Wool Blend"],
  ["other", "Other"],
  ["unknown", "Unknown"]
] as const;

const shirtMaterialOptions = [
  ["cashmere", "Cashmere"],
  ["cashmere_blend", "Cashmere Blend"],
  ["cotton", "Cotton"],
  ["cotton_blend", "Cotton Blend"],
  ["linen", "Linen"],
  ["linen_blend", "Linen Blend"],
  ["silk", "Silk"],
  ["silk_blend", "Silk Blend"],
  ["synthetic", "Synthetic"],
  ["synthetic_blend", "Synthetic Blend"],
  ["wool", "Wool"],
  ["wool_blend", "Wool Blend"],
  ["other", "Other"],
  ["unknown", "Unknown"]
] as const;

const sweaterMaterialOptions = [
  ["alpaca", "Alpaca"],
  ["angora", "Angora"],
  ["cashmere", "Cashmere"],
  ["cashmere_blend", "Cashmere Blend"],
  ["cotton", "Cotton"],
  ["cotton_blend", "Cotton Blend"],
  ["lambswool", "Lambswool"],
  ["merino", "Merino"],
  ["mohair", "Mohair"],
  ["mohair_blend", "Mohair Blend"],
  ["silk", "Silk"],
  ["silk_blend", "Silk Blend"],
  ["synthetic", "Synthetic"],
  ["wool", "Wool"],
  ["wool_blend", "Wool Blend"],
  ["yak", "Yak"],
  ["other", "Other"],
  ["unknown", "Unknown"]
] as const;

const sweaterKnitTypeOptions = [
  ["aran", "Aran"],
  ["boucle", "Boucle"],
  ["cable_knit", "Cable"],
  ["fleece", "Fleece"],
  ["fisherman", "Fisherman"],
  ["jersey", "Jersey"],
  ["rib", "Rib"],
  ["terry", "Terry"],
  ["waffle_knit", "Waffle"],
  ["other", "Other"]
] as const;

const sweaterPatternOptions = [
  ["color_block", "Color Block"],
  ["fair_isle", "Fair Isle"],
  ["heathered", "Heathered"],
  ["micropattern", "Micro Pattern"],
  ["nordic", "Nordic"],
  ["plaid", "Plaid"],
  ["solid", "Solid"],
  ["striped", "Striped"],
  ["other", "Other"]
] as const;

const patternOptions = [
  ["birdseye", "Birdseye"],
  ["check", "Check"],
  ["fleck", "Fleck"],
  ["herringbone", "Herringbone"],
  ["houndstooth", "Houndstooth"],
  ["nailhead", "Nailhead"],
  ["plaid", "Plaid"],
  ["solid", "Solid"],
  ["striped", "Striped"],
  ["windowpane", "Windowpane"],
  ["other", "Other"]
] as const;

const shirtPatternOptions = [
  ["gingham", "Gingham"],
  ["houndstooth", "Houndstooth"],
  ["micropattern", "Micropattern"],
  ["plaid_tartan", "Plaid/Tartan"],
  ["print_novelty", "Print/Novelty"],
  ["solid", "Solid"],
  ["thin_stripe", "Striped (Thin)"],
  ["medium_stripe", "Striped (Medium)"],
  ["wide_stripe", "Striped (Thick)"],
  ["tattersall", "Tattersall"],
  ["windowpane", "Windowpane"],
  ["other", "Other"]
] as const;

const shirtFabricTypeOptions = [
  ["na", "N/A"],
  ["broadcloth_poplin", "Broadcloth/Poplin"],
  ["chambray", "Chambray"],
  ["corduroy", "Corduroy"],
  ["denim", "Denim"],
  ["dobby", "Dobby"],
  ["end_on_end", "End-on-End"],
  ["flannel", "Flannel"],
  ["herringbone", "Herringbone"],
  ["jersey", "Jersey"],
  ["oxford", "Oxford"],
  ["pinpoint", "Pinpoint"],
  ["pique", "Piqué"],
  ["seersucker", "Seersucker"],
  ["twill", "Twill"]
] as const;

const primaryColorOptions = [
  ["beige_tan", "Beige/Tan"],
  ["black", "Black"],
  ["blue", "Blue"],
  ["brown", "Brown"],
  ["gray_charcoal", "Gray/Charcoal"],
  ["green", "Green"],
  ["navy", "Navy"],
  ["orange", "Orange"],
  ["pink", "Pink"],
  ["purple_violet", "Purple/Violet"],
  ["white_cream", "White/Cream"],
  ["yellow", "Yellow"]
] as const;

const formalOptions = [
  ["black_tie", "Black Tie"],
  ["white_tie", "White Tie"],
  ["morning_dress", "Morning Dress"],
  ["na", "N/A"]
] as const;

function normalizePositiveNumber(event: FocusEvent<HTMLInputElement>, increment?: number) {
  const rawValue = event.currentTarget.value.trim();
  if (!rawValue) {
    return;
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) {
    event.currentTarget.value = "";
    return;
  }

  const clamped = Math.max(0, numericValue);
  const nextValue = increment ? Math.round(clamped / increment) * increment : clamped;
  event.currentTarget.value = Number(nextValue.toFixed(2)).toString();
}

function QuarterField({
  name,
  label,
  required,
  defaultValue
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">
        {label}
        {required ? <span className="ml-1 text-rose-700">*</span> : null}
      </span>
      <input
        name={name}
        type="number"
        defaultValue={defaultValue ?? ""}
        placeholder="0.00"
        step={0.25}
        min={0}
        required={required}
        onBlur={(event) => normalizePositiveNumber(event, 0.25)}
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

function shouldShowJacket(category: string) {
  return ["jacket", "two_piece_suit", "three_piece_suit", "coat", "shirt", "sweater"].includes(category);
}

function shouldShowWaistcoat(category: string) {
  return ["three_piece_suit", "waistcoat"].includes(category);
}

function shouldShowTrousers(category: string) {
  return ["two_piece_suit", "three_piece_suit", "trousers"].includes(category);
}

export function SellerListingForm({
  action,
  listing,
  sanityCheck,
  warningDraft,
  warningMedia,
  warningAction,
  warningButtonLabel,
  submitLabel = "Publish Listing",
  showDraftButton = true
}: {
  action: (formData: FormData) => void | Promise<void>;
  listing?: Listing;
  sanityCheck?: BuyerBodyMeasurementSanityCheckResult | null;
  warningDraft?: string;
  warningMedia?: string;
  warningAction?: (formData: FormData) => void | Promise<void>;
  warningButtonLabel?: string;
  submitLabel?: string;
  showDraftButton?: boolean;
}) {
  const [category, setCategory] = useState<string>(listing?.category ?? "jacket");
  const [price, setPrice] = useState(listing ? listing.price.toFixed(2) : "");
  const isShirt = category === "shirt";
  const isSweater = category === "sweater";
  const primarySizeOptions = getPrimarySizeOptions(category);
  const showsSuitTrouserSize = hasSuitTrousers(category);
  const usesSplitPrimarySize = isShirtSizeCategory(category) || isTrouserSizeCategory(category);
  const primarySplitSize = splitCombinedSize(listing?.sizeLabel);
  const suitTrouserSplitSize = splitCombinedSize(listing?.trouserSizeLabel);
  const [sizeLabelPartOne, setSizeLabelPartOne] = useState(primarySplitSize.partOne);
  const [sizeLabelPartTwo, setSizeLabelPartTwo] = useState(primarySplitSize.partTwo);
  const [trouserSizeLabelPartOne, setTrouserSizeLabelPartOne] = useState(suitTrouserSplitSize.partOne);
  const [trouserSizeLabelPartTwo, setTrouserSizeLabelPartTwo] = useState(suitTrouserSplitSize.partTwo);

  function handlePriceChange(value: string) {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const parts = sanitized.split(".");
    const nextValue =
      parts.length <= 1
        ? sanitized
        : `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;

    setPrice(nextValue);
  }

  function handlePriceBlur() {
    if (!price.trim()) {
      setPrice("");
      return;
    }

    const numericValue = Number(price);
    if (Number.isNaN(numericValue)) {
      setPrice("");
      return;
    }

    setPrice(Math.max(0, numericValue).toFixed(2));
  }

  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
      {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
      <ListingMediaInput required={!listing} existingMedia={listing?.media ?? []} />
      <Input
        name="title"
        label="Title (max. 60 characters)"
        placeholder="Canali Navy Birdseye Jacket"
        type="text"
        defaultValue={listing?.title ?? ""}
        required
        maxLength={60}
      />
      <BrandAutocomplete
        name="brand"
        queryName="brandQuery"
        label="Brand or Maker"
        defaultValue={listing?.brand ?? ""}
        maxLength={80}
      />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">
          Category
          <span className="ml-1 text-rose-700">*</span>
        </span>
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          required
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
        >
          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {usesSplitPrimarySize ? (
        <>
          <input
            type="hidden"
            name="sizeLabel"
            value={combineSplitSize(sizeLabelPartOne, sizeLabelPartTwo)}
            readOnly
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Tagged or Estimated {isShirt ? "Neck" : "Waist"} Size
                <span className="ml-1 text-rose-700">*</span>
              </span>
              <select
                name="sizeLabelPartOne"
                value={sizeLabelPartOne}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSizeLabelPartOne(nextValue);
                  if (!nextValue || nextValue === "N/A") {
                    setSizeLabelPartTwo(nextValue === "N/A" ? "N/A" : "");
                  }
                }}
                required
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Select a size
                </option>
                {(isShirt ? shirtNeckSizeOptions : trouserWaistSizeOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Tagged or Estimated Length Size
                <span className="ml-1 text-rose-700">*</span>
              </span>
              <select
                name="sizeLabelPartTwo"
                value={sizeLabelPartTwo}
                onChange={(event) => setSizeLabelPartTwo(event.target.value)}
                required={sizeLabelPartOne !== "N/A"}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Select a length
                </option>
                {(isShirt ? shirtLengthSizeOptions : trouserLengthSizeOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-stone-700">
            Tagged or Estimated Size
            <span className="ml-1 text-rose-700">*</span>
          </span>
          <select
            name="sizeLabel"
            defaultValue={listing?.sizeLabel ?? ""}
            required
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="" disabled>
              Select a size
            </option>
            {primarySizeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {showsSuitTrouserSize ? (
        <>
          <input
            type="hidden"
            name="trouserSizeLabel"
            value={combineSplitSize(trouserSizeLabelPartOne, trouserSizeLabelPartTwo)}
            readOnly
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Trousers Tagged or Estimated Waist Size
                <span className="ml-1 text-rose-700">*</span>
              </span>
              <select
                name="trouserSizeLabelPartOne"
                value={trouserSizeLabelPartOne}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTrouserSizeLabelPartOne(nextValue);
                  if (!nextValue || nextValue === "N/A") {
                    setTrouserSizeLabelPartTwo(nextValue === "N/A" ? "N/A" : "");
                  }
                }}
                required
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Select a size
                </option>
                {trouserWaistSizeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Trousers Tagged or Estimated Length Size
                <span className="ml-1 text-rose-700">*</span>
              </span>
              <select
                name="trouserSizeLabelPartTwo"
                value={trouserSizeLabelPartTwo}
                onChange={(event) => setTrouserSizeLabelPartTwo(event.target.value)}
                required={trouserSizeLabelPartOne !== "N/A"}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Select a length
                </option>
                {trouserLengthSizeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <input type="hidden" name="trouserSizeLabel" value={listing?.trouserSizeLabel ?? ""} />
      )}
      <Select
        name="condition"
        label="Condition"
        defaultValue={listing?.condition ?? "used_excellent"}
        required
        options={[
          ["new_with_tags", "New With Tags"],
          ["new_without_tags", "New Without Tags"],
          ["used_excellent", "Used - Excellent"],
          ["used_very_good", "Used - Very Good"],
          ["used_good", "Used - Good"],
          ["used_fair", "Used - Fair"],
          ["used_poor", "Used - Poor"]
        ]}
      />
      <Select
        name="vintage"
        label="Era"
        defaultValue={listing?.vintage ?? "modern"}
        required
        options={[
          ["modern", "Contemporary (~ post-2000)"],
          ["vintage_1970_2000", "Newer Vintage (~ 1970-2000)"],
          ["vintage_1940_1970", "Older Vintage (~ 1940-1970)"],
          ["vintage_pre_1940", "Antique (~ pre-1940)"]
        ]}
      />
        <CountryAutocomplete
          name="countryOfOrigin"
          queryName="countryOfOriginQuery"
          label="Country of Origin"
          defaultValue={listing?.countryOfOrigin ?? "unknown"}
        />

      {sanityCheck && sanityCheck.warnings.length > 0 ? (
        <div
          className={`sm:col-span-2 rounded-[1.5rem] px-4 py-4 text-sm ${
            sanityCheck.status === "unlikely"
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : "border border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="font-semibold">
            Please review these garment measurements before saving the listing.
          </p>
          <div className="mt-3 grid gap-2">
            {sanityCheck.warnings.map((warning) => (
              <p key={warning.code}>
                {warning.message}
              </p>
            ))}
          </div>
          {sanityCheck.recheckSuggestions.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {sanityCheck.recheckSuggestions.map((suggestion) => (
                <p key={suggestion}>{suggestion}</p>
              ))}
            </div>
          ) : null}
          {warningAction && warningDraft && warningMedia ? (
            <div className="mt-4">
              {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
              <input type="hidden" name="sellerListingDraft" value={warningDraft} />
              <input type="hidden" name="sellerListingMedia" value={warningMedia} />
              <button
                type="submit"
                formAction={warningAction}
                className="rounded-full border border-stone-900 bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                {warningButtonLabel ?? "Publish Anyway"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {shouldShowJacket(category) ? (
        <div className="sm:col-span-2 rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <p className="text-sm font-semibold text-stone-950">
            {category === "coat"
              ? "Coat Measurements and Specifications"
              : category === "shirt"
                ? "Shirt Measurements and Specifications"
                : category === "sweater"
                  ? "Sweater Measurements and Specifications"
                : "Jacket Measurements and Specifications"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isShirt ? <QuarterField name="jacketNeck" label="Neck" required defaultValue={listing?.jacketMeasurements?.neck} /> : null}
            <QuarterField name="jacketChest" label="Chest Width" required defaultValue={listing?.jacketMeasurements?.chest} />
            <QuarterField name="jacketWaist" label="Waist Width" required defaultValue={listing?.jacketMeasurements?.waist} />
            <QuarterField name="jacketShoulders" label="Shoulder Width" required defaultValue={listing?.jacketMeasurements?.shoulders} />
            <QuarterField name="jacketBodyLength" label="Body Length" required defaultValue={listing?.jacketMeasurements?.bodyLength} />
            <QuarterField name="jacketArmLength" label="Sleeve Length" required defaultValue={listing?.jacketMeasurements?.sleeveLength} />
            {!isShirt && !isSweater ? (
              <QuarterField
                name="jacketArmLengthAllowance"
                label="Sleeve Allowance"
                defaultValue={listing?.jacketMeasurements?.sleeveLengthAllowance}
              />
            ) : null}
            {isShirt ? (
              <>
                <Select
                  name="shirtCollarStyle"
                  label="Collar Style"
                  defaultValue={listing?.shirtSpecs?.collarStyle ?? "spread"}
                  required
                  options={[
                    ["spread", "Spread"],
                    ["point", "Point"],
                    ["button_down", "Button Down"],
                    ["club", "Club"],
                    ["band", "Band"],
                    ["wing", "Wing"],
                    ["cutaway", "Cutaway"],
                    ["tab", "Tab"]
                  ]}
                />
                <Select
                  name="shirtCuffStyle"
                  label="Cuff Style"
                  defaultValue={listing?.shirtSpecs?.cuffStyle ?? "barrel"}
                  required
                  options={[
                    ["barrel", "Barrel"],
                    ["french", "French"],
                    ["convertible", "Convertible"]
                  ]}
                />
                <Select
                  name="shirtPlacket"
                  label="Placket"
                  defaultValue={listing?.shirtSpecs?.placket ?? "standard"}
                  required
                  options={[
                    ["standard", "Standard"],
                    ["hidden", "Hidden"],
                    ["studs", "Studs"],
                    ["none", "None"]
                  ]}
                />
              </>
            ) : isSweater ? (
              <>
                <Select
                  name="sweaterNeckline"
                  label="Neckline"
                  defaultValue={listing?.sweaterSpecs?.neckline ?? "crew_neck"}
                  required
                  options={[
                    ["boat_neck", "Boat Neck"],
                    ["crew_neck", "Crew Neck"],
                    ["hooded", "Hooded"],
                    ["mock_neck", "Mock Neck"],
                    ["polo_collar", "Polo Collar"],
                    ["roll_neck", "Roll Neck"],
                    ["shawl_collar", "Shawl Collar"],
                    ["turtleneck", "Turtleneck"],
                    ["v_neck", "V-Neck"]
                  ]}
                />
                <Select
                  name="sweaterClosure"
                  label="Closure"
                  defaultValue={listing?.sweaterSpecs?.closure ?? "none"}
                  required
                  options={[
                    ["none", "Pullover/None"],
                    ["quarter_zip", "Quarter Zip"],
                    ["half_zip", "Half Zip"],
                    ["full_zip", "Full Zip"],
                    ["button_front", "Button Front"],
                    ["toggle_front", "Toggle Front"]
                  ]}
                />
              </>
            ) : (
              <>
                <Select
                  name="jacketCut"
                  label="Cut"
                  defaultValue={listing?.jacketSpecs?.cut ?? "single_breasted"}
                  required
                  options={[["single_breasted", "Single Breasted"], ["double_breasted", "Double Breasted"]]}
                />
                <Select
                  name="jacketLapel"
                  label="Lapel"
                  defaultValue={listing?.jacketSpecs?.lapel ?? "notch"}
                  required
                  options={[["notch", "Notch"], ["peak", "Peak"], ["shawl", "Shawl"]]}
                />
                <Select
                  name="jacketButtonStyle"
                  label="Button Style"
                  defaultValue={listing?.jacketSpecs?.buttonStyle ?? "2_buttons"}
                  required
                  options={[
                    ["1_button", "1 Button"],
                    ["2_buttons", "2 Buttons"],
                    ["3_buttons", "3 Buttons"],
                    ["4_buttons", "4 Buttons"],
                    ["5_buttons", "5 Buttons"],
                    ["6_buttons", "6 Buttons"],
                    ["8_buttons", "8 Buttons"]
                  ]}
                />
                <Select
                  name="jacketVentStyle"
                  label="Vent Style"
                  defaultValue={listing?.jacketSpecs?.ventStyle ?? "single_vented"}
                  required
                  options={[
                    ["unvented", "Unvented"],
                    ["single_vented", "Single Vented"],
                    ["double_vented", "Double Vented"]
                  ]}
                />
                <Select
                  name="jacketCanvas"
                  label="Canvas"
                  defaultValue={listing?.jacketSpecs?.canvas ?? "unknown"}
                  options={[
                    ["full", "Full"],
                    ["half", "Half"],
                    ["uncanvassed", "Uncanvassed"],
                    ["fused", "Fused"],
                    ["unknown", "Unknown"]
                  ]}
                />
                <Select
                  name="jacketLining"
                  label="Lining"
                  defaultValue={listing?.jacketSpecs?.lining ?? "full"}
                  options={[["full", "Full"], ["half", "Half"], ["unlined", "Unlined"]]}
                />
                <Select
                  name="jacketFormal"
                  label="Formal"
                  defaultValue={listing?.jacketSpecs?.formal ?? "na"}
                  options={formalOptions as unknown as Array<[string, string]>}
                />
              </>
            )}
          </div>
        </div>
      ) : null}

      {shouldShowWaistcoat(category) ? (
        <div className="sm:col-span-2 rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <p className="text-sm font-semibold text-stone-950">Waistcoat Measurements and Specifications</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuarterField name="waistcoatChest" label="Chest Width" required defaultValue={listing?.waistcoatMeasurements?.chest} />
            <QuarterField name="waistcoatWaist" label="Waist Width" required defaultValue={listing?.waistcoatMeasurements?.waist} />
            <QuarterField name="waistcoatShoulders" label="Shoulder Width" required defaultValue={listing?.waistcoatMeasurements?.shoulders} />
            <QuarterField name="waistcoatBodyLength" label="Body Length" required defaultValue={listing?.waistcoatMeasurements?.bodyLength} />
            <Select
              name="waistcoatCut"
              label="Cut"
              defaultValue={listing?.waistcoatSpecs?.cut ?? "single_breasted"}
              required
              options={[["single_breasted", "Single Breasted"], ["double_breasted", "Double Breasted"]]}
            />
            <Select
              name="waistcoatLapel"
              label="Lapel"
              defaultValue={listing?.waistcoatSpecs?.lapel ?? "na"}
              required
              options={[["notch", "Notch"], ["peak", "Peak"], ["shawl", "Shawl"], ["na", "N/A"]]}
            />
            <Select
              name="waistcoatFormal"
              label="Formal"
              defaultValue={listing?.waistcoatSpecs?.formal ?? "na"}
              options={formalOptions as unknown as Array<[string, string]>}
            />
          </div>
        </div>
      ) : null}

      {shouldShowTrousers(category) ? (
        <div className="sm:col-span-2 rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <p className="text-sm font-semibold text-stone-950">Trouser Measurements and Specifications</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuarterField name="trouserWaist" label="Waist Width" required defaultValue={listing?.trouserMeasurements?.waist} />
            <QuarterField name="trouserWaistAllowance" label="Waist Allowance" defaultValue={listing?.trouserMeasurements?.waistAllowance} />
            <QuarterField name="trouserHips" label="Hips Width" required defaultValue={listing?.trouserMeasurements?.hips} />
            <QuarterField name="trouserInseam" label="Inseam Length" required defaultValue={listing?.trouserMeasurements?.inseam} />
            <QuarterField name="trouserOutseam" label="Outseam Length" required defaultValue={listing?.trouserMeasurements?.outseam} />
            <QuarterField
              name="trouserInseamOutseamAllowance"
              label="Inseam/Outseam Allowance"
              defaultValue={listing?.trouserMeasurements?.inseamOutseamAllowance}
            />
            <QuarterField name="trouserOpening" label="Opening Width" required defaultValue={listing?.trouserMeasurements?.opening} />
            <Select
              name="trouserCut"
              label="Cut"
              defaultValue={listing?.trouserSpecs?.cut ?? "straight"}
              required
              options={[["wide", "Wide"], ["straight", "Straight"], ["tapered", "Tapered"], ["slim", "Slim"]]}
            />
            <Select
              name="trouserFront"
              label="Front"
              defaultValue={listing?.trouserSpecs?.front ?? "flat"}
              required
              options={[["flat", "Flat"], ["pleated", "Pleated"]]}
            />
            <Select
              name="trouserFormal"
              label="Formal"
              defaultValue={listing?.trouserSpecs?.formal ?? "na"}
              options={formalOptions as unknown as Array<[string, string]>}
            />
          </div>
        </div>
      ) : null}

      <div className="sm:col-span-2 rounded-[1.5rem] border border-stone-300 bg-white p-4">
        <p className="text-sm font-semibold text-stone-950">Fabric Specifications</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            name="material"
            label="Material"
            defaultValue={listing?.material ?? (isShirt ? "cotton" : isSweater ? "wool" : "unknown")}
            required
            options={(isShirt ? shirtMaterialOptions : isSweater ? sweaterMaterialOptions : materialOptions) as unknown as Array<[string, string]>}
          />
          {isSweater ? (
            <Select
              name="pattern"
              label="Pattern"
              defaultValue={listing?.pattern ?? "solid"}
              required
              options={sweaterPatternOptions as unknown as Array<[string, string]>}
            />
          ) : (
            <Select
              name="pattern"
              label="Pattern"
              defaultValue={listing?.pattern ?? "solid"}
              required
              options={(isShirt ? shirtPatternOptions : patternOptions) as unknown as Array<[string, string]>}
            />
          )}
          {isSweater ? (
            <Select
              name="primaryColor"
              label="Primary Color"
              defaultValue={listing?.primaryColor ?? "navy"}
              required
              options={primaryColorOptions as unknown as Array<[string, string]>}
            />
          ) : (
            <Select
              name="primaryColor"
              label="Primary Color"
              defaultValue={listing?.primaryColor ?? "navy"}
              required
              options={primaryColorOptions as unknown as Array<[string, string]>}
            />
          )}
          {isSweater ? (
            <Select
              name="fabricType"
              label="Knit Type"
              defaultValue={listing?.fabricType ?? ""}
              options={sweaterKnitTypeOptions as unknown as Array<[string, string]>}
            />
          ) : null}
          {!isSweater ? (
            <Select
              name="fabricType"
              label="Cloth Type"
              defaultValue={listing?.fabricType ?? (isShirt ? "na" : "other")}
              options={
                (isShirt
                  ? shirtFabricTypeOptions
                  : [
                      ["covert", "Covert"],
                      ["corduroy", "Corduroy"],
                      ["denim", "Denim"],
                      ["flannel", "Flannel"],
                      ["fresco", "Fresco"],
                      ["gabardine", "Gabardine"],
                      ["melton", "Melton"],
                      ["quilted", "Quilted"],
                      ["shearling", "Shearling"],
                      ["technical", "Technical"],
                      ["tweed", "Tweed"],
                      ["velvet", "Velvet"],
                      ["worsted", "Worsted"],
                      ["other", "Other"]
                    ]) as unknown as Array<[string, string]>
              }
            />
          ) : null}
          <Select
            name="fabricWeight"
            label="Cloth Weight"
            defaultValue={isSweater ? (listing?.fabricWeight ?? "") : (listing?.fabricWeight ?? "medium")}
            options={[["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]]}
          />
        </div>
      </div>
      <label className="sm:col-span-2 flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">Description (max. 1000 characters)</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={listing?.description ?? ""}
          maxLength={1000}
          className="rounded-[1.5rem] border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">
          Price
          <span className="ml-1 text-rose-700">*</span>
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-500">$</span>
          <input
            name="price"
            type="text"
            inputMode="decimal"
            value={price}
            placeholder="0.00"
            required
            onChange={(event) => handlePriceChange(event.target.value)}
            onBlur={handlePriceBlur}
            className="w-full rounded-2xl border border-stone-300 bg-white py-3 pl-8 pr-4 text-sm outline-none"
          />
        </div>
        </label>
        <Select
          name="allowOffers"
          label="Allow Offers?"
          defaultValue={listing?.allowOffers ? "yes" : "no"}
          required
          options={[["yes", "Yes"], ["no", "No"]]}
        />
        <Select
          name="returnsAccepted"
          label="Accept Returns?"
          defaultValue={listing?.returnsAccepted ? "yes" : "no"}
          required
          options={[["yes", "Yes"], ["no", "No"]]}
        />

      <div className="sm:col-span-2 flex flex-wrap gap-3">
        <button
          name="listingIntent"
          value={listing ? listing.status : "publish"}
          className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
        >
          {submitLabel}
        </button>
        {showDraftButton ? (
          <button
            name="listingIntent"
            value="save_draft"
            formNoValidate
            className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900"
          >
            Save as Draft
          </button>
        ) : null}
      </div>
    </form>
  );
}
