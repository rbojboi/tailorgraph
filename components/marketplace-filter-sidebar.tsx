"use client";

import { useEffect, useRef, useState } from "react";
import { BrandFilter } from "@/components/brand-filter";
import { CountryFilter } from "@/components/country-filter";
import { MarketplaceDropdownChecklist } from "@/components/marketplace-dropdown-checklist";
import { MarketplaceGarmentFilters } from "@/components/marketplace-garment-filters";
import { MarketplaceMultiSelect } from "@/components/marketplace-multi-select";
import { MarketplacePriceRange } from "@/components/marketplace-price-range";
import { MarketplaceRangeField } from "@/components/marketplace-range-field";
import { SearchableChecklistFilter } from "@/components/searchable-checklist-filter";
import { MarketplaceTrousersFilters } from "@/components/marketplace-trousers-filters";
import { getMarketplaceSizeFilterConfig } from "@/lib/sizing";
import type { MarketplaceFitMode } from "@/app/page";
import type { BuyerProfile } from "@/lib/types";

function formatRange(value: number, halfSpread = 0.25) {
  return {
    min: Number(Math.max(0, value - halfSpread).toFixed(2)).toString(),
    max: Number(Math.max(0, value + halfSpread).toFixed(2)).toString()
  };
}

function resolveRange(
  minValue: string,
  maxValue: string,
  profileValue: number | null | undefined,
  useProfileFilters: boolean,
  halfSpread = 0.25
) {
  if (minValue || maxValue) {
    return { min: minValue, max: maxValue };
  }

  if (!useProfileFilters || profileValue === null || profileValue === undefined) {
    return { min: minValue, max: maxValue };
  }

  return formatRange(profileValue, halfSpread);
}

function resolveSuggestedRange(
  minValue: string,
  maxValue: string,
  suggestedRange: { min: number; max: number } | null | undefined,
  profileValue: number | null | undefined,
  useProfileFilters: boolean,
  halfSpread = 0.25
) {
  if (minValue || maxValue) {
    return { min: minValue, max: maxValue };
  }

  if (!useProfileFilters) {
    return { min: minValue, max: maxValue };
  }

  return resolveRange(minValue, maxValue, profileValue, useProfileFilters, halfSpread);
}

function countMeaningfulMeasurementValues(measurements: Record<string, unknown> | null | undefined) {
  if (!measurements) {
    return 0;
  }

  return Object.entries(measurements).filter(([key, value]) => {
    if (key.endsWith("Allowance")) {
      return false;
    }

    return typeof value === "number" && value > 0;
  }).length;
}

function hasSavedFitMeasurements(profile: BuyerProfile | undefined) {
  if (!profile) {
    return false;
  }

  return [
    profile.jacketMeasurements,
    profile.shirtMeasurements,
    profile.waistcoatMeasurements,
    profile.trouserMeasurements,
    profile.coatMeasurements,
    profile.sweaterMeasurements
  ].some((measurements) => countMeaningfulMeasurementValues(measurements) > 0);
}

const MEASUREMENT_RANGE_FIELD_NAMES = [
  "jacketChestMin",
  "jacketChestMax",
  "jacketWaistMin",
  "jacketWaistMax",
  "jacketShouldersMin",
  "jacketShouldersMax",
  "jacketBodyLengthMin",
  "jacketBodyLengthMax",
  "jacketArmLengthMin",
  "jacketArmLengthMax",
  "shirtNeckMin",
  "shirtNeckMax",
  "shirtChestMin",
  "shirtChestMax",
  "shirtWaistMin",
  "shirtWaistMax",
  "shirtShouldersMin",
  "shirtShouldersMax",
  "shirtBodyLengthMin",
  "shirtBodyLengthMax",
  "shirtArmLengthMin",
  "shirtArmLengthMax",
  "sweaterChestMin",
  "sweaterChestMax",
  "sweaterWaistMin",
  "sweaterWaistMax",
  "sweaterShouldersMin",
  "sweaterShouldersMax",
  "sweaterBodyLengthMin",
  "sweaterBodyLengthMax",
  "sweaterArmLengthMin",
  "sweaterArmLengthMax",
  "waistcoatChestMin",
  "waistcoatChestMax",
  "waistcoatWaistMin",
  "waistcoatWaistMax",
  "waistcoatShouldersMin",
  "waistcoatShouldersMax",
  "waistcoatBodyLengthMin",
  "waistcoatBodyLengthMax",
  "trouserWaistMin",
  "trouserWaistMax",
  "trouserHipsMin",
  "trouserHipsMax",
  "trouserInseamMin",
  "trouserInseamMax",
  "trouserOutseamMin",
  "trouserOutseamMax",
  "trouserOpeningMin",
  "trouserOpeningMax",
  "coatChestMin",
  "coatChestMax",
  "coatWaistMin",
  "coatWaistMax",
  "coatShouldersMin",
  "coatShouldersMax",
  "coatBodyLengthMin",
  "coatBodyLengthMax",
  "coatArmLengthMin",
  "coatArmLengthMax"
];

function hasSubmittedMeasurementRange(formData: FormData) {
  return MEASUREMENT_RANGE_FIELD_NAMES.some((fieldName) => {
    const value = formData.get(fieldName);
    return typeof value === "string" && value.trim() !== "";
  });
}

function isShirtOnlySelection(categories: string[]) {
  return categories.length > 0 && categories.every((category) => category === "shirt");
}

function isSweaterOnlySelection(categories: string[]) {
  return categories.length > 0 && categories.every((category) => category === "sweater");
}

function isNonShirtOrSweaterOnlySelection(categories: string[]) {
  return categories.length > 0 && categories.every((category) => category !== "shirt" && category !== "sweater");
}

