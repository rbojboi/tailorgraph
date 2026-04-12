"use client";

import Link from "next/link";
import { useRef, useState, type FocusEvent, type ReactNode } from "react";
import {
  generateBuyerMeasurementSuggestionsAction,
  generateBuyerMeasurementSuggestionsFromAnchorAction,
  saveBuyerMeasurementCategoryAction,
  saveBuyerProfileAction
} from "@/app/actions";
import { generateBuyerMeasurementSuggestionsFromAnchor } from "@/lib/measurement-guide";
import type { BuyerProfile } from "@/lib/types";

function normalizePositiveQuarterValue(event: FocusEvent<HTMLInputElement>) {
  const rawValue = event.currentTarget.value.trim();
  if (!rawValue) {
    return;
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) {
    event.currentTarget.value = "";
    return;
  }

  const roundedValue = Math.round(Math.max(0, numericValue) / 0.25) * 0.25;
  event.currentTarget.value = Number(roundedValue.toFixed(2)).toString();
}

function MeasurementField({
  name,
  label,
  defaultValue,
  disabled = false
}: {
  name: string;
  label: string;
  defaultValue?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        name={name}
        type="number"
        defaultValue={defaultValue ?? ""}
        placeholder="0.00"
        step={0.25}
        min={0}
        onBlur={normalizePositiveQuarterValue}
        readOnly={disabled}
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none read-only:bg-stone-50 read-only:text-stone-600"
      />
    </label>
  );
}

function MeasurementDetails({
  title,
  children,
  actionButton,
  detailsRef,
  onToggle
}: {
  title: string;
  children: ReactNode;
  actionButton?: ReactNode;
  detailsRef?: (node: HTMLDetailsElement | null) => void;
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details
      ref={detailsRef}
      onToggle={(event) => onToggle?.((event.currentTarget as HTMLDetailsElement).open)}
      className="rounded-[1.5rem] border border-stone-300 bg-white p-4"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-sm font-semibold text-stone-950">{title}</span>
          {actionButton}
        </div>
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </details>
  );
}

function getAnchorOptions(buyerProfile: BuyerProfile) {
  return [
    buyerProfile.jacketMeasurements ? { value: "jacket", label: "Jacket Profile" } : null
  ].filter((option): option is { value: string; label: string } => Boolean(option));
}

function hasExistingBuyerMeasurements(buyerProfile: BuyerProfile) {
  return Boolean(
    buyerProfile.jacketMeasurements ||
      buyerProfile.shirtMeasurements ||
      buyerProfile.waistcoatMeasurements ||
      buyerProfile.trouserMeasurements ||
      buyerProfile.coatMeasurements ||
      buyerProfile.sweaterMeasurements ||
      buyerProfile.suggestedMeasurementRanges
  );
}

