"use client";

import { useState } from "react";
import { MarketplaceMultiSelect } from "@/components/marketplace-multi-select";
import { MarketplaceRangeField } from "@/components/marketplace-range-field";

function formatQuarterRange(value: number) {
  return {
    min: Number(Math.max(0, value - 0.25).toFixed(2)).toString(),
    max: Number(Math.max(0, value + 0.25).toFixed(2)).toString()
  };
}

function resolveRange(minValue: string, maxValue: string, profileValue: number | null | undefined, useProfileMeasurements: boolean) {
  if (minValue || maxValue) {
    return { min: minValue, max: maxValue };
  }

  if (!useProfileMeasurements || profileValue === null || profileValue === undefined) {
    return { min: minValue, max: maxValue };
  }

  return formatQuarterRange(profileValue);
}

export function MarketplaceTrousersFilters({
  section = "both",
  useProfileMeasurements,
  waistMin,
  waistMax,
  hipsMin,
  hipsMax,
  inseamMin,
  inseamMax,
  outseamMin,
  outseamMax,
  openingMin,
  openingMax,
  waistPlaceholder,
  hipsPlaceholder,
  inseamPlaceholder,
  outseamPlaceholder,
  openingPlaceholder,
  waistAllowanceChecked,
  lengthAllowanceChecked,
  cutOptions,
  frontOptions,
  formalOptions,
  selectedCuts,
  selectedFronts,
  selectedFormal,
  waistProfileValue,
  hipsProfileValue,
  inseamProfileValue,
  outseamProfileValue,
  openingProfileValue
}: {
  section?: "both" | "filters" | "measurements";
  useProfileMeasurements: boolean;
  waistMin: string;
  waistMax: string;
  hipsMin: string;
  hipsMax: string;
  inseamMin: string;
  inseamMax: string;
  outseamMin: string;
  outseamMax: string;
  openingMin: string;
  openingMax: string;
  waistPlaceholder: string;
  hipsPlaceholder: string;
  inseamPlaceholder: string;
  outseamPlaceholder: string;
  openingPlaceholder: string;
  waistAllowanceChecked: boolean;
  lengthAllowanceChecked: boolean;
  cutOptions: Array<[string, string]>;
  frontOptions: Array<[string, string]>;
  formalOptions: Array<[string, string]>;
  selectedCuts: string[];
  selectedFronts: string[];
  selectedFormal: string[];
  waistProfileValue?: number | null;
  hipsProfileValue?: number | null;
  inseamProfileValue?: number | null;
  outseamProfileValue?: number | null;
  openingProfileValue?: number | null;
}) {
  const [linkedLengthAllowance, setLinkedLengthAllowance] = useState(lengthAllowanceChecked);
  const waistRange = resolveRange(waistMin, waistMax, waistProfileValue, useProfileMeasurements);
  const hipsRange = resolveRange(hipsMin, hipsMax, hipsProfileValue, useProfileMeasurements);
  const inseamRange = resolveRange(inseamMin, inseamMax, inseamProfileValue, useProfileMeasurements);
  const outseamRange = resolveRange(outseamMin, outseamMax, outseamProfileValue, useProfileMeasurements);
  const openingRange = resolveRange(openingMin, openingMax, openingProfileValue, useProfileMeasurements);
  const shouldOpen =
    useProfileMeasurements ||
    Boolean(
      waistMin ||
      waistMax ||
      hipsMin ||
      hipsMax ||
      inseamMin ||
      inseamMax ||
      outseamMin ||
      outseamMax ||
      openingMin ||
      openingMax
    );

  return (
    <>
      {section !== "filters" ? (
        <details
          className="rounded-[1.5rem] border border-stone-300 bg-white p-4"
          open={shouldOpen}
        >
          <summary className="filter-section-title cursor-pointer">Trousers Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField
              key={`trouserWaist-${useProfileMeasurements}-${waistRange.min}-${waistRange.max}`}
              minName="trouserWaistMin"
              maxName="trouserWaistMax"
              label="Waist Width (in.)"
              minDefaultValue={waistRange.min}
              maxDefaultValue={waistRange.max}
              placeholder={waistPlaceholder}
              allowanceName="trouserWaistIncludeAllowance"
              allowanceChecked={waistAllowanceChecked}
            />
            <MarketplaceRangeField
              key={`trouserHips-${useProfileMeasurements}-${hipsRange.min}-${hipsRange.max}`}
              minName="trouserHipsMin"
              maxName="trouserHipsMax"
              label="Hips (in.)"
              minDefaultValue={hipsRange.min}
              maxDefaultValue={hipsRange.max}
              placeholder={hipsPlaceholder}
            />
            <MarketplaceRangeField
              key={`trouserInseam-${useProfileMeasurements}-${inseamRange.min}-${inseamRange.max}`}
              minName="trouserInseamMin"
              maxName="trouserInseamMax"
              label="Inseam Length (in.)"
              minDefaultValue={inseamRange.min}
              maxDefaultValue={inseamRange.max}
              placeholder={inseamPlaceholder}
              allowanceName="trouserInseamIncludeAllowance"
              allowanceChecked={linkedLengthAllowance}
              onAllowanceChange={setLinkedLengthAllowance}
            />
            <MarketplaceRangeField
              key={`trouserOutseam-${useProfileMeasurements}-${outseamRange.min}-${outseamRange.max}`}
              minName="trouserOutseamMin"
              maxName="trouserOutseamMax"
              label="Outseam Length (in.)"
              minDefaultValue={outseamRange.min}
              maxDefaultValue={outseamRange.max}
              placeholder={outseamPlaceholder}
              allowanceName="trouserOutseamIncludeAllowance"
              allowanceChecked={linkedLengthAllowance}
              onAllowanceChange={setLinkedLengthAllowance}
            />
            <MarketplaceRangeField
              key={`trouserOpening-${useProfileMeasurements}-${openingRange.min}-${openingRange.max}`}
              minName="trouserOpeningMin"
              maxName="trouserOpeningMax"
              label="Opening Width (in.)"
              minDefaultValue={openingRange.min}
              maxDefaultValue={openingRange.max}
              placeholder={openingPlaceholder}
            />
          </div>
        </details>
      ) : null}
      {section !== "measurements" ? (
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Trousers Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="trouserCut" label="Cut" options={cutOptions} selectedValues={selectedCuts} allLabel="All Cuts" />
            <MarketplaceMultiSelect name="trouserFront" label="Front" options={frontOptions} selectedValues={selectedFronts} allLabel="All Fronts" />
            <MarketplaceMultiSelect name="trouserFormal" label="Formal" options={formalOptions} selectedValues={selectedFormal} allLabel="All Formal Types" />
          </div>
        </details>
      ) : null}
    </>
  );
}
