"use client";

import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MarketplaceDropdownChecklist } from "@/components/marketplace-dropdown-checklist";

type DynamicSection = ReactNode | ((activeCategories: string[]) => ReactNode);
type DynamicBoolean = boolean | ((activeCategories: string[]) => boolean);

function shouldShowJacketSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.some((category) => ["jacket", "two_piece_suit", "three_piece_suit"].includes(category));
}

function shouldShowWaistcoatSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.some((category) => ["waistcoat", "three_piece_suit"].includes(category));
}

function shouldShowShirtSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.includes("shirt");
}

function shouldShowSweaterSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.includes("sweater");
}

function shouldShowTrousersSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.some((category) => ["trousers", "two_piece_suit", "three_piece_suit"].includes(category));
}

function shouldShowCoatSection(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return false;
  }

  return selectedCategories.includes("coat");
}

export function MarketplaceGarmentFilters({
  selectedCategories,
  categoryOptions,
  showAllMeasurementSections = false,
  afterCategoryContent,
  middleContent,
  preGarmentSections,
  postGarmentSections,
  preMeasurementSections,
  jacketFiltersSection,
  jacketMeasurementsSection,
  shirtFiltersSection,
  shirtMeasurementsSection,
  sweaterFiltersSection,
  sweaterMeasurementsSection,
  waistcoatFiltersSection,
  waistcoatMeasurementsSection,
  trousersFiltersSection,
  trousersMeasurementsSection,
  coatFiltersSection,
  coatMeasurementsSection
}: {
  selectedCategories: string[];
  categoryOptions: Array<[string, string]>;
  showAllMeasurementSections?: DynamicBoolean;
  afterCategoryContent?: DynamicSection;
  middleContent?: DynamicSection;
  preGarmentSections?: DynamicSection;
  postGarmentSections?: DynamicSection;
  preMeasurementSections?: DynamicSection;
  jacketFiltersSection: ReactNode;
  jacketMeasurementsSection: ReactNode;
  shirtFiltersSection: ReactNode;
  shirtMeasurementsSection: ReactNode;
  sweaterFiltersSection: ReactNode;
  sweaterMeasurementsSection: ReactNode;
  waistcoatFiltersSection: ReactNode;
  waistcoatMeasurementsSection: ReactNode;
  trousersFiltersSection: ReactNode;
  trousersMeasurementsSection: ReactNode;
  coatFiltersSection: ReactNode;
  coatMeasurementsSection: ReactNode;
}) {
  const [activeCategories, setActiveCategories] = useState<string[]>(selectedCategories);

  useEffect(() => {
    setActiveCategories(selectedCategories);
  }, [selectedCategories]);

  const resolvedAfterCategoryContent =
    typeof afterCategoryContent === "function" ? afterCategoryContent(activeCategories) : afterCategoryContent;
  const resolvedMiddleContent = typeof middleContent === "function" ? middleContent(activeCategories) : middleContent;
  const resolvedPreGarmentSections =
    typeof preGarmentSections === "function" ? preGarmentSections(activeCategories) : preGarmentSections;
  const resolvedPostGarmentSections =
    typeof postGarmentSections === "function" ? postGarmentSections(activeCategories) : postGarmentSections;
  const resolvedPreMeasurementSections =
    typeof preMeasurementSections === "function" ? preMeasurementSections(activeCategories) : preMeasurementSections;
  const resolvedShowAllMeasurementSections =
    typeof showAllMeasurementSections === "function"
      ? showAllMeasurementSections(activeCategories)
      : showAllMeasurementSections;

  return (
    <>
      <MarketplaceDropdownChecklist
        name="category"
        label="Category"
        options={categoryOptions}
        selectedValues={selectedCategories}
        allLabel="All Categories"
        clearAllValue="__none__"
        noneLabel="No Categories"
        description="Select individual categories to enable category-specific filters."
        onSelectionChange={setActiveCategories}
      />
      {resolvedAfterCategoryContent}
      {resolvedMiddleContent}
      {resolvedPreGarmentSections}
      {shouldShowJacketSection(activeCategories) ? <Fragment key="jacket-filters">{jacketFiltersSection}</Fragment> : null}
      {shouldShowWaistcoatSection(activeCategories) ? <Fragment key="waistcoat-filters">{waistcoatFiltersSection}</Fragment> : null}
      {shouldShowTrousersSection(activeCategories) ? <Fragment key="trousers-filters">{trousersFiltersSection}</Fragment> : null}
      {shouldShowCoatSection(activeCategories) ? <Fragment key="coat-filters">{coatFiltersSection}</Fragment> : null}
      {shouldShowShirtSection(activeCategories) ? <Fragment key="shirt-filters">{shirtFiltersSection}</Fragment> : null}
      {shouldShowSweaterSection(activeCategories) ? <Fragment key="sweater-filters">{sweaterFiltersSection}</Fragment> : null}
      {resolvedPostGarmentSections}
      {resolvedPreMeasurementSections}
      {((resolvedShowAllMeasurementSections || shouldShowJacketSection(activeCategories))) ? <Fragment key="jacket-measurements">{jacketMeasurementsSection}</Fragment> : null}
      {((resolvedShowAllMeasurementSections || shouldShowWaistcoatSection(activeCategories))) ? <Fragment key="waistcoat-measurements">{waistcoatMeasurementsSection}</Fragment> : null}
      {((resolvedShowAllMeasurementSections || shouldShowTrousersSection(activeCategories))) ? <Fragment key="trousers-measurements">{trousersMeasurementsSection}</Fragment> : null}
      {((resolvedShowAllMeasurementSections || shouldShowCoatSection(activeCategories))) ? <Fragment key="coat-measurements">{coatMeasurementsSection}</Fragment> : null}
      {((resolvedShowAllMeasurementSections || shouldShowShirtSection(activeCategories))) ? <Fragment key="shirt-measurements">{shirtMeasurementsSection}</Fragment> : null}
      {((resolvedShowAllMeasurementSections || shouldShowSweaterSection(activeCategories))) ? <Fragment key="sweater-measurements">{sweaterMeasurementsSection}</Fragment> : null}
    </>
  );
}