export function BuyerMeasurementGuide({
  buyerProfile,
  returnTo,
  inputDefaults,
  sections = "all"
}: {
  buyerProfile: BuyerProfile;
  returnTo?: string;
  sections?: "all" | "builder" | "expander";
  inputDefaults?: {
    height?: number;
    weight?: number;
    bodyChest?: number;
    bodyWaist?: number;
    bodyHips?: number;
    bodyShoulders?: number;
    bodySleeve?: number;
    neck?: number;
    fitPreference?: BuyerProfile["fitPreference"];
    fillMissingOnly?: boolean;
  };
}) {
  const anchorOptions = getAnchorOptions(buyerProfile);
  const showOverrideConfirm = hasExistingBuyerMeasurements(buyerProfile);

  const shouldConfirmAnchorExpansion = (() => {
    const preserved = new Set(["jacket", "trousers"]);
    return (
      (!preserved.has("jacket") && Boolean(buyerProfile.jacketMeasurements)) ||
      (!preserved.has("shirt") && Boolean(buyerProfile.shirtMeasurements)) ||
      (!preserved.has("waistcoat") && Boolean(buyerProfile.waistcoatMeasurements)) ||
      (!preserved.has("coat") && Boolean(buyerProfile.coatMeasurements)) ||
      (!preserved.has("sweater") && Boolean(buyerProfile.sweaterMeasurements))
    );
  })();
  const hasSavedAnchorOptions = anchorOptions.length > 0;
  const [showAnchorTrouserFields, setShowAnchorTrouserFields] = useState(false);

  return (
    <section className="grid gap-4">
      {sections === "all" || sections === "builder" ? (
      <form
        action={generateBuyerMeasurementSuggestionsAction}
        className="rounded-[1.5rem] border border-stone-300 bg-white p-5"
        onSubmit={(event) => {
          if (!showOverrideConfirm) {
            return;
          }

          const confirmed = window.confirm(
            "Are you sure you would like to generate measurements? This will override your existing saved measurements."
          );

          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="returnTo" value={returnTo || "/buyer/measurements"} />
        <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Computer-Assisted Measurements Builder</p>
          <h3 className="mt-2 text-xl font-semibold text-stone-950">Convert body measurements into a tailored fit profile.</h3>
          <p className="mt-2 text-sm text-stone-600">
            Enter your body measurements and a fit preference, then let the system generate suggested measurements for
            jackets, waistcoats, trousers, coats, shirts, and sweaters. Those suggestions save directly into your fit
            profile, which you can use to refine the TailorGraph Marketplace.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MeasurementField name="height" label="Height (in.)" defaultValue={inputDefaults?.height ?? buyerProfile.height} />
          <MeasurementField name="weight" label="Weight (lbs.)" defaultValue={inputDefaults?.weight ?? buyerProfile.weight} />
          <MeasurementField name="bodyChest" label="Chest Circumference (in.)" defaultValue={inputDefaults?.bodyChest ?? buyerProfile.chest} />
          <MeasurementField name="bodyWaist" label="Waist Circumference (in.)" defaultValue={inputDefaults?.bodyWaist ?? buyerProfile.waist} />
          <MeasurementField
            name="bodyHips"
            label="Hips Circumference (in.)"
            defaultValue={inputDefaults?.bodyHips ?? buyerProfile.trouserMeasurements?.hips}
          />
          <MeasurementField
            name="bodyShoulders"
            label="Shoulder Width (in.)"
            defaultValue={inputDefaults?.bodyShoulders ?? buyerProfile.shoulder}
          />
          <MeasurementField
            name="bodySleeve"
            label="Arm Length (in.)"
            defaultValue={inputDefaults?.bodySleeve ?? buyerProfile.sleeve}
          />
          <MeasurementField name="neck" label="Neck Circumference (in.)" defaultValue={inputDefaults?.neck ?? buyerProfile.neck} />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-700">Fit Preference</span>
            <select
              name="fitPreference"
              defaultValue={inputDefaults?.fitPreference ?? buyerProfile.fitPreference}
              className="h-[46px] rounded-2xl border border-stone-300 bg-white px-4 py-0 text-sm outline-none"
            >
              <option value="trim">Trim</option>
              <option value="classic">Classic</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </label>
        </div>

        <div className="mt-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <span className="invisible text-sm font-medium">Build</span>
            <div className="flex items-end">
              <button className="w-full rounded-full border border-stone-300 bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                Build My Measurements
              </button>
            </div>
          </div>
          <div />
          <div />
        </div>
      </form>
      ) : null}

      {sections === "all" || sections === "expander" ? (
      <form
        action={generateBuyerMeasurementSuggestionsFromAnchorAction}
        className="rounded-[1.5rem] border border-stone-300 bg-white p-5"
        onSubmit={(event) => {
          if (!shouldConfirmAnchorExpansion) {
            return;
          }

          const confirmed = window.confirm(
            "Are you sure you would like to expand measurements? This will override your existing saved measurements in other upper-body categories."
          );

          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="returnTo" value={returnTo || "/buyer/measurements"} />
        <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Computer-Assisted Measurements Builder</p>
            <h3 className="mt-2 text-xl font-semibold text-stone-950">Build your tailored fit profile from what already suits your frame.</h3>
            <p className="mt-2 text-sm text-stone-600">
              Enter with the measurements of a well-fitting jacket, then let the system generate measurements for the
              rest of your upper-body garments. If available, adding the measurements of one well-fitting pair of
              trousers will further improve the accuracy of your fit profile and matching on the TailorGraph
              Marketplace.
            </p>
        </div>

        {hasSavedAnchorOptions ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="anchorCategory" value="jacket" />
            <MeasurementField
              name="anchorJacketChest"
              label="Chest Width (in.)"
              defaultValue={buyerProfile.jacketMeasurements?.chest}
            />
            <MeasurementField
              name="anchorJacketWaist"
              label="Waist Width (in.)"
              defaultValue={buyerProfile.jacketMeasurements?.waist}
            />
            <MeasurementField
              name="anchorJacketShoulders"
              label="Shoulders Width (in.)"
              defaultValue={buyerProfile.jacketMeasurements?.shoulders}
            />
            <MeasurementField
              name="anchorJacketBodyLength"
              label="Body Length (in.)"
              defaultValue={buyerProfile.jacketMeasurements?.bodyLength}
            />
            <MeasurementField
              name="anchorJacketArmLength"
              label="Sleeve Length (in.)"
              defaultValue={buyerProfile.jacketMeasurements?.sleeveLength}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <input type="hidden" name="anchorCategory" value="jacket" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MeasurementField name="anchorJacketChest" label="Chest Width (in.)" />
              <MeasurementField name="anchorJacketWaist" label="Waist Width (in.)" />
              <MeasurementField name="anchorJacketShoulders" label="Shoulders Width (in.)" />
              <MeasurementField name="anchorJacketBodyLength" label="Body Length (in.)" />
              <MeasurementField name="anchorJacketArmLength" label="Sleeve Length (in.)" />
            </div>
          </div>
        )}
        <div className="mt-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <span className="invisible text-sm font-medium">Expand</span>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowAnchorTrouserFields((current) => !current)}
                className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900"
              >
                {showAnchorTrouserFields ? "Hide Trousers Measurements" : "Add Trousers Measurements"}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <span className="invisible text-sm font-medium">Expand</span>
            <div className="flex items-end">
              <button
                disabled={hasSavedAnchorOptions && anchorOptions.length === 0}
                className="w-full rounded-full border border-stone-300 bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                Build My Upper-Body Measurements
              </button>
            </div>
          </div>
          <div />
        </div>
        {showAnchorTrouserFields ? (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MeasurementField
                name="anchorTrouserWaist"
                label="Waist Width (in.)"
                defaultValue={buyerProfile.trouserMeasurements?.waist}
              />
              <MeasurementField
                name="anchorTrouserHips"
                label="Hips (in.)"
                defaultValue={buyerProfile.trouserMeasurements?.hips}
              />
              <MeasurementField
                name="anchorTrouserInseam"
                label="Inseam Length (in.)"
                defaultValue={buyerProfile.trouserMeasurements?.inseam}
              />
              <MeasurementField
                name="anchorTrouserOutseam"
                label="Outseam Length (in.)"
                defaultValue={buyerProfile.trouserMeasurements?.outseam}
              />
              <MeasurementField
                name="anchorTrouserOpening"
                label="Opening Width (in.)"
                defaultValue={buyerProfile.trouserMeasurements?.opening}
              />
            </div>
            <div className="mt-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <span className="invisible text-sm font-medium">Build</span>
                <div className="flex items-end">
                  <button
                    disabled={hasSavedAnchorOptions && anchorOptions.length === 0}
                    className="w-full rounded-full border border-stone-300 bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    Build My Full Measurements
                  </button>
                </div>
              </div>
              <div />
              <div />
            </div>
          </div>
        ) : null}
      </form>
      ) : null}
    </section>
  );
}

export function BuyerProfileForm({
  buyerProfile,
  cancelHref,
  returnTo,
  inputDefaults,
  submitLabel = "Save Buyer Measurements",
  showFooterActions = true,
  topSpacingClass = "mt-5"
}: {
  buyerProfile: BuyerProfile;
  cancelHref?: string;
  returnTo?: string;
  inputDefaults?: Record<string, number | undefined>;
  submitLabel?: string;
  showFooterActions?: boolean;
  topSpacingClass?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveCategoryInputRef = useRef<HTMLInputElement>(null);
  const detailsRefs = useRef<Partial<Record<"jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater", HTMLDetailsElement | null>>>({});
  const inputValue = (key: string, fallback?: number) => inputDefaults?.[key] ?? fallback;
  const [categoryMode, setCategoryMode] = useState<
    Partial<Record<"jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater", "view" | "edit">>
  >({});
  const [categoryOpen, setCategoryOpen] = useState<
    Partial<Record<"jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater", boolean>>
  >({});
  const [fillFromProfileByCategory, setFillFromProfileByCategory] = useState<
    Partial<Record<"jacket" | "shirt" | "waistcoat" | "coat" | "sweater", boolean>>
  >({});
  const [fillErrorByCategory, setFillErrorByCategory] = useState<
    Partial<Record<"jacket" | "shirt" | "waistcoat" | "coat" | "sweater", string>>
  >({});

  const setFormFieldValue = (name: string, value?: number) => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      field.value = value === undefined ? "" : value.toString();
    }
  };

  const categoryHasSavedData = (category: "jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater") => {
    const values =
      category === "jacket"
        ? Object.values(buyerProfile.jacketMeasurements ?? {})
        : category === "shirt"
          ? Object.values(buyerProfile.shirtMeasurements ?? {})
          : category === "waistcoat"
            ? Object.values(buyerProfile.waistcoatMeasurements ?? {})
            : category === "trouser"
              ? Object.values(buyerProfile.trouserMeasurements ?? {})
              : category === "coat"
                ? Object.values(buyerProfile.coatMeasurements ?? {})
                : Object.values(buyerProfile.sweaterMeasurements ?? {});

    return values.some((value) => typeof value === "number" && value > 0);
  };

  const openCategory = (category: "jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater", mode: "view" | "edit") => {
    setCategoryMode((current) => ({
      ...current,
      [category]: mode
    }));
    setCategoryOpen((current) => ({
      ...current,
      [category]: true
    }));
    detailsRefs.current[category]?.setAttribute("open", "true");
  };

  const hideCategory = (category: "jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater") => {
    setCategoryMode((current) => ({
      ...current,
      [category]: "view"
    }));
    setCategoryOpen((current) => ({
      ...current,
      [category]: false
    }));
    detailsRefs.current[category]?.removeAttribute("open");
  };

  const applyPrefillFromProfile = (targetCategory: "jacket" | "shirt" | "waistcoat" | "coat" | "sweater") => {
    const sourceProfile = buyerProfile.jacketMeasurements;

    if (!sourceProfile) {
      setFillErrorByCategory((current) => ({
        ...current,
        [targetCategory]: "No saved jacket profile is available yet."
      }));
      setFillFromProfileByCategory((current) => ({
        ...current,
        [targetCategory]: false
      }));
      return;
    }

    const suggestions = generateBuyerMeasurementSuggestionsFromAnchor(buyerProfile, "jacket");
    const targetMeasurements =
      targetCategory === "jacket"
        ? suggestions.jacketMeasurements
        : targetCategory === "shirt"
          ? suggestions.shirtMeasurements
          : targetCategory === "waistcoat"
            ? suggestions.waistcoatMeasurements
            : targetCategory === "coat"
              ? suggestions.coatMeasurements
              : suggestions.sweaterMeasurements;

    const fieldNames =
      targetCategory === "jacket"
        ? {
            chest: "buyerJacketChest",
            waist: "buyerJacketWaist",
            shoulders: "buyerJacketShoulders",
            bodyLength: "buyerJacketBodyLength",
            sleeveLength: "buyerJacketArmLength"
          }
        : targetCategory === "shirt"
          ? {
              neck: "buyerShirtNeck",
              chest: "buyerShirtChest",
              waist: "buyerShirtWaist",
              shoulders: "buyerShirtShoulders",
              bodyLength: "buyerShirtBodyLength",
              sleeveLength: "buyerShirtArmLength"
            }
          : targetCategory === "waistcoat"
            ? {
                chest: "buyerWaistcoatChest",
                waist: "buyerWaistcoatWaist",
                shoulders: "buyerWaistcoatShoulders",
                bodyLength: "buyerWaistcoatBodyLength"
              }
            : targetCategory === "coat"
              ? {
                  chest: "buyerCoatChest",
                  waist: "buyerCoatWaist",
                  shoulders: "buyerCoatShoulders",
                  bodyLength: "buyerCoatBodyLength",
                  sleeveLength: "buyerCoatArmLength"
                }
              : {
                  chest: "buyerSweaterChest",
                  waist: "buyerSweaterWaist",
                  shoulders: "buyerSweaterShoulders",
                  bodyLength: "buyerSweaterBodyLength",
                  sleeveLength: "buyerSweaterArmLength"
                };

    Object.entries(fieldNames).forEach(([key, fieldName]) => {
      const value = targetMeasurements && key in targetMeasurements ? (targetMeasurements as Record<string, number | undefined>)[key] : undefined;
      setFormFieldValue(fieldName, value);
    });

    setFillErrorByCategory((current) => ({
      ...current,
      [targetCategory]: ""
    }));
  };

  const buildButton = (targetCategory: "jacket" | "shirt" | "waistcoat" | "coat" | "sweater") => {
    if (
      targetCategory === "jacket" ||
      !buyerProfile.jacketMeasurements ||
      categoryMode[targetCategory] !== "edit"
    ) {
      return null;
    }

    return (
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-stone-900">
        <span>Fill from Jacket Profile</span>
        <input
          type="checkbox"
          checked={Boolean(fillFromProfileByCategory[targetCategory])}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setFillFromProfileByCategory((current) => ({
              ...current,
              [targetCategory]: checked
            }));

            if (checked) {
              detailsRefs.current[targetCategory]?.setAttribute("open", "true");
              applyPrefillFromProfile(targetCategory);
            }
          }}
          className="h-4 w-4 shrink-0 rounded border-stone-300"
        />
        {fillErrorByCategory[targetCategory] ? (
          <span className="text-rose-700">{fillErrorByCategory[targetCategory]}</span>
        ) : null}
      </div>
    );
  };

  const categoryControls = (
    categoryKey: "jacket" | "shirt" | "waistcoat" | "trouser" | "coat" | "sweater",
    categoryField: "jacketMeasurements" | "shirtMeasurements" | "waistcoatMeasurements" | "trouserMeasurements" | "coatMeasurements" | "sweaterMeasurements"
  ) => {
    const isEditing = categoryMode[categoryKey] === "edit";
    const isOpen = Boolean(categoryOpen[categoryKey]);

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {categoryKey !== "trouser" ? buildButton(categoryKey) : null}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isOpen && !isEditing) {
              hideCategory(categoryKey);
              return;
            }

            openCategory(categoryKey, "view");
          }}
          className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900"
        >
          {isOpen && !isEditing ? "Hide" : "View"}
        </button>
        {isEditing ? (
          <button
            type="submit"
            formAction={saveBuyerMeasurementCategoryAction}
            onMouseDown={() => {
              if (saveCategoryInputRef.current) {
                saveCategoryInputRef.current.value = categoryField;
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (saveCategoryInputRef.current) {
                saveCategoryInputRef.current.value = categoryField;
              }
            }}
            className="rounded-full border border-stone-300 bg-stone-950 px-3 py-2 text-xs font-semibold text-white"
          >
            Save
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openCategory(categoryKey, "edit");
            }}
            className="rounded-full border border-stone-300 bg-stone-950 px-3 py-2 text-xs font-semibold text-white"
          >
            Edit
          </button>
        )}
      </div>
    );
  };

  return (
    <form ref={formRef} action={saveBuyerProfileAction} className={`${topSpacingClass} grid gap-4`}>
      <input type="hidden" name="returnTo" value={returnTo || cancelHref || "/buyer"} />
      <input ref={saveCategoryInputRef} type="hidden" name="saveCategory" defaultValue="" />

      <MeasurementDetails
        title="Jacket Measurements"
        detailsRef={(node) => { detailsRefs.current.jacket = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, jacket: open }))}
        actionButton={categoryControls("jacket", "jacketMeasurements")}
      >
        <MeasurementField name="buyerJacketChest" label="Chest Width (in.)" defaultValue={inputValue("buyerJacketChest", buyerProfile.jacketMeasurements?.chest)} disabled={categoryMode.jacket !== "edit"} />
        <MeasurementField name="buyerJacketWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerJacketWaist", buyerProfile.jacketMeasurements?.waist)} disabled={categoryMode.jacket !== "edit"} />
        <MeasurementField name="buyerJacketShoulders" label="Shoulders Width (in.)" defaultValue={inputValue("buyerJacketShoulders", buyerProfile.jacketMeasurements?.shoulders)} disabled={categoryMode.jacket !== "edit"} />
        <MeasurementField name="buyerJacketBodyLength" label="Body Length (in.)" defaultValue={inputValue("buyerJacketBodyLength", buyerProfile.jacketMeasurements?.bodyLength)} disabled={categoryMode.jacket !== "edit"} />
        <MeasurementField name="buyerJacketArmLength" label="Sleeve Length (in.)" defaultValue={inputValue("buyerJacketArmLength", buyerProfile.jacketMeasurements?.sleeveLength)} disabled={categoryMode.jacket !== "edit"} />
      </MeasurementDetails>

      <MeasurementDetails
        title="Waistcoat Measurements"
        detailsRef={(node) => { detailsRefs.current.waistcoat = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, waistcoat: open }))}
        actionButton={categoryControls("waistcoat", "waistcoatMeasurements")}
      >
        <MeasurementField name="buyerWaistcoatChest" label="Chest Width (in.)" defaultValue={inputValue("buyerWaistcoatChest", buyerProfile.waistcoatMeasurements?.chest)} disabled={categoryMode.waistcoat !== "edit"} />
        <MeasurementField name="buyerWaistcoatWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerWaistcoatWaist", buyerProfile.waistcoatMeasurements?.waist)} disabled={categoryMode.waistcoat !== "edit"} />
        <MeasurementField name="buyerWaistcoatShoulders" label="Shoulders Width (in.)" defaultValue={inputValue("buyerWaistcoatShoulders", buyerProfile.waistcoatMeasurements?.shoulders)} disabled={categoryMode.waistcoat !== "edit"} />
        <MeasurementField name="buyerWaistcoatBodyLength" label="Body Length (in.)" defaultValue={inputValue("buyerWaistcoatBodyLength", buyerProfile.waistcoatMeasurements?.bodyLength)} disabled={categoryMode.waistcoat !== "edit"} />
      </MeasurementDetails>

      <MeasurementDetails
        title="Trousers Measurements"
        detailsRef={(node) => { detailsRefs.current.trouser = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, trouser: open }))}
        actionButton={categoryControls("trouser", "trouserMeasurements")}
      >
        <MeasurementField name="buyerTrouserWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerTrouserWaist", buyerProfile.trouserMeasurements?.waist)} disabled={categoryMode.trouser !== "edit"} />
        <MeasurementField name="buyerTrouserHips" label="Hips (in.)" defaultValue={inputValue("buyerTrouserHips", buyerProfile.trouserMeasurements?.hips)} disabled={categoryMode.trouser !== "edit"} />
        <MeasurementField name="buyerTrouserInseam" label="Inseam Length (in.)" defaultValue={inputValue("buyerTrouserInseam", buyerProfile.trouserMeasurements?.inseam)} disabled={categoryMode.trouser !== "edit"} />
        <MeasurementField name="buyerTrouserOutseam" label="Outseam Length (in.)" defaultValue={inputValue("buyerTrouserOutseam", buyerProfile.trouserMeasurements?.outseam)} disabled={categoryMode.trouser !== "edit"} />
        <MeasurementField name="buyerTrouserOpening" label="Opening Width (in.)" defaultValue={inputValue("buyerTrouserOpening", buyerProfile.trouserMeasurements?.opening)} disabled={categoryMode.trouser !== "edit"} />
      </MeasurementDetails>

      <MeasurementDetails
        title="Coat Measurements"
        detailsRef={(node) => { detailsRefs.current.coat = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, coat: open }))}
        actionButton={categoryControls("coat", "coatMeasurements")}
      >
        <MeasurementField name="buyerCoatChest" label="Chest Width (in.)" defaultValue={inputValue("buyerCoatChest", buyerProfile.coatMeasurements?.chest)} disabled={categoryMode.coat !== "edit"} />
        <MeasurementField name="buyerCoatWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerCoatWaist", buyerProfile.coatMeasurements?.waist)} disabled={categoryMode.coat !== "edit"} />
        <MeasurementField name="buyerCoatShoulders" label="Shoulders Width (in.)" defaultValue={inputValue("buyerCoatShoulders", buyerProfile.coatMeasurements?.shoulders)} disabled={categoryMode.coat !== "edit"} />
        <MeasurementField name="buyerCoatBodyLength" label="Body Length (in.)" defaultValue={inputValue("buyerCoatBodyLength", buyerProfile.coatMeasurements?.bodyLength)} disabled={categoryMode.coat !== "edit"} />
        <MeasurementField name="buyerCoatArmLength" label="Sleeve Length (in.)" defaultValue={inputValue("buyerCoatArmLength", buyerProfile.coatMeasurements?.sleeveLength)} disabled={categoryMode.coat !== "edit"} />
      </MeasurementDetails>

      <MeasurementDetails
        title="Shirt Measurements"
        detailsRef={(node) => { detailsRefs.current.shirt = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, shirt: open }))}
        actionButton={categoryControls("shirt", "shirtMeasurements")}
      >
        <MeasurementField name="buyerShirtNeck" label="Neck Circumference (in.)" defaultValue={inputValue("buyerShirtNeck", buyerProfile.shirtMeasurements?.neck)} disabled={categoryMode.shirt !== "edit"} />
        <MeasurementField name="buyerShirtChest" label="Chest Width (in.)" defaultValue={inputValue("buyerShirtChest", buyerProfile.shirtMeasurements?.chest)} disabled={categoryMode.shirt !== "edit"} />
        <MeasurementField name="buyerShirtWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerShirtWaist", buyerProfile.shirtMeasurements?.waist)} disabled={categoryMode.shirt !== "edit"} />
        <MeasurementField name="buyerShirtShoulders" label="Shoulders Width (in.)" defaultValue={inputValue("buyerShirtShoulders", buyerProfile.shirtMeasurements?.shoulders)} disabled={categoryMode.shirt !== "edit"} />
        <MeasurementField name="buyerShirtBodyLength" label="Body Length (in.)" defaultValue={inputValue("buyerShirtBodyLength", buyerProfile.shirtMeasurements?.bodyLength)} disabled={categoryMode.shirt !== "edit"} />
        <MeasurementField name="buyerShirtArmLength" label="Sleeve Length (in.)" defaultValue={inputValue("buyerShirtArmLength", buyerProfile.shirtMeasurements?.sleeveLength)} disabled={categoryMode.shirt !== "edit"} />
      </MeasurementDetails>

      <MeasurementDetails
        title="Sweater Measurements"
        detailsRef={(node) => { detailsRefs.current.sweater = node; }}
        onToggle={(open) => setCategoryOpen((current) => ({ ...current, sweater: open }))}
        actionButton={categoryControls("sweater", "sweaterMeasurements")}
      >
        <MeasurementField name="buyerSweaterChest" label="Chest Width (in.)" defaultValue={inputValue("buyerSweaterChest", buyerProfile.sweaterMeasurements?.chest)} disabled={categoryMode.sweater !== "edit"} />
        <MeasurementField name="buyerSweaterWaist" label="Waist Width (in.)" defaultValue={inputValue("buyerSweaterWaist", buyerProfile.sweaterMeasurements?.waist)} disabled={categoryMode.sweater !== "edit"} />
        <MeasurementField name="buyerSweaterShoulders" label="Shoulders Width (in.)" defaultValue={inputValue("buyerSweaterShoulders", buyerProfile.sweaterMeasurements?.shoulders)} disabled={categoryMode.sweater !== "edit"} />
        <MeasurementField name="buyerSweaterBodyLength" label="Body Length (in.)" defaultValue={inputValue("buyerSweaterBodyLength", buyerProfile.sweaterMeasurements?.bodyLength)} disabled={categoryMode.sweater !== "edit"} />
        <MeasurementField name="buyerSweaterArmLength" label="Sleeve Length (in.)" defaultValue={inputValue("buyerSweaterArmLength", buyerProfile.sweaterMeasurements?.sleeveLength)} disabled={categoryMode.sweater !== "edit"} />
      </MeasurementDetails>

      {showFooterActions ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">{submitLabel}</button>
          {cancelHref ? (
            <Link
              href={cancelHref}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Cancel
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