export function MarketplaceFilterSidebar({
  userHasProfile,
  buyerProfile,
  selectedCategories,
  selectedSizeLabels,
  sizeLabelPartOne,
  sizeLabelPartTwo,
  categoryOptions,
  selectedIncludedBrandIds,
  selectedExcludedBrandIds,
  selectedMaterials,
  materialOptions,
  shirtMaterialOptions,
  sweaterMaterialOptions,
  sweaterKnitTypeOptions,
  selectedPatterns,
  patternOptions,
  shirtPatternOptions,
  sweaterPatternOptions,
  selectedPrimaryColors,
  primaryColorOptions,
  selectedCountryOrigins,
  countryOfOriginOptions,
  selectedFabricTypes,
  fabricTypeOptions,
  shirtClothTypeOptions,
  selectedFabricWeights,
  fabricWeightOptions,
  selectedConditions,
  conditionOptions,
  selectedVintage,
  vintageOptions,
  selectedReturnsAccepted,
  selectedAllowOffers,
  yesNoOptions,
  breastedCutOptions,
  lapelOptions,
  waistcoatLapelOptions,
  jacketButtonStyleOptions,
  ventStyleOptions,
  shirtCollarStyleOptions,
  shirtCuffStyleOptions,
  shirtPlacketOptions,
  sweaterNecklineOptions,
  sweaterClosureOptions,
  canvasOptions,
  liningOptions,
  formalOptions,
  trouserCutOptions,
  trouserFrontOptions,
  selectedJacketCuts,
  selectedJacketLapels,
  selectedJacketButtonStyles,
  selectedJacketVentStyles,
  selectedJacketCanvas,
  selectedJacketLining,
  selectedJacketFormal,
  selectedShirtCollarStyles,
  selectedShirtCuffStyles,
  selectedShirtPlackets,
  selectedSweaterNecklines,
  selectedSweaterClosures,
  selectedWaistcoatCuts,
  selectedWaistcoatLapels,
  selectedWaistcoatFormal,
  selectedTrouserCuts,
  selectedTrouserFronts,
  selectedTrouserFormal,
  selectedCoatCuts,
  selectedCoatLapels,
  selectedCoatButtonStyles,
  selectedCoatVentStyles,
  selectedCoatCanvas,
  selectedCoatLining,
  selectedCoatFormal,
  keywordQuery,
  minPrice,
  maxPrice,
  fitMode,
  useProfileMeasurements,
  jacketChestMin,
  jacketChestMax,
  jacketWaistMin,
  jacketWaistMax,
  jacketShouldersMin,
  jacketShouldersMax,
  jacketBodyLengthMin,
  jacketBodyLengthMax,
  jacketArmLengthMin,
  jacketArmLengthMax,
  jacketArmLengthIncludeAllowance,
  shirtNeckMin,
  shirtNeckMax,
  shirtChestMin,
  shirtChestMax,
  shirtWaistMin,
  shirtWaistMax,
  shirtShouldersMin,
  shirtShouldersMax,
  shirtBodyLengthMin,
  shirtBodyLengthMax,
  shirtArmLengthMin,
  shirtArmLengthMax,
  sweaterChestMin,
  sweaterChestMax,
  sweaterWaistMin,
  sweaterWaistMax,
  sweaterShouldersMin,
  sweaterShouldersMax,
  sweaterBodyLengthMin,
  sweaterBodyLengthMax,
  sweaterArmLengthMin,
  sweaterArmLengthMax,
  waistcoatChestMin,
  waistcoatChestMax,
  waistcoatWaistMin,
  waistcoatWaistMax,
  waistcoatShouldersMin,
  waistcoatShouldersMax,
  waistcoatBodyLengthMin,
  waistcoatBodyLengthMax,
  trouserWaistMin,
  trouserWaistMax,
  trouserHipsMin,
  trouserHipsMax,
  trouserInseamMin,
  trouserInseamMax,
  trouserOutseamMin,
  trouserOutseamMax,
  trouserOpeningMin,
  trouserOpeningMax,
  trouserWaistIncludeAllowance,
  trouserLengthIncludeAllowance,
  coatChestMin,
  coatChestMax,
  coatWaistMin,
  coatWaistMax,
  coatShouldersMin,
  coatShouldersMax,
  coatBodyLengthMin,
  coatBodyLengthMax,
  coatArmLengthMin,
  coatArmLengthMax,
  coatArmLengthIncludeAllowance
}: {
  userHasProfile: boolean;
  buyerProfile?: BuyerProfile;
  selectedCategories: string[];
  selectedSizeLabels: string[];
  sizeLabelPartOne: string;
  sizeLabelPartTwo: string;
  categoryOptions: Array<[string, string]>;
  selectedIncludedBrandIds: string[];
  selectedExcludedBrandIds: string[];
  selectedMaterials: string[];
  materialOptions: Array<[string, string]>;
  shirtMaterialOptions: Array<[string, string]>;
  sweaterMaterialOptions: Array<[string, string]>;
  sweaterKnitTypeOptions: Array<[string, string]>;
  selectedPatterns: string[];
  patternOptions: Array<[string, string]>;
  shirtPatternOptions: Array<[string, string]>;
  sweaterPatternOptions: Array<[string, string]>;
  selectedPrimaryColors: string[];
  primaryColorOptions: Array<[string, string]>;
  selectedCountryOrigins: string[];
  countryOfOriginOptions: Array<[string, string]>;
  selectedFabricTypes: string[];
  fabricTypeOptions: Array<[string, string]>;
  shirtClothTypeOptions: Array<[string, string]>;
  selectedFabricWeights: string[];
  fabricWeightOptions: Array<[string, string]>;
  selectedConditions: string[];
  conditionOptions: Array<[string, string]>;
  selectedVintage: string[];
  vintageOptions: Array<[string, string]>;
  selectedReturnsAccepted: string[];
  selectedAllowOffers: string[];
  yesNoOptions: Array<[string, string]>;
  breastedCutOptions: Array<[string, string]>;
  lapelOptions: Array<[string, string]>;
  waistcoatLapelOptions: Array<[string, string]>;
  jacketButtonStyleOptions: Array<[string, string]>;
  ventStyleOptions: Array<[string, string]>;
  shirtCollarStyleOptions: Array<[string, string]>;
  shirtCuffStyleOptions: Array<[string, string]>;
  shirtPlacketOptions: Array<[string, string]>;
  sweaterNecklineOptions: Array<[string, string]>;
  sweaterClosureOptions: Array<[string, string]>;
  canvasOptions: Array<[string, string]>;
  liningOptions: Array<[string, string]>;
  formalOptions: Array<[string, string]>;
  trouserCutOptions: Array<[string, string]>;
  trouserFrontOptions: Array<[string, string]>;
  selectedJacketCuts: string[];
  selectedJacketLapels: string[];
  selectedJacketButtonStyles: string[];
  selectedJacketVentStyles: string[];
  selectedJacketCanvas: string[];
  selectedJacketLining: string[];
  selectedJacketFormal: string[];
  selectedShirtCollarStyles: string[];
  selectedShirtCuffStyles: string[];
  selectedShirtPlackets: string[];
  selectedSweaterNecklines: string[];
  selectedSweaterClosures: string[];
  selectedWaistcoatCuts: string[];
  selectedWaistcoatLapels: string[];
  selectedWaistcoatFormal: string[];
  selectedTrouserCuts: string[];
  selectedTrouserFronts: string[];
  selectedTrouserFormal: string[];
  selectedCoatCuts: string[];
  selectedCoatLapels: string[];
  selectedCoatButtonStyles: string[];
  selectedCoatVentStyles: string[];
  selectedCoatCanvas: string[];
  selectedCoatLining: string[];
  selectedCoatFormal: string[];
  keywordQuery: string;
  minPrice: string;
  maxPrice: string;
  fitMode: MarketplaceFitMode;
  useProfileMeasurements: boolean;
  jacketChestMin: string;
  jacketChestMax: string;
  jacketWaistMin: string;
  jacketWaistMax: string;
  jacketShouldersMin: string;
  jacketShouldersMax: string;
  jacketBodyLengthMin: string;
  jacketBodyLengthMax: string;
  jacketArmLengthMin: string;
  jacketArmLengthMax: string;
  jacketArmLengthIncludeAllowance: boolean;
  shirtNeckMin: string;
  shirtNeckMax: string;
  shirtChestMin: string;
  shirtChestMax: string;
  shirtWaistMin: string;
  shirtWaistMax: string;
  shirtShouldersMin: string;
  shirtShouldersMax: string;
  shirtBodyLengthMin: string;
  shirtBodyLengthMax: string;
  shirtArmLengthMin: string;
  shirtArmLengthMax: string;
  sweaterChestMin: string;
  sweaterChestMax: string;
  sweaterWaistMin: string;
  sweaterWaistMax: string;
  sweaterShouldersMin: string;
  sweaterShouldersMax: string;
  sweaterBodyLengthMin: string;
  sweaterBodyLengthMax: string;
  sweaterArmLengthMin: string;
  sweaterArmLengthMax: string;
  waistcoatChestMin: string;
  waistcoatChestMax: string;
  waistcoatWaistMin: string;
  waistcoatWaistMax: string;
  waistcoatShouldersMin: string;
  waistcoatShouldersMax: string;
  waistcoatBodyLengthMin: string;
  waistcoatBodyLengthMax: string;
  trouserWaistMin: string;
  trouserWaistMax: string;
  trouserHipsMin: string;
  trouserHipsMax: string;
  trouserInseamMin: string;
  trouserInseamMax: string;
  trouserOutseamMin: string;
  trouserOutseamMax: string;
  trouserOpeningMin: string;
  trouserOpeningMax: string;
  trouserWaistIncludeAllowance: boolean;
  trouserLengthIncludeAllowance: boolean;
  coatChestMin: string;
  coatChestMax: string;
  coatWaistMin: string;
  coatWaistMax: string;
  coatShouldersMin: string;
  coatShouldersMax: string;
  coatBodyLengthMin: string;
  coatBodyLengthMax: string;
  coatArmLengthMin: string;
  coatArmLengthMax: string;
  coatArmLengthIncludeAllowance: boolean;
}) {
  const filterRootRef = useRef<HTMLDivElement>(null);
  const searchModeRef = useRef<MarketplaceFitMode>(fitMode);
  const [searchMode, setSearchMode] = useState<MarketplaceFitMode>(fitMode);
  const [useProfileFilters, setUseProfileFilters] = useState(useProfileMeasurements);
  const [keywordSearch, setKeywordSearch] = useState(keywordQuery);
  const [fitProfileError, setFitProfileError] = useState<"best-fit" | "fill-profile" | "exact-empty" | null>(null);
  const hasFitMeasurements = hasSavedFitMeasurements(buyerProfile);
  const showMeasurementFilters = searchMode === "strict";
  const shouldSubmitUseProfile = searchMode === "flexible" || (showMeasurementFilters && useProfileFilters);
  const requiresFitMeasurements = shouldSubmitUseProfile;
  const fitProfileErrorMessage =
    fitProfileError === "best-fit"
      ? "to find best fits for you."
      : fitProfileError === "fill-profile"
        ? "to fill with measurements."
        : fitProfileError === "exact-empty"
          ? "Enter at least one measurement range to use Exact Measurements."
          : "";

  useEffect(() => {
    setSearchMode(fitMode);
  }, [fitMode]);

  useEffect(() => {
    searchModeRef.current = searchMode;
  }, [searchMode]);

  useEffect(() => {
    setUseProfileFilters(useProfileMeasurements);
  }, [useProfileMeasurements]);

  useEffect(() => {
    setKeywordSearch(keywordQuery);
  }, [keywordQuery]);

  useEffect(() => {
    const form = filterRootRef.current?.closest("form");
    if (!form) {
      return;
    }

    function handleSubmit(event: SubmitEvent) {
      const formData = new FormData(form);

      if (searchModeRef.current === "strict" && !hasSubmittedMeasurementRange(formData)) {
        event.preventDefault();
        setFitProfileError("exact-empty");
        return;
      }

      if (requiresFitMeasurements && !hasFitMeasurements) {
        event.preventDefault();
        setFitProfileError(searchModeRef.current === "flexible" ? "best-fit" : "fill-profile");
      }
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [hasFitMeasurements, requiresFitMeasurements]);

  useEffect(() => {
    const form = filterRootRef.current?.closest("form");
    if (!form) {
      return;
    }

    function handleInput() {
      if (fitProfileError !== "exact-empty") {
        return;
      }

      const formData = new FormData(form);
      if (hasSubmittedMeasurementRange(formData)) {
        setFitProfileError(null);
      }
    }

    form.addEventListener("input", handleInput);
    return () => form.removeEventListener("input", handleInput);
  }, [fitProfileError]);

  useEffect(() => {
    if (!requiresFitMeasurements || hasFitMeasurements) {
      setFitProfileError(null);
    }
  }, [hasFitMeasurements, requiresFitMeasurements]);

  const jacketChestRange = resolveSuggestedRange(jacketChestMin, jacketChestMax, buyerProfile?.suggestedMeasurementRanges?.jacket?.chest, buyerProfile?.jacketMeasurements?.chest, useProfileFilters, 0.5);
  const jacketWaistRange = resolveSuggestedRange(jacketWaistMin, jacketWaistMax, buyerProfile?.suggestedMeasurementRanges?.jacket?.waist, buyerProfile?.jacketMeasurements?.waist, useProfileFilters, 0.5);
  const jacketShouldersRange = resolveSuggestedRange(jacketShouldersMin, jacketShouldersMax, buyerProfile?.suggestedMeasurementRanges?.jacket?.shoulders, buyerProfile?.jacketMeasurements?.shoulders, useProfileFilters);
  const jacketBodyLengthRange = resolveSuggestedRange(jacketBodyLengthMin, jacketBodyLengthMax, buyerProfile?.suggestedMeasurementRanges?.jacket?.bodyLength, buyerProfile?.jacketMeasurements?.bodyLength, useProfileFilters, 0.5);
  const jacketArmLengthRange = resolveSuggestedRange(jacketArmLengthMin, jacketArmLengthMax, buyerProfile?.suggestedMeasurementRanges?.jacket?.sleeveLength, buyerProfile?.jacketMeasurements?.sleeveLength, useProfileFilters);
  const shirtNeckRange = resolveSuggestedRange(shirtNeckMin, shirtNeckMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.neck, buyerProfile?.shirtMeasurements?.neck, useProfileFilters);
  const shirtChestRange = resolveSuggestedRange(shirtChestMin, shirtChestMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.chest, buyerProfile?.shirtMeasurements?.chest, useProfileFilters, 0.5);
  const shirtWaistRange = resolveSuggestedRange(shirtWaistMin, shirtWaistMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.waist, buyerProfile?.shirtMeasurements?.waist, useProfileFilters, 0.5);
  const shirtShouldersRange = resolveSuggestedRange(shirtShouldersMin, shirtShouldersMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.shoulders, buyerProfile?.shirtMeasurements?.shoulders, useProfileFilters);
  const shirtBodyLengthRange = resolveSuggestedRange(shirtBodyLengthMin, shirtBodyLengthMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.bodyLength, buyerProfile?.shirtMeasurements?.bodyLength, useProfileFilters, 1);
  const shirtArmLengthRange = resolveSuggestedRange(shirtArmLengthMin, shirtArmLengthMax, buyerProfile?.suggestedMeasurementRanges?.shirt?.sleeveLength, buyerProfile?.shirtMeasurements?.sleeveLength, useProfileFilters);
  const sweaterChestRange = resolveSuggestedRange(sweaterChestMin, sweaterChestMax, buyerProfile?.suggestedMeasurementRanges?.sweater?.chest, buyerProfile?.sweaterMeasurements?.chest, useProfileFilters, 0.5);
  const sweaterWaistRange = resolveSuggestedRange(sweaterWaistMin, sweaterWaistMax, buyerProfile?.suggestedMeasurementRanges?.sweater?.waist, buyerProfile?.sweaterMeasurements?.waist, useProfileFilters, 0.5);
  const sweaterShouldersRange = resolveSuggestedRange(sweaterShouldersMin, sweaterShouldersMax, buyerProfile?.suggestedMeasurementRanges?.sweater?.shoulders, buyerProfile?.sweaterMeasurements?.shoulders, useProfileFilters);
  const sweaterBodyLengthRange = resolveSuggestedRange(sweaterBodyLengthMin, sweaterBodyLengthMax, buyerProfile?.suggestedMeasurementRanges?.sweater?.bodyLength, buyerProfile?.sweaterMeasurements?.bodyLength, useProfileFilters, 0.5);
  const sweaterArmLengthRange = resolveSuggestedRange(sweaterArmLengthMin, sweaterArmLengthMax, buyerProfile?.suggestedMeasurementRanges?.sweater?.sleeveLength, buyerProfile?.sweaterMeasurements?.sleeveLength, useProfileFilters, 0.5);
  const waistcoatChestRange = resolveSuggestedRange(waistcoatChestMin, waistcoatChestMax, buyerProfile?.suggestedMeasurementRanges?.waistcoat?.chest, buyerProfile?.waistcoatMeasurements?.chest, useProfileFilters, 0.5);
  const waistcoatWaistRange = resolveSuggestedRange(waistcoatWaistMin, waistcoatWaistMax, buyerProfile?.suggestedMeasurementRanges?.waistcoat?.waist, buyerProfile?.waistcoatMeasurements?.waist, useProfileFilters, 0.5);
  const waistcoatShouldersRange = resolveSuggestedRange(waistcoatShouldersMin, waistcoatShouldersMax, buyerProfile?.suggestedMeasurementRanges?.waistcoat?.shoulders, buyerProfile?.waistcoatMeasurements?.shoulders, useProfileFilters, 1);
  const waistcoatBodyLengthRange = resolveSuggestedRange(waistcoatBodyLengthMin, waistcoatBodyLengthMax, buyerProfile?.suggestedMeasurementRanges?.waistcoat?.bodyLength, buyerProfile?.waistcoatMeasurements?.bodyLength, useProfileFilters, 0.5);
  const coatChestRange = resolveSuggestedRange(coatChestMin, coatChestMax, buyerProfile?.suggestedMeasurementRanges?.coat?.chest, buyerProfile?.coatMeasurements?.chest, useProfileFilters, 0.5);
  const coatWaistRange = resolveSuggestedRange(coatWaistMin, coatWaistMax, buyerProfile?.suggestedMeasurementRanges?.coat?.waist, buyerProfile?.coatMeasurements?.waist, useProfileFilters, 0.5);
  const coatShouldersRange = resolveSuggestedRange(coatShouldersMin, coatShouldersMax, buyerProfile?.suggestedMeasurementRanges?.coat?.shoulders, buyerProfile?.coatMeasurements?.shoulders, useProfileFilters);
  const coatBodyLengthRange = resolveSuggestedRange(coatBodyLengthMin, coatBodyLengthMax, buyerProfile?.suggestedMeasurementRanges?.coat?.bodyLength, buyerProfile?.coatMeasurements?.bodyLength, useProfileFilters, 0.5);
  const coatArmLengthRange = resolveSuggestedRange(coatArmLengthMin, coatArmLengthMax, buyerProfile?.suggestedMeasurementRanges?.coat?.sleeveLength, buyerProfile?.coatMeasurements?.sleeveLength, useProfileFilters);
  const trouserWaistRange = resolveSuggestedRange(trouserWaistMin, trouserWaistMax, buyerProfile?.suggestedMeasurementRanges?.trousers?.waist, buyerProfile?.trouserMeasurements?.waist, useProfileFilters, 0.5);
  const trouserHipsRange = resolveSuggestedRange(trouserHipsMin, trouserHipsMax, buyerProfile?.suggestedMeasurementRanges?.trousers?.hips, buyerProfile?.trouserMeasurements?.hips, useProfileFilters, 0.5);
  const trouserInseamRange = resolveSuggestedRange(trouserInseamMin, trouserInseamMax, buyerProfile?.suggestedMeasurementRanges?.trousers?.inseam, buyerProfile?.trouserMeasurements?.inseam, useProfileFilters);
  const trouserOutseamRange = resolveSuggestedRange(trouserOutseamMin, trouserOutseamMax, buyerProfile?.suggestedMeasurementRanges?.trousers?.outseam, buyerProfile?.trouserMeasurements?.outseam, useProfileFilters);
  const trouserOpeningRange = resolveSuggestedRange(trouserOpeningMin, trouserOpeningMax, buyerProfile?.suggestedMeasurementRanges?.trousers?.opening, buyerProfile?.trouserMeasurements?.opening, useProfileFilters, 0.5);

  return (
    <div ref={filterRootRef} className="contents">
      <MarketplaceGarmentFilters
        selectedCategories={selectedCategories}
        categoryOptions={categoryOptions}
        showAllMeasurementSections={(activeCategories) => showMeasurementFilters && activeCategories.length === 0}
        afterCategoryContent={(activeCategories) => {
          const sizeFilterConfig = getMarketplaceSizeFilterConfig(activeCategories);
          return (
              <>
              <label className="flex flex-col gap-1 rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
                <span className="filter-label">Search by Keyword</span>
                <div className="relative h-5">
                  <input
                    name="q"
                    type="text"
                    value={keywordSearch}
                    onChange={(event) => setKeywordSearch(event.currentTarget.value)}
                    placeholder={'Search style details or occasion (e.g. "soft shoulder" OR "western")'}
                    className="ui-sans absolute inset-0 w-full border-0 bg-transparent p-0 pr-7 text-[0.95rem] leading-5 text-stone-900 outline-none placeholder:text-stone-500"
                  />
                  {keywordSearch ? (
                    <button
                      type="button"
                      onClick={() => setKeywordSearch("")}
                      aria-label="Clear keyword search"
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-stone-400 transition hover:text-stone-700"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </label>
                {sizeFilterConfig ? (
                sizeFilterConfig.kind === "single" ? (
                  <SearchableChecklistFilter
                    name="sizeLabel"
                    label={sizeFilterConfig.label}
                    options={sizeFilterConfig.options}
                    selectedValues={selectedSizeLabels}
                    allLabel={sizeFilterConfig.allLabel}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SearchableChecklistFilter
                      name="sizeLabelPartOne"
                      label={sizeFilterConfig.firstLabel}
                      options={sizeFilterConfig.firstOptions}
                      selectedValues={sizeLabelPartOne ? [sizeLabelPartOne] : []}
                      allLabel={`Any ${sizeFilterConfig.firstLabel}`}
                      selectionMode="single"
                    />
                    <SearchableChecklistFilter
                      name="sizeLabelPartTwo"
                      label={sizeFilterConfig.secondLabel}
                      options={sizeFilterConfig.secondOptions}
                      selectedValues={sizeLabelPartTwo ? [sizeLabelPartTwo] : []}
                      allLabel={`Any ${sizeFilterConfig.secondLabel}`}
                      selectionMode="single"
                    />
                  </div>
                )
              ) : null}
          </>
        );
      }}
      middleContent={
        <>
          <BrandFilter includeBrandIds={selectedIncludedBrandIds} excludeBrandIds={selectedExcludedBrandIds} />
          <div className="grid gap-3 sm:grid-cols-2">
            <MarketplaceDropdownChecklist
              name="condition"
              label="Condition"
              options={conditionOptions}
              selectedValues={selectedConditions}
              allLabel="Any Condition"
            />
            <MarketplaceDropdownChecklist
              name="vintage"
              label="Era"
              options={vintageOptions}
              selectedValues={selectedVintage}
              allLabel="Any Era"
            />
          </div>
          <div className="grid gap-3">
            <CountryFilter selectedValues={selectedCountryOrigins} />
          </div>
        </>
      }
      postGarmentSections={(activeCategories) => (
        <>
          {isNonShirtOrSweaterOnlySelection(activeCategories) ? (
            <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <summary className="filter-section-title cursor-pointer">Fabric Filters</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MarketplaceMultiSelect
                  name="material"
                  label="Fabric"
                  options={materialOptions}
                  selectedValues={selectedMaterials}
                  allLabel="Any Fabric"
                />
                <MarketplaceMultiSelect
                  name="pattern"
                  label="Pattern"
                  options={patternOptions}
                  selectedValues={selectedPatterns}
                  allLabel="Any Pattern"
                />
                <MarketplaceMultiSelect
                  name="primaryColor"
                  label="Primary Color"
                  options={primaryColorOptions}
                  selectedValues={selectedPrimaryColors}
                  allLabel="Any Color"
                />
                <MarketplaceMultiSelect
                  name="fabricType"
                  label="Cloth Type"
                  options={fabricTypeOptions}
                  selectedValues={selectedFabricTypes}
                  allLabel="Any Cloth Type"
                />
                <MarketplaceMultiSelect
                  name="fabricWeight"
                  label="Cloth Weight"
                  options={fabricWeightOptions}
                  selectedValues={selectedFabricWeights}
                  allLabel="Any Cloth Weight"
                />
              </div>
            </details>
          ) : null}
          {isShirtOnlySelection(activeCategories) ? (
            <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <summary className="filter-section-title cursor-pointer">Fabric Filters</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MarketplaceMultiSelect
                  name="material"
                  label="Material"
                  options={shirtMaterialOptions}
                  selectedValues={selectedMaterials}
                  allLabel="Any Material"
                />
                <MarketplaceMultiSelect
                  name="pattern"
                  label="Pattern"
                  options={shirtPatternOptions}
                  selectedValues={selectedPatterns}
                  allLabel="Any Pattern"
                />
                <MarketplaceMultiSelect
                  name="primaryColor"
                  label="Primary Color"
                  options={primaryColorOptions}
                  selectedValues={selectedPrimaryColors}
                  allLabel="Any Color"
                />
                <MarketplaceMultiSelect
                  name="fabricType"
                  label="Cloth Type"
                  options={shirtClothTypeOptions}
                  selectedValues={selectedFabricTypes}
                  allLabel="Any Cloth Type"
                />
              </div>
            </details>
          ) : null}
          {isSweaterOnlySelection(activeCategories) ? (
            <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <summary className="filter-section-title cursor-pointer">Fabric Filters</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MarketplaceMultiSelect name="material" label="Material" options={sweaterMaterialOptions} selectedValues={selectedMaterials} allLabel="Any Material" />
                <MarketplaceMultiSelect name="primaryColor" label="Primary Color" options={primaryColorOptions} selectedValues={selectedPrimaryColors} allLabel="Any Color" />
                <MarketplaceMultiSelect name="pattern" label="Pattern" options={sweaterPatternOptions} selectedValues={selectedPatterns} allLabel="Any Pattern" />
                <MarketplaceMultiSelect name="fabricType" label="Knit Type" options={sweaterKnitTypeOptions} selectedValues={selectedFabricTypes} allLabel="Any Knit Type" />
                <MarketplaceMultiSelect name="fabricWeight" label="Cloth Weight" options={fabricWeightOptions} selectedValues={selectedFabricWeights} allLabel="Any Cloth Weight" />
              </div>
            </details>
          ) : null}
        </>
      )}
      preMeasurementSections={
        <>
          <div className="grid gap-3">
            <MarketplacePriceRange minPrice={minPrice} maxPrice={maxPrice} />
            <div className="grid gap-3 sm:grid-cols-2">
              <MarketplaceDropdownChecklist
                name="allowOffers"
                label="Allows Offers"
                options={yesNoOptions}
                selectedValues={selectedAllowOffers}
              />
              <MarketplaceDropdownChecklist
                name="returnsAccepted"
                label="Accepts Returns"
                options={yesNoOptions}
                selectedValues={selectedReturnsAccepted}
              />
            </div>
          </div>
            {userHasProfile ? (
              <>
                <label className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="filter-label block">Fit Search Mode</span>
                    <select
                      name="fitMode"
                      value={searchMode}
                      onChange={(event) => {
                        const nextMode = event.currentTarget.value;
                        const nextSearchMode = nextMode === "flexible" || nextMode === "strict" ? nextMode : "browse";
                        setSearchMode(nextSearchMode);
                        setFitProfileError(nextSearchMode === "flexible" && !hasFitMeasurements ? "best-fit" : null);
                      }}
                      className="ui-sans h-5 w-full appearance-none border-0 bg-transparent p-0 text-[0.95rem] leading-5 text-stone-900 outline-none"
                    >
                      <option value="browse">Browse Without Measurement Filters</option>
                      <option value="flexible">Best Fits for Me</option>
                      <option value="strict">Exact Measurements</option>
                    </select>
                    <span className="filter-help">
                      {searchMode === "flexible"
                        ? "Searches using your Saved Fit Profile to find compatible items."
                        : searchMode === "browse"
                          ? "Searches without applying any measurement filters."
                          : "Searches using the measurement range filters you enter below."}
                    </span>
                  </div>
                </label>
                {fitProfileError ? (
                  <p role="alert" className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
                    {fitProfileError === "exact-empty" ? (
                      fitProfileErrorMessage
                    ) : (
                      <>
                        Add measurements to your{" "}
                        <a href="/buyer/measurements" className="font-semibold underline underline-offset-4">
                          Saved Fit Profile
                        </a>{" "}
                        {fitProfileErrorMessage}
                      </>
                    )}
                  </p>
                ) : null}
              </>
          ) : (
            <input type="hidden" name="fitMode" value="strict" />
          )}
          {showMeasurementFilters && userHasProfile ? (
            <label className="ui-sans flex items-center gap-3 rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900">
              <input
                type="checkbox"
                checked={useProfileFilters}
                onChange={(event) => {
                  const shouldUseProfile = event.currentTarget.checked;
                  if (shouldUseProfile && !hasFitMeasurements) {
                    setUseProfileFilters(false);
                    setFitProfileError("fill-profile");
                    return;
                  }

                  setUseProfileFilters(shouldUseProfile);
                  setFitProfileError(null);
                }}
                className="h-4 w-4 shrink-0 rounded border-stone-300"
              />
              <span className="font-medium">Fill with measurements from my Saved Fit Profile</span>
            </label>
          ) : null}
          {shouldSubmitUseProfile ? <input type="hidden" name="useProfile" value="yes" /> : null}
        </>
      }
      jacketFiltersSection={
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Jacket Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="jacketCut" label="Cut" options={breastedCutOptions} selectedValues={selectedJacketCuts} allLabel="All Cuts" />
            <MarketplaceMultiSelect name="jacketLapel" label="Lapel" options={lapelOptions} selectedValues={selectedJacketLapels} allLabel="All Lapels" />
            <MarketplaceMultiSelect name="jacketButtonStyle" label="Button Style" options={jacketButtonStyleOptions} selectedValues={selectedJacketButtonStyles} allLabel="All Button Styles" />
            <MarketplaceMultiSelect name="jacketVentStyle" label="Vent Style" options={ventStyleOptions} selectedValues={selectedJacketVentStyles} allLabel="All Vent Styles" />
            <MarketplaceMultiSelect name="jacketCanvas" label="Canvas" options={canvasOptions} selectedValues={selectedJacketCanvas} allLabel="All Canvas Types" />
            <MarketplaceMultiSelect name="jacketLining" label="Lining" options={liningOptions} selectedValues={selectedJacketLining} allLabel="All Lining Types" />
            <MarketplaceMultiSelect name="jacketFormal" label="Formal" options={formalOptions} selectedValues={selectedJacketFormal} allLabel="All Formal Types" />
          </div>
        </details>
      }
      jacketMeasurementsSection={
        showMeasurementFilters ? <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4" open={Boolean(useProfileFilters || jacketChestMin || jacketChestMax)}>
          <summary className="filter-section-title cursor-pointer">Jacket Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField key={`jacketChest-${useProfileFilters}-${jacketChestRange.min}-${jacketChestRange.max}`} minName="jacketChestMin" maxName="jacketChestMax" label="Chest Width (in.)" minDefaultValue={jacketChestRange.min} maxDefaultValue={jacketChestRange.max} placeholder={buyerProfile?.jacketMeasurements?.chest?.toString() || "40"} />
            <MarketplaceRangeField key={`jacketWaist-${useProfileFilters}-${jacketWaistRange.min}-${jacketWaistRange.max}`} minName="jacketWaistMin" maxName="jacketWaistMax" label="Waist Width (in.)" minDefaultValue={jacketWaistRange.min} maxDefaultValue={jacketWaistRange.max} placeholder={buyerProfile?.jacketMeasurements?.waist?.toString() || "34"} />
            <MarketplaceRangeField key={`jacketShoulders-${useProfileFilters}-${jacketShouldersRange.min}-${jacketShouldersRange.max}`} minName="jacketShouldersMin" maxName="jacketShouldersMax" label="Shoulders Width (in.)" minDefaultValue={jacketShouldersRange.min} maxDefaultValue={jacketShouldersRange.max} placeholder={buyerProfile?.jacketMeasurements?.shoulders?.toString() || "18"} />
            <MarketplaceRangeField key={`jacketBodyLength-${useProfileFilters}-${jacketBodyLengthRange.min}-${jacketBodyLengthRange.max}`} minName="jacketBodyLengthMin" maxName="jacketBodyLengthMax" label="Body Length (in.)" minDefaultValue={jacketBodyLengthRange.min} maxDefaultValue={jacketBodyLengthRange.max} placeholder={buyerProfile?.jacketMeasurements?.bodyLength?.toString() || "29"} />
            <MarketplaceRangeField key={`jacketArmLength-${useProfileFilters}-${jacketArmLengthRange.min}-${jacketArmLengthRange.max}`} minName="jacketArmLengthMin" maxName="jacketArmLengthMax" label="Sleeve Length (in.)" minDefaultValue={jacketArmLengthRange.min} maxDefaultValue={jacketArmLengthRange.max} placeholder={buyerProfile?.jacketMeasurements?.sleeveLength?.toString() || "34"} allowanceName="jacketArmLengthIncludeAllowance" allowanceChecked={jacketArmLengthIncludeAllowance} />
          </div>
        </details> : null
      }
      shirtFiltersSection={
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Shirt Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="shirtCollarStyle" label="Collar Style" options={shirtCollarStyleOptions} selectedValues={selectedShirtCollarStyles} allLabel="All Collar Styles" />
            <MarketplaceMultiSelect name="shirtCuffStyle" label="Cuff Style" options={shirtCuffStyleOptions} selectedValues={selectedShirtCuffStyles} allLabel="All Cuff Styles" />
            <MarketplaceMultiSelect name="shirtPlacket" label="Placket" options={shirtPlacketOptions} selectedValues={selectedShirtPlackets} allLabel="All Plackets" />
          </div>
        </details>
      }
      shirtMeasurementsSection={
        showMeasurementFilters ? <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4" open={Boolean(useProfileFilters || shirtNeckMin || shirtNeckMax || shirtChestMin || shirtChestMax)}>
          <summary className="filter-section-title cursor-pointer">Shirt Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField key={`shirtNeck-${useProfileFilters}-${shirtNeckRange.min}-${shirtNeckRange.max}`} minName="shirtNeckMin" maxName="shirtNeckMax" label="Neck Circumference (in.)" minDefaultValue={shirtNeckRange.min} maxDefaultValue={shirtNeckRange.max} placeholder={buyerProfile?.shirtMeasurements?.neck?.toString() || "15.5"} />
            <MarketplaceRangeField key={`shirtChest-${useProfileFilters}-${shirtChestRange.min}-${shirtChestRange.max}`} minName="shirtChestMin" maxName="shirtChestMax" label="Chest Width (in.)" minDefaultValue={shirtChestRange.min} maxDefaultValue={shirtChestRange.max} placeholder={buyerProfile?.shirtMeasurements?.chest?.toString() || "21.5"} />
            <MarketplaceRangeField key={`shirtWaist-${useProfileFilters}-${shirtWaistRange.min}-${shirtWaistRange.max}`} minName="shirtWaistMin" maxName="shirtWaistMax" label="Waist Width (in.)" minDefaultValue={shirtWaistRange.min} maxDefaultValue={shirtWaistRange.max} placeholder={buyerProfile?.shirtMeasurements?.waist?.toString() || "19"} />
            <MarketplaceRangeField key={`shirtShoulders-${useProfileFilters}-${shirtShouldersRange.min}-${shirtShouldersRange.max}`} minName="shirtShouldersMin" maxName="shirtShouldersMax" label="Shoulders Width (in.)" minDefaultValue={shirtShouldersRange.min} maxDefaultValue={shirtShouldersRange.max} placeholder={buyerProfile?.shirtMeasurements?.shoulders?.toString() || "18"} />
            <MarketplaceRangeField key={`shirtBodyLength-${useProfileFilters}-${shirtBodyLengthRange.min}-${shirtBodyLengthRange.max}`} minName="shirtBodyLengthMin" maxName="shirtBodyLengthMax" label="Body Length (in.)" minDefaultValue={shirtBodyLengthRange.min} maxDefaultValue={shirtBodyLengthRange.max} placeholder={buyerProfile?.shirtMeasurements?.bodyLength?.toString() || "30"} />
            <MarketplaceRangeField key={`shirtArmLength-${useProfileFilters}-${shirtArmLengthRange.min}-${shirtArmLengthRange.max}`} minName="shirtArmLengthMin" maxName="shirtArmLengthMax" label="Sleeve Length (in.)" minDefaultValue={shirtArmLengthRange.min} maxDefaultValue={shirtArmLengthRange.max} placeholder={buyerProfile?.shirtMeasurements?.sleeveLength?.toString() || "34.5"} />
          </div>
        </details> : null
      }
      sweaterFiltersSection={
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Sweater Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="sweaterNeckline" label="Neckline" options={sweaterNecklineOptions} selectedValues={selectedSweaterNecklines} allLabel="All Necklines" />
            <MarketplaceMultiSelect name="sweaterClosure" label="Closure" options={sweaterClosureOptions} selectedValues={selectedSweaterClosures} allLabel="All Closures" />
          </div>
        </details>
      }
      sweaterMeasurementsSection={
        showMeasurementFilters ? <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4" open={Boolean(useProfileFilters || sweaterChestMin || sweaterChestMax)}>
          <summary className="filter-section-title cursor-pointer">Sweater Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField key={`sweaterChest-${useProfileFilters}-${sweaterChestRange.min}-${sweaterChestRange.max}`} minName="sweaterChestMin" maxName="sweaterChestMax" label="Chest Width (in.)" minDefaultValue={sweaterChestRange.min} maxDefaultValue={sweaterChestRange.max} placeholder={buyerProfile?.sweaterMeasurements?.chest?.toString() || "22"} />
            <MarketplaceRangeField key={`sweaterWaist-${useProfileFilters}-${sweaterWaistRange.min}-${sweaterWaistRange.max}`} minName="sweaterWaistMin" maxName="sweaterWaistMax" label="Waist Width (in.)" minDefaultValue={sweaterWaistRange.min} maxDefaultValue={sweaterWaistRange.max} placeholder={buyerProfile?.sweaterMeasurements?.waist?.toString() || "20"} />
            <MarketplaceRangeField key={`sweaterShoulders-${useProfileFilters}-${sweaterShouldersRange.min}-${sweaterShouldersRange.max}`} minName="sweaterShouldersMin" maxName="sweaterShouldersMax" label="Shoulders Width (in.)" minDefaultValue={sweaterShouldersRange.min} maxDefaultValue={sweaterShouldersRange.max} placeholder={buyerProfile?.sweaterMeasurements?.shoulders?.toString() || "18"} />
            <MarketplaceRangeField key={`sweaterBodyLength-${useProfileFilters}-${sweaterBodyLengthRange.min}-${sweaterBodyLengthRange.max}`} minName="sweaterBodyLengthMin" maxName="sweaterBodyLengthMax" label="Body Length (in.)" minDefaultValue={sweaterBodyLengthRange.min} maxDefaultValue={sweaterBodyLengthRange.max} placeholder={buyerProfile?.sweaterMeasurements?.bodyLength?.toString() || "27.5"} />
            <MarketplaceRangeField key={`sweaterArmLength-${useProfileFilters}-${sweaterArmLengthRange.min}-${sweaterArmLengthRange.max}`} minName="sweaterArmLengthMin" maxName="sweaterArmLengthMax" label="Sleeve Length (in.)" minDefaultValue={sweaterArmLengthRange.min} maxDefaultValue={sweaterArmLengthRange.max} placeholder={buyerProfile?.sweaterMeasurements?.sleeveLength?.toString() || "34"} />
          </div>
        </details> : null
      }
      waistcoatFiltersSection={
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Waistcoat Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="waistcoatCut" label="Cut" options={breastedCutOptions} selectedValues={selectedWaistcoatCuts} allLabel="All Cuts" />
            <MarketplaceMultiSelect name="waistcoatLapel" label="Lapel" options={waistcoatLapelOptions} selectedValues={selectedWaistcoatLapels} allLabel="All Lapels" />
            <MarketplaceMultiSelect name="waistcoatFormal" label="Formal" options={formalOptions} selectedValues={selectedWaistcoatFormal} allLabel="All Formal Types" />
          </div>
        </details>
      }
      waistcoatMeasurementsSection={
        showMeasurementFilters ? <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4" open={Boolean(useProfileFilters || waistcoatChestMin || waistcoatChestMax)}>
          <summary className="filter-section-title cursor-pointer">Waistcoat Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField key={`waistcoatChest-${useProfileFilters}-${waistcoatChestRange.min}-${waistcoatChestRange.max}`} minName="waistcoatChestMin" maxName="waistcoatChestMax" label="Chest Width (in.)" minDefaultValue={waistcoatChestRange.min} maxDefaultValue={waistcoatChestRange.max} placeholder={buyerProfile?.waistcoatMeasurements?.chest?.toString() || "40"} />
            <MarketplaceRangeField key={`waistcoatWaist-${useProfileFilters}-${waistcoatWaistRange.min}-${waistcoatWaistRange.max}`} minName="waistcoatWaistMin" maxName="waistcoatWaistMax" label="Waist Width (in.)" minDefaultValue={waistcoatWaistRange.min} maxDefaultValue={waistcoatWaistRange.max} placeholder={buyerProfile?.waistcoatMeasurements?.waist?.toString() || "34"} />
            <MarketplaceRangeField key={`waistcoatShoulders-${useProfileFilters}-${waistcoatShouldersRange.min}-${waistcoatShouldersRange.max}`} minName="waistcoatShouldersMin" maxName="waistcoatShouldersMax" label="Shoulders Width (in.)" minDefaultValue={waistcoatShouldersRange.min} maxDefaultValue={waistcoatShouldersRange.max} placeholder={buyerProfile?.waistcoatMeasurements?.shoulders?.toString() || "18"} />
            <MarketplaceRangeField key={`waistcoatBodyLength-${useProfileFilters}-${waistcoatBodyLengthRange.min}-${waistcoatBodyLengthRange.max}`} minName="waistcoatBodyLengthMin" maxName="waistcoatBodyLengthMax" label="Body Length (in.)" minDefaultValue={waistcoatBodyLengthRange.min} maxDefaultValue={waistcoatBodyLengthRange.max} placeholder={buyerProfile?.waistcoatMeasurements?.bodyLength?.toString() || "24"} />
          </div>
        </details> : null
      }
      trousersFiltersSection={
        <MarketplaceTrousersFilters
          section="filters"
          useProfileMeasurements={useProfileFilters}
          waistMin={trouserWaistMin}
          waistMax={trouserWaistMax}
          hipsMin={trouserHipsMin}
          hipsMax={trouserHipsMax}
          inseamMin={trouserInseamMin}
          inseamMax={trouserInseamMax}
          outseamMin={trouserOutseamMin}
          outseamMax={trouserOutseamMax}
          openingMin={trouserOpeningMin}
          openingMax={trouserOpeningMax}
          waistPlaceholder={buyerProfile?.trouserMeasurements?.waist?.toString() || "34"}
          hipsPlaceholder={buyerProfile?.trouserMeasurements?.hips?.toString() || "40"}
          inseamPlaceholder={buyerProfile?.trouserMeasurements?.inseam?.toString() || "31"}
          outseamPlaceholder={buyerProfile?.trouserMeasurements?.outseam?.toString() || "41"}
          openingPlaceholder={buyerProfile?.trouserMeasurements?.opening?.toString() || "8"}
          waistAllowanceChecked={trouserWaistIncludeAllowance}
          lengthAllowanceChecked={trouserLengthIncludeAllowance}
          cutOptions={trouserCutOptions}
          frontOptions={trouserFrontOptions}
          formalOptions={formalOptions}
          selectedCuts={selectedTrouserCuts}
          selectedFronts={selectedTrouserFronts}
          selectedFormal={selectedTrouserFormal}
          waistProfileValue={buyerProfile?.trouserMeasurements?.waist}
          hipsProfileValue={buyerProfile?.trouserMeasurements?.hips}
          inseamProfileValue={buyerProfile?.trouserMeasurements?.inseam}
          outseamProfileValue={buyerProfile?.trouserMeasurements?.outseam}
          openingProfileValue={buyerProfile?.trouserMeasurements?.opening}
        />
      }
      trousersMeasurementsSection={
        showMeasurementFilters ? <MarketplaceTrousersFilters
          section="measurements"
          useProfileMeasurements={useProfileFilters}
          waistMin={trouserWaistMin}
          waistMax={trouserWaistMax}
          hipsMin={trouserHipsMin}
          hipsMax={trouserHipsMax}
          inseamMin={trouserInseamMin}
          inseamMax={trouserInseamMax}
          outseamMin={trouserOutseamMin}
          outseamMax={trouserOutseamMax}
          openingMin={trouserOpeningMin}
          openingMax={trouserOpeningMax}
          waistPlaceholder={buyerProfile?.trouserMeasurements?.waist?.toString() || "34"}
          hipsPlaceholder={buyerProfile?.trouserMeasurements?.hips?.toString() || "40"}
          inseamPlaceholder={buyerProfile?.trouserMeasurements?.inseam?.toString() || "31"}
          outseamPlaceholder={buyerProfile?.trouserMeasurements?.outseam?.toString() || "41"}
          openingPlaceholder={buyerProfile?.trouserMeasurements?.opening?.toString() || "8"}
          waistAllowanceChecked={trouserWaistIncludeAllowance}
          lengthAllowanceChecked={trouserLengthIncludeAllowance}
          cutOptions={trouserCutOptions}
          frontOptions={trouserFrontOptions}
          formalOptions={formalOptions}
          selectedCuts={selectedTrouserCuts}
          selectedFronts={selectedTrouserFronts}
          selectedFormal={selectedTrouserFormal}
          waistProfileValue={buyerProfile?.trouserMeasurements?.waist}
          hipsProfileValue={buyerProfile?.trouserMeasurements?.hips}
          inseamProfileValue={buyerProfile?.trouserMeasurements?.inseam}
          outseamProfileValue={buyerProfile?.trouserMeasurements?.outseam}
          openingProfileValue={buyerProfile?.trouserMeasurements?.opening}
        /> : null
      }
      coatFiltersSection={
        <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
          <summary className="filter-section-title cursor-pointer">Coat Filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceMultiSelect name="coatCut" label="Cut" options={breastedCutOptions} selectedValues={selectedCoatCuts} allLabel="All Cuts" />
            <MarketplaceMultiSelect name="coatLapel" label="Lapel" options={lapelOptions} selectedValues={selectedCoatLapels} allLabel="All Lapels" />
            <MarketplaceMultiSelect name="coatButtonStyle" label="Button Style" options={jacketButtonStyleOptions} selectedValues={selectedCoatButtonStyles} allLabel="All Button Styles" />
            <MarketplaceMultiSelect name="coatVentStyle" label="Vent Style" options={ventStyleOptions} selectedValues={selectedCoatVentStyles} allLabel="All Vent Styles" />
            <MarketplaceMultiSelect name="coatCanvas" label="Canvas" options={canvasOptions} selectedValues={selectedCoatCanvas} allLabel="All Canvas Types" />
            <MarketplaceMultiSelect name="coatLining" label="Lining" options={liningOptions} selectedValues={selectedCoatLining} allLabel="All Lining Types" />
            <MarketplaceMultiSelect name="coatFormal" label="Formal" options={formalOptions} selectedValues={selectedCoatFormal} allLabel="All Formal Types" />
          </div>
        </details>
      }
      coatMeasurementsSection={
        showMeasurementFilters ? <details className="rounded-[1.5rem] border border-stone-300 bg-white p-4" open={Boolean(useProfileFilters || coatChestMin || coatChestMax)}>
          <summary className="filter-section-title cursor-pointer">Coat Measurements</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MarketplaceRangeField key={`coatChest-${useProfileFilters}-${coatChestRange.min}-${coatChestRange.max}`} minName="coatChestMin" maxName="coatChestMax" label="Chest Width (in.)" minDefaultValue={coatChestRange.min} maxDefaultValue={coatChestRange.max} placeholder={buyerProfile?.coatMeasurements?.chest?.toString() || "40"} />
            <MarketplaceRangeField key={`coatWaist-${useProfileFilters}-${coatWaistRange.min}-${coatWaistRange.max}`} minName="coatWaistMin" maxName="coatWaistMax" label="Waist Width (in.)" minDefaultValue={coatWaistRange.min} maxDefaultValue={coatWaistRange.max} placeholder={buyerProfile?.coatMeasurements?.waist?.toString() || "36"} />
            <MarketplaceRangeField key={`coatShoulders-${useProfileFilters}-${coatShouldersRange.min}-${coatShouldersRange.max}`} minName="coatShouldersMin" maxName="coatShouldersMax" label="Shoulders Width (in.)" minDefaultValue={coatShouldersRange.min} maxDefaultValue={coatShouldersRange.max} placeholder={buyerProfile?.coatMeasurements?.shoulders?.toString() || "18"} />
            <MarketplaceRangeField key={`coatBodyLength-${useProfileFilters}-${coatBodyLengthRange.min}-${coatBodyLengthRange.max}`} minName="coatBodyLengthMin" maxName="coatBodyLengthMax" label="Body Length (in.)" minDefaultValue={coatBodyLengthRange.min} maxDefaultValue={coatBodyLengthRange.max} placeholder={buyerProfile?.coatMeasurements?.bodyLength?.toString() || "38"} />
            <MarketplaceRangeField key={`coatArmLength-${useProfileFilters}-${coatArmLengthRange.min}-${coatArmLengthRange.max}`} minName="coatArmLengthMin" maxName="coatArmLengthMax" label="Sleeve Length (in.)" minDefaultValue={coatArmLengthRange.min} maxDefaultValue={coatArmLengthRange.max} placeholder={buyerProfile?.coatMeasurements?.sleeveLength?.toString() || "34"} allowanceName="coatArmLengthIncludeAllowance" allowanceChecked={coatArmLengthIncludeAllowance} />
          </div>
          </details> : null
        }
      />
    </div>
  );
}
