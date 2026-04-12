import Link from "next/link";
import {
  addToCartAction,
  buyNowAction,
  dismissMarketplaceIntroAction,
  logoutAction,
  toggleSaveListingAction
} from "@/app/actions";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { MarketplaceSavedSearchActions } from "@/components/marketplace-saved-search-actions";
import { MarketplaceSortControl } from "@/components/marketplace-sort-control";
import { AppShell, PageWrap } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { matchesBrandFilters } from "@/lib/brands";
import { buyerCountryOptions } from "@/lib/countries";
import { getCartIds } from "@/lib/cart";
import { formatDisplayValue, formatListingSizeLabel, formatSizeLabel } from "@/lib/display";
import { getFitRecommendation } from "@/lib/fit";
import { isStripeConfigured } from "@/lib/stripe";
import type { BuyerProfile, Listing } from "@/lib/types";
import { ensureSeedData, isDatabaseConfigured, listMarketplace, listSavedListingsForUser, listSavedSearchesForUser } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const MARKETPLACE_PAGE_SIZE = 24;
export type MarketplaceFitMode = "strict" | "flexible" | "browse";

type SearchRankingSignals = {
  fitScoreNormalized: number;
  fitStatusBoost: number;
  tailoringPenaltyNormalized: number;
  queryRelevanceScore: number;
  marketplaceQualityScore: number;
  freshnessScore: number;
  tasteAffinityScore: number;
  finalRecommendedScore: number;
};

type RankingWeightName = keyof Omit<SearchRankingSignals, "finalRecommendedScore">;

type SearchRankingContext = {
  buyerProfile?: BuyerProfile;
  fitMode: MarketplaceFitMode;
  query: string;
  now: number;
};

const RECOMMENDED_RANKING_WEIGHTS: Record<MarketplaceFitMode, Record<RankingWeightName, number>> = {
  flexible: {
    fitScoreNormalized: 0.45,
    fitStatusBoost: 0.15,
    queryRelevanceScore: 0.15,
    marketplaceQualityScore: 0.1,
    tailoringPenaltyNormalized: -0.1,
    freshnessScore: 0.05,
    tasteAffinityScore: 0
  },
  strict: {
    fitScoreNormalized: 0.25,
    fitStatusBoost: 0.1,
    queryRelevanceScore: 0.3,
    marketplaceQualityScore: 0.2,
    tailoringPenaltyNormalized: -0.1,
    freshnessScore: 0.1,
    tasteAffinityScore: 0
  },
  browse: {
    fitScoreNormalized: 0.1,
    fitStatusBoost: 0.05,
    queryRelevanceScore: 0.4,
    marketplaceQualityScore: 0.25,
    tailoringPenaltyNormalized: -0.05,
    freshnessScore: 0.1,
    tasteAffinityScore: 0
  }
};

export const categoryOptions: Array<[string, string]> = [
  ["jacket", "Jacket"],
  ["waistcoat", "Waistcoat"],
  ["trousers", "Trousers"],
  ["two_piece_suit", "Two Piece Suit"],
  ["three_piece_suit", "Three Piece Suit"],
  ["coat", "Coat"],
  ["shirt", "Shirt"],
  ["sweater", "Sweater"]
];

function categoryValues(filters: Record<string, string | string[] | undefined>) {
  return rawAllValues(filters.category);
}

function hasNoCategoriesSelected(filters: Record<string, string | string[] | undefined>) {
  return categoryValues(filters).includes("__none__");
}

function selectedCategoryValues(filters: Record<string, string | string[] | undefined>) {
  return categoryValues(filters).filter((value) => value !== "__none__");
}

function fitModeValue(filters: Record<string, string | string[] | undefined>): MarketplaceFitMode {
  const fitMode = firstValue(filters.fitMode);
  return fitMode === "flexible" || fitMode === "strict" ? fitMode : "browse";
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

export const materialOptions: Array<[string, string]> = [
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
  ["other", "Other"]
];

export const shirtMaterialOptions: Array<[string, string]> = [
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
  ["other", "Other"]
];

export const sweaterMaterialOptions: Array<[string, string]> = [
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
  ["other", "Other"]
];

export const sweaterKnitTypeOptions: Array<[string, string]> = [
  ["aran", "Aran"],
  ["boucle", "Bouclé"],
  ["cable_knit", "Cable"],
  ["fleece", "Fleece"],
  ["fisherman", "Fisherman"],
  ["jersey", "Jersey"],
  ["rib", "Rib"],
  ["terry", "Terry"],
  ["waffle_knit", "Waffle"],
  ["other", "Other"]
];

export const patternOptions: Array<[string, string]> = [
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
];

export const shirtPatternOptions: Array<[string, string]> = [
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
];

export const primaryColorOptions: Array<[string, string]> = [
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
];

export const countryOfOriginOptions: Array<[string, string]> = buyerCountryOptions;

export const conditionOptions: Array<[string, string]> = [
  ["new_with_tags", "New With Tags"],
  ["new_without_tags", "New Without Tags"],
  ["used_excellent", "Used - Excellent"],
  ["used_very_good", "Used - Very Good"],
  ["used_good", "Used - Good"],
  ["used_fair", "Used - Fair"],
  ["used_poor", "Used - Poor"]
];

export const fabricWeightOptions: Array<[string, string]> = [
  ["light", "Light"],
  ["medium", "Medium"],
  ["heavy", "Heavy"]
];

export const fabricTypeOptions: Array<[string, string]> = [
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
];

export const shirtClothTypeOptions: Array<[string, string]> = [
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
  ["pique", "PiquÃ©"],
  ["seersucker", "Seersucker"],
  ["twill", "Twill"]
];

export const yesNoAnyOptions: Array<[string, string]> = [
  ["yes", "Yes"],
  ["no", "No"]
];

export const vintageEraOptions: Array<[string, string]> = [
  ["modern", "Contemporary (~ post-2000)"],
  ["vintage_1970_2000", "Newer Vintage (~ 1970-2000)"],
  ["vintage_1940_1970", "Older Vintage (~ 1940-1970)"],
  ["vintage_pre_1940", "Antique (~ pre-1940)"]
];

export const breastedCutOptions: Array<[string, string]> = [
  ["single_breasted", "Single Breasted"],
  ["double_breasted", "Double Breasted"]
];

export const lapelOptions: Array<[string, string]> = [
  ["notch", "Notch"],
  ["peak", "Peak"],
  ["shawl", "Shawl"]
];

export const waistcoatLapelOptions: Array<[string, string]> = [
  ["notch", "Notch"],
  ["peak", "Peak"],
  ["shawl", "Shawl"],
  ["na", "N/A"]
];

export const jacketButtonStyleOptions: Array<[string, string]> = [
  ["1_button", "1 Button"],
  ["2_buttons", "2 Buttons"],
  ["3_buttons", "3 Buttons"],
  ["4_buttons", "4 Buttons"],
  ["5_buttons", "5 Buttons"],
  ["6_buttons", "6 Buttons"],
  ["8_buttons", "8 Buttons"]
];

export const ventStyleOptions: Array<[string, string]> = [
  ["unvented", "Unvented"],
  ["single_vented", "Single Vented"],
  ["double_vented", "Double Vented"]
];

export const shirtCollarStyleOptions: Array<[string, string]> = [
  ["spread", "Spread"],
  ["point", "Point"],
  ["button_down", "Button Down"],
  ["club", "Club"],
  ["band", "Band"],
  ["wing", "Wing"],
  ["cutaway", "Cutaway"],
  ["tab", "Tab"]
];

export const shirtCuffStyleOptions: Array<[string, string]> = [
  ["barrel", "Barrel"],
  ["french", "French"],
  ["convertible", "Convertible"]
];

export const shirtPlacketOptions: Array<[string, string]> = [
  ["standard", "Standard"],
  ["hidden", "Hidden"],
  ["studs", "Studs"],
  ["none", "None"]
];

export const sweaterNecklineOptions: Array<[string, string]> = [
  ["boat_neck", "Boat Neck"],
  ["crew_neck", "Crew Neck"],
  ["hooded", "Hooded"],
  ["mock_neck", "Mock Neck"],
  ["polo_collar", "Polo Collar"],
  ["roll_neck", "Roll Neck"],
  ["shawl_collar", "Shawl Collar"],
  ["turtleneck", "Turtleneck"],
  ["v_neck", "V-Neck"]
];

export const sweaterClosureOptions: Array<[string, string]> = [
  ["none", "Pullover/None"],
  ["quarter_zip", "Quarter Zip"],
  ["half_zip", "Half Zip"],
  ["full_zip", "Full Zip"],
  ["button_front", "Button Front"],
  ["toggle_front", "Toggle Front"]
];

export const sweaterPatternOptions: Array<[string, string]> = [
  ["color_block", "Color Block"],
  ["fair_isle", "Fair Isle"],
  ["heathered", "Heathered"],
  ["micropattern", "Micro Pattern"],
  ["nordic", "Nordic"],
  ["plaid", "Plaid"],
  ["solid", "Solid"],
  ["striped", "Striped"],
  ["other", "Other"]
];

export const canvasOptions: Array<[string, string]> = [
  ["full", "Full"],
  ["half", "Half"],
  ["uncanvassed", "Uncanvassed"],
  ["fused", "Fused"],
  ["other", "Other"]
];

export const liningOptions: Array<[string, string]> = [
  ["full", "Full"],
  ["half", "Half"],
  ["unlined", "Unlined"]
];

export const formalOptions: Array<[string, string]> = [
  ["black_tie", "Black Tie"],
  ["white_tie", "White Tie"],
  ["morning_dress", "Morning Dress"],
  ["na", "N/A"]
];

export const trouserCutOptions: Array<[string, string]> = [
  ["wide", "Wide"],
  ["straight", "Straight"],
  ["tapered", "Tapered"],
  ["slim", "Slim"]
];

export const trouserFrontOptions: Array<[string, string]> = [
  ["flat", "Flat"],
  ["pleated", "Pleated"]
];

export function firstValue(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;
  return resolvedValue === "__none__" ? undefined : resolvedValue;
}

export function positivePageValue(value: string | string[] | undefined) {
  const raw = firstValue(value);
  if (!raw) {
    return 1;
  }

  const numeric = Number(raw);
  if (Number.isNaN(numeric) || numeric < 1) {
    return 1;
  }

  return Math.floor(numeric);
}

export function allValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter((item) => Boolean(item) && item !== "__none__");
  }

  return value && value !== "__none__" ? [value] : [];
}

function rawAllValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function numberFilterValue(value: string | string[] | undefined) {
  const normalized = firstValue(value);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isNaN(numeric) ? null : numeric;
}

export function normalizeSearchQuery(value: string | string[] | undefined) {
  return firstValue(value)?.trim() ?? "";
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displaySearchParam(value: string | string[] | undefined) {
  const raw = firstValue(value);
  return raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : "";
}

function includeAllowanceEnabled(value: string | string[] | undefined) {
  const values = allValues(value);
  if (values.length === 0) {
    return true;
  }

  return values.includes("yes");
}

function tokenizeSearchClause(clause: string) {
  return normalizeSearchText(clause)
    .split(/\s+(?:AND\s+)?/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function listingSearchFields(listing: Listing) {
  const styleFields = [
    listing.lapel,
    listing.jacketSpecs?.cut,
    listing.jacketSpecs?.lapel,
    listing.jacketSpecs?.buttonStyle,
    listing.jacketSpecs?.ventStyle,
    listing.jacketSpecs?.canvas,
    listing.jacketSpecs?.formal,
    listing.shirtSpecs?.collarStyle,
    listing.shirtSpecs?.cuffStyle,
    listing.shirtSpecs?.placket,
    listing.sweaterSpecs?.neckline,
    listing.sweaterSpecs?.closure,
    listing.waistcoatSpecs?.cut,
    listing.waistcoatSpecs?.lapel,
    listing.waistcoatSpecs?.formal,
    listing.trouserSpecs?.cut,
    listing.trouserSpecs?.front,
    listing.trouserSpecs?.formal
  ];

  return [
    { text: listing.title, weight: 4 },
    { text: listing.brand, weight: 3.5 },
    { text: listing.category, weight: 3 },
    { text: listing.primaryColor, weight: 2.5 },
    { text: listing.material, weight: 2.25 },
    { text: listing.fabricType, weight: 2.25 },
    { text: listing.pattern, weight: 2 },
    { text: listing.fabricWeight, weight: 1.5 },
    { text: listing.condition, weight: 1 },
    { text: listing.vintage, weight: 1 },
    { text: styleFields.filter(Boolean).join(" "), weight: 2.5 },
    { text: listing.description, weight: 1 }
  ].map((field) => ({
    ...field,
    normalized: normalizeSearchText(field.text ?? "")
  }));
}

function matchesKeywordSearch(listing: Listing, query: string) {
  if (!query) {
    return true;
  }

  const haystack = listingSearchFields(listing).map((field) => field.normalized).join(" ");
  const orClauses = query
    .split(/\s+OR\s+/i)
    .map((clause) => tokenizeSearchClause(clause))
    .filter((tokens) => tokens.length > 0);

  if (!orClauses.length) {
    return true;
  }

  return orClauses.some((tokens) => tokens.every((token) => haystack.includes(token)));
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function queryRelevanceScore(listing: Listing, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 0.5;
  }

  const clauses = query
    .split(/\s+OR\s+/i)
    .map((clause) => ({
      exactPhrase: normalizeSearchText(clause),
      tokens: tokenizeSearchClause(clause)
    }))
    .filter((clause) => clause.tokens.length > 0);

  if (clauses.length === 0) {
    return 0.5;
  }

  const fields = listingSearchFields(listing);
  const totalWeight = fields.reduce((sum, field) => sum + field.weight, 0);

  const clauseScores = clauses.map(({ exactPhrase, tokens }) => {
    let weightedMatches = 0;
    let exactPhraseBonus = 0;

    for (const field of fields) {
      if (!field.normalized) {
        continue;
      }

      if (field.normalized.includes(exactPhrase)) {
        exactPhraseBonus += field.weight * 0.35;
      }

      const tokenMatchCount = tokens.filter((token) => field.normalized.includes(token)).length;
      if (tokenMatchCount > 0) {
        weightedMatches += field.weight * (tokenMatchCount / tokens.length);
      }
    }

    return boundedScore((weightedMatches + exactPhraseBonus) / totalWeight);
  });

  return Math.max(...clauseScores);
}

function countMeaningfulListingMeasurements(measurements: Record<string, unknown> | null | undefined) {
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

function listingMeasurementCompleteness(listing: Listing) {
  const expectedCounts = {
    upper: 5,
    waistcoat: 4,
    trousers: 5
  };

  const upperCompleteness = boundedScore(countMeaningfulListingMeasurements(listing.jacketMeasurements) / expectedCounts.upper);
  const waistcoatCompleteness = boundedScore(countMeaningfulListingMeasurements(listing.waistcoatMeasurements) / expectedCounts.waistcoat);
  const trouserCompleteness = boundedScore(countMeaningfulListingMeasurements(listing.trouserMeasurements) / expectedCounts.trousers);

  if (listing.category === "trousers") {
    return trouserCompleteness;
  }

  if (listing.category === "waistcoat") {
    return waistcoatCompleteness;
  }

  if (listing.category === "two_piece_suit") {
    return (upperCompleteness + trouserCompleteness) / 2;
  }

  if (listing.category === "three_piece_suit") {
    return (upperCompleteness + trouserCompleteness + waistcoatCompleteness) / 3;
  }

  return upperCompleteness;
}

function hasUsableMetadata(value: string | null | undefined) {
  return Boolean(value && !["unknown", "other", "na"].includes(value));
}

function listingMetadataCompleteness(listing: Listing) {
  const fields = [
    listing.category,
    listing.brand,
    listing.material,
    listing.pattern,
    listing.primaryColor,
    listing.fabricType,
    listing.fabricWeight,
    listing.condition,
    listing.vintage
  ];

  return fields.filter(hasUsableMetadata).length / fields.length;
}

function marketplaceQualityScore(listing: Listing) {
  const measurementCompleteness = listingMeasurementCompleteness(listing);
  const mediaCompleteness = boundedScore(listing.media.length / 3);
  const descriptionCompleteness = boundedScore(normalizeSearchText(listing.description).length / 120);
  const metadataCompleteness = listingMetadataCompleteness(listing);

  return boundedScore(
    measurementCompleteness * 0.35 +
      mediaCompleteness * 0.25 +
      descriptionCompleteness * 0.2 +
      metadataCompleteness * 0.2
  );
}

function freshnessScore(listing: Listing, now: number) {
  const createdAt = new Date(listing.createdAt).getTime();
  if (!Number.isFinite(createdAt)) {
    return 0;
  }

  const ageDays = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
  return boundedScore(1 / (1 + ageDays / 30));
}

function fitStatusBoost(status: ReturnType<typeof getFitRecommendation>["status"]) {
  return {
    strong_match: 1,
    workable_with_tailoring: 0.72,
    risky_but_possible: 0.35,
    not_recommended: 0
  }[status];
}

function tailoringPenaltyNormalized(estimatedAlterationCost: number | null | undefined) {
  if (estimatedAlterationCost === null || estimatedAlterationCost === undefined) {
    return 0;
  }

  return boundedScore(estimatedAlterationCost / 300);
}

function recommendedRankingWeights(fitMode: MarketplaceFitMode, hasFitProfile: boolean) {
  const weights = { ...RECOMMENDED_RANKING_WEIGHTS[fitMode] };
  if (!hasFitProfile) {
    weights.fitScoreNormalized = 0;
    weights.fitStatusBoost = 0;
    weights.tailoringPenaltyNormalized = 0;
  }

  return weights;
}

function computeRecommendedScore(
  signals: Omit<SearchRankingSignals, "finalRecommendedScore">,
  fitMode: MarketplaceFitMode,
  hasFitProfile: boolean
) {
  const weights = recommendedRankingWeights(fitMode, hasFitProfile);
  const weightedScore = (Object.keys(weights) as RankingWeightName[]).reduce(
    (sum, key) => sum + signals[key] * weights[key],
    0
  );
  const positiveWeightTotal = (Object.keys(weights) as RankingWeightName[]).reduce(
    (sum, key) => sum + Math.max(0, weights[key]),
    0
  );

  return positiveWeightTotal > 0 ? weightedScore / positiveWeightTotal : 0;
}

function buildSearchRankingSignals(listing: Listing, context: SearchRankingContext): SearchRankingSignals {
  const hasFitProfile = hasSavedFitMeasurements(context.buyerProfile);
  const fit = hasFitProfile && context.buyerProfile ? getFitRecommendation(context.buyerProfile, listing) : null;
  const signals = {
    fitScoreNormalized: fit ? boundedScore(fit.score / 100) : 0,
    fitStatusBoost: fit ? fitStatusBoost(fit.status) : 0,
    tailoringPenaltyNormalized: fit ? tailoringPenaltyNormalized(fit.estimatedAlterationCost) : 0,
    queryRelevanceScore: queryRelevanceScore(listing, context.query),
    marketplaceQualityScore: marketplaceQualityScore(listing),
    freshnessScore: freshnessScore(listing, context.now),
    tasteAffinityScore: 0
  };

  return {
    ...signals,
    finalRecommendedScore: computeRecommendedScore(signals, context.fitMode, hasFitProfile)
  };
}

export function hasStructuredMeasurementFilters(filters: Record<string, string | string[] | undefined>) {
  const measurementFields = [
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
    "coatArmLengthMax",
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
    "sweaterArmLengthMax"
  ];

  return measurementFields.some((field) => numberFilterValue(filters[field]) !== null);
}

function measurementWithinRange(listingValue: number | null | undefined, targetValue: number | null, tolerance: number) {
  if (targetValue === null) {
    return true;
  }

  if (!listingValue) {
    return false;
  }

  return Math.abs(listingValue - targetValue) <= tolerance;
}

function measurementWithinCustomRange(
  listingValue: number | null | undefined,
  minValue: number | null,
  maxValue: number | null
) {
  if (minValue === null && maxValue === null) {
    return true;
  }

  if (!listingValue) {
    return false;
  }

  if (minValue !== null && listingValue < minValue) {
    return false;
  }

  if (maxValue !== null && listingValue > maxValue) {
    return false;
  }

  return true;
}

function measurementMatchesAllowanceRange(
  listingValue: number | null | undefined,
  allowanceValue: number | null | undefined,
  minValue: number | null,
  maxValue: number | null,
  includeAllowance: boolean
) {
  if (!includeAllowance) {
    return measurementWithinCustomRange(listingValue, minValue, maxValue);
  }

  if (minValue === null && maxValue === null) {
    return true;
  }

  if (!listingValue) {
    return false;
  }

  const allowanceMax = listingValue + Math.max(0, allowanceValue ?? 0);
  const effectiveMin = minValue ?? Number.NEGATIVE_INFINITY;
  const effectiveMax = maxValue ?? Number.POSITIVE_INFINITY;

  return allowanceMax >= effectiveMin && listingValue <= effectiveMax;
}

function resolveFilterMeasurement(
  filters: Record<string, string | string[] | undefined>,
  key: string,
  fallbackValue?: number | null,
  useProfile?: boolean
) {
  const directValue = numberFilterValue(filters[key]);
  if (directValue !== null) {
    return directValue;
  }

  if (useProfile && fallbackValue) {
    return fallbackValue;
  }

  return null;
}

function hasRangeFilter(
  filters: Record<string, string | string[] | undefined>,
  minKey: string,
  maxKey: string
) {
  return numberFilterValue(filters[minKey]) !== null || numberFilterValue(filters[maxKey]) !== null;
}

function hasSelectedOptions(filters: Record<string, string | string[] | undefined>, ...keys: string[]) {
  return keys.some((key) => allValues(filters[key]).length > 0);
}

function matchesSelectedOptions(selectedValues: string[], listingValue: string | null | undefined) {
  if (selectedValues.length === 0) {
    return true;
  }

  if (!listingValue) {
    return false;
  }

  if (selectedValues.includes("other") && listingValue === "unknown") {
    return true;
  }

  return selectedValues.includes(listingValue);
}

function matchesJacketFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedCuts = allValues(filters.jacketCut);
  const selectedLapels = allValues(filters.jacketLapel);
  const selectedButtonStyles = allValues(filters.jacketButtonStyle);
  const selectedVentStyles = allValues(filters.jacketVentStyle);
  const selectedCanvas = allValues(filters.jacketCanvas);
  const selectedLining = allValues(filters.jacketLining);
  const selectedFormal = allValues(filters.jacketFormal);

  if (!["jacket", "two_piece_suit", "three_piece_suit"].includes(listing.category)) {
    const hasJacketRange =
      hasRangeFilter(filters, "jacketChestMin", "jacketChestMax") ||
      hasRangeFilter(filters, "jacketWaistMin", "jacketWaistMax") ||
      hasRangeFilter(filters, "jacketShouldersMin", "jacketShouldersMax") ||
      hasRangeFilter(filters, "jacketBodyLengthMin", "jacketBodyLengthMax") ||
      hasRangeFilter(filters, "jacketArmLengthMin", "jacketArmLengthMax");

    const hasJacketSpecs = hasSelectedOptions(
      filters,
      "jacketCut",
      "jacketLapel",
      "jacketButtonStyle",
      "jacketVentStyle",
      "jacketCanvas",
      "jacketLining",
      "jacketFormal"
    );

    if (hasJacketSpecs) {
      return false;
    }

    return true;
  }

  const measurements = ["jacket", "two_piece_suit", "three_piece_suit"].includes(listing.category)
    ? listing.jacketMeasurements
    : null;
  const profileMeasurements = buyerProfile?.jacketMeasurements;
  const hasCustomRange =
    hasRangeFilter(filters, "jacketChestMin", "jacketChestMax") ||
    hasRangeFilter(filters, "jacketWaistMin", "jacketWaistMax") ||
    hasRangeFilter(filters, "jacketShouldersMin", "jacketShouldersMax") ||
    hasRangeFilter(filters, "jacketBodyLengthMin", "jacketBodyLengthMax") ||
    hasRangeFilter(filters, "jacketArmLengthMin", "jacketArmLengthMax");

  if (applyMeasurementFilters && hasCustomRange) {
    const matchesMeasurements = (
      measurementWithinCustomRange(measurements?.chest, numberFilterValue(filters.jacketChestMin), numberFilterValue(filters.jacketChestMax)) &&
      measurementWithinCustomRange(measurements?.waist, numberFilterValue(filters.jacketWaistMin), numberFilterValue(filters.jacketWaistMax)) &&
      measurementWithinCustomRange(measurements?.shoulders, numberFilterValue(filters.jacketShouldersMin), numberFilterValue(filters.jacketShouldersMax)) &&
      measurementWithinCustomRange(measurements?.bodyLength, numberFilterValue(filters.jacketBodyLengthMin), numberFilterValue(filters.jacketBodyLengthMax)) &&
      measurementMatchesAllowanceRange(
        measurements?.sleeveLength,
        measurements?.sleeveLengthAllowance,
        numberFilterValue(filters.jacketArmLengthMin),
        numberFilterValue(filters.jacketArmLengthMax),
        includeAllowanceEnabled(filters.jacketArmLengthIncludeAllowance)
      )
    );

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedCuts, listing.jacketSpecs?.cut) &&
      matchesSelectedOptions(selectedLapels, listing.jacketSpecs?.lapel) &&
      matchesSelectedOptions(selectedButtonStyles, listing.jacketSpecs?.buttonStyle) &&
      matchesSelectedOptions(selectedVentStyles, listing.jacketSpecs?.ventStyle) &&
      matchesSelectedOptions(selectedCanvas, listing.jacketSpecs?.canvas) &&
      matchesSelectedOptions(selectedLining, listing.jacketSpecs?.lining) &&
      matchesSelectedOptions(selectedFormal, listing.jacketSpecs?.formal)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.chest, resolveFilterMeasurement(filters, "jacketChest", profileMeasurements?.chest, useProfile), 2.25) &&
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "jacketWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.shoulders, resolveFilterMeasurement(filters, "jacketShoulders", profileMeasurements?.shoulders, useProfile), 0.85) &&
      measurementWithinRange(measurements?.bodyLength, resolveFilterMeasurement(filters, "jacketBodyLength", profileMeasurements?.bodyLength, useProfile), 2) &&
      measurementWithinRange(measurements?.sleeveLength, resolveFilterMeasurement(filters, "jacketArmLength", profileMeasurements?.sleeveLength, useProfile), 1)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedCuts, listing.jacketSpecs?.cut) &&
    matchesSelectedOptions(selectedLapels, listing.jacketSpecs?.lapel) &&
    matchesSelectedOptions(selectedButtonStyles, listing.jacketSpecs?.buttonStyle) &&
    matchesSelectedOptions(selectedVentStyles, listing.jacketSpecs?.ventStyle) &&
    matchesSelectedOptions(selectedCanvas, listing.jacketSpecs?.canvas) &&
    matchesSelectedOptions(selectedLining, listing.jacketSpecs?.lining) &&
    matchesSelectedOptions(selectedFormal, listing.jacketSpecs?.formal)
  );
}

function matchesShirtFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedCollarStyles = allValues(filters.shirtCollarStyle);
  const selectedCuffStyles = allValues(filters.shirtCuffStyle);
  const selectedPlackets = allValues(filters.shirtPlacket);

  if (listing.category !== "shirt") {
    const hasShirtRange =
      hasRangeFilter(filters, "shirtChestMin", "shirtChestMax") ||
      hasRangeFilter(filters, "shirtNeckMin", "shirtNeckMax") ||
      hasRangeFilter(filters, "shirtWaistMin", "shirtWaistMax") ||
      hasRangeFilter(filters, "shirtShouldersMin", "shirtShouldersMax") ||
      hasRangeFilter(filters, "shirtBodyLengthMin", "shirtBodyLengthMax") ||
      hasRangeFilter(filters, "shirtArmLengthMin", "shirtArmLengthMax");
    const hasShirtSpecs = hasSelectedOptions(filters, "shirtCollarStyle", "shirtCuffStyle", "shirtPlacket");

    if (hasShirtSpecs) {
      return false;
    }

    return true;
  }

  const measurements = listing.jacketMeasurements;
  const profileMeasurements = buyerProfile?.jacketMeasurements;
  const hasCustomRange =
      hasRangeFilter(filters, "shirtChestMin", "shirtChestMax") ||
      hasRangeFilter(filters, "shirtNeckMin", "shirtNeckMax") ||
      hasRangeFilter(filters, "shirtWaistMin", "shirtWaistMax") ||
    hasRangeFilter(filters, "shirtShouldersMin", "shirtShouldersMax") ||
    hasRangeFilter(filters, "shirtBodyLengthMin", "shirtBodyLengthMax") ||
    hasRangeFilter(filters, "shirtArmLengthMin", "shirtArmLengthMax");

  if (applyMeasurementFilters && hasCustomRange) {
      const matchesMeasurements =
      measurementWithinCustomRange(measurements?.neck, numberFilterValue(filters.shirtNeckMin), numberFilterValue(filters.shirtNeckMax)) &&
      measurementWithinCustomRange(measurements?.chest, numberFilterValue(filters.shirtChestMin), numberFilterValue(filters.shirtChestMax)) &&
      measurementWithinCustomRange(measurements?.waist, numberFilterValue(filters.shirtWaistMin), numberFilterValue(filters.shirtWaistMax)) &&
      measurementWithinCustomRange(measurements?.shoulders, numberFilterValue(filters.shirtShouldersMin), numberFilterValue(filters.shirtShouldersMax)) &&
      measurementWithinCustomRange(measurements?.bodyLength, numberFilterValue(filters.shirtBodyLengthMin), numberFilterValue(filters.shirtBodyLengthMax)) &&
      measurementWithinCustomRange(measurements?.sleeveLength, numberFilterValue(filters.shirtArmLengthMin), numberFilterValue(filters.shirtArmLengthMax));

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedCollarStyles, listing.shirtSpecs?.collarStyle) &&
      matchesSelectedOptions(selectedCuffStyles, listing.shirtSpecs?.cuffStyle) &&
      matchesSelectedOptions(selectedPlackets, listing.shirtSpecs?.placket)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.neck, resolveFilterMeasurement(filters, "shirtNeck", profileMeasurements?.neck, useProfile), 0.75) &&
      measurementWithinRange(measurements?.chest, resolveFilterMeasurement(filters, "shirtChest", profileMeasurements?.chest, useProfile), 2.25) &&
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "shirtWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.shoulders, resolveFilterMeasurement(filters, "shirtShoulders", profileMeasurements?.shoulders, useProfile), 0.85) &&
      measurementWithinRange(measurements?.bodyLength, resolveFilterMeasurement(filters, "shirtBodyLength", profileMeasurements?.bodyLength, useProfile), 2) &&
      measurementWithinRange(measurements?.sleeveLength, resolveFilterMeasurement(filters, "shirtArmLength", profileMeasurements?.sleeveLength, useProfile), 1)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedCollarStyles, listing.shirtSpecs?.collarStyle) &&
    matchesSelectedOptions(selectedCuffStyles, listing.shirtSpecs?.cuffStyle) &&
    matchesSelectedOptions(selectedPlackets, listing.shirtSpecs?.placket)
  );
}

function matchesSweaterFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedNecklines = allValues(filters.sweaterNeckline);
  const selectedClosures = allValues(filters.sweaterClosure);

  if (listing.category !== "sweater") {
    const hasSweaterRange =
      hasRangeFilter(filters, "sweaterChestMin", "sweaterChestMax") ||
      hasRangeFilter(filters, "sweaterWaistMin", "sweaterWaistMax") ||
      hasRangeFilter(filters, "sweaterShouldersMin", "sweaterShouldersMax") ||
      hasRangeFilter(filters, "sweaterBodyLengthMin", "sweaterBodyLengthMax") ||
      hasRangeFilter(filters, "sweaterArmLengthMin", "sweaterArmLengthMax");
    const hasSweaterSpecs = hasSelectedOptions(filters, "sweaterNeckline", "sweaterClosure");

    if (hasSweaterSpecs) {
      return false;
    }

    return true;
  }

  const measurements = listing.jacketMeasurements;
  const profileMeasurements = buyerProfile?.jacketMeasurements;
  const hasCustomRange =
    hasRangeFilter(filters, "sweaterChestMin", "sweaterChestMax") ||
    hasRangeFilter(filters, "sweaterWaistMin", "sweaterWaistMax") ||
    hasRangeFilter(filters, "sweaterShouldersMin", "sweaterShouldersMax") ||
    hasRangeFilter(filters, "sweaterBodyLengthMin", "sweaterBodyLengthMax") ||
    hasRangeFilter(filters, "sweaterArmLengthMin", "sweaterArmLengthMax");

  if (applyMeasurementFilters && hasCustomRange) {
    const matchesMeasurements =
      measurementWithinCustomRange(measurements?.chest, numberFilterValue(filters.sweaterChestMin), numberFilterValue(filters.sweaterChestMax)) &&
      measurementWithinCustomRange(measurements?.waist, numberFilterValue(filters.sweaterWaistMin), numberFilterValue(filters.sweaterWaistMax)) &&
      measurementWithinCustomRange(measurements?.shoulders, numberFilterValue(filters.sweaterShouldersMin), numberFilterValue(filters.sweaterShouldersMax)) &&
      measurementWithinCustomRange(measurements?.bodyLength, numberFilterValue(filters.sweaterBodyLengthMin), numberFilterValue(filters.sweaterBodyLengthMax)) &&
      measurementWithinCustomRange(measurements?.sleeveLength, numberFilterValue(filters.sweaterArmLengthMin), numberFilterValue(filters.sweaterArmLengthMax));

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedNecklines, listing.sweaterSpecs?.neckline) &&
      matchesSelectedOptions(selectedClosures, listing.sweaterSpecs?.closure)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.chest, resolveFilterMeasurement(filters, "sweaterChest", profileMeasurements?.chest, useProfile), 2.25) &&
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "sweaterWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.shoulders, resolveFilterMeasurement(filters, "sweaterShoulders", profileMeasurements?.shoulders, useProfile), 0.85) &&
      measurementWithinRange(measurements?.bodyLength, resolveFilterMeasurement(filters, "sweaterBodyLength", profileMeasurements?.bodyLength, useProfile), 2) &&
      measurementWithinRange(measurements?.sleeveLength, resolveFilterMeasurement(filters, "sweaterArmLength", profileMeasurements?.sleeveLength, useProfile), 1)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedNecklines, listing.sweaterSpecs?.neckline) &&
    matchesSelectedOptions(selectedClosures, listing.sweaterSpecs?.closure)
  );
}

function matchesWaistcoatFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedCuts = allValues(filters.waistcoatCut);
  const selectedLapels = allValues(filters.waistcoatLapel);
  const selectedFormal = allValues(filters.waistcoatFormal);

  if (!["waistcoat", "three_piece_suit"].includes(listing.category)) {
    const hasWaistcoatRange =
      hasRangeFilter(filters, "waistcoatChestMin", "waistcoatChestMax") ||
      hasRangeFilter(filters, "waistcoatWaistMin", "waistcoatWaistMax") ||
      hasRangeFilter(filters, "waistcoatShouldersMin", "waistcoatShouldersMax") ||
      hasRangeFilter(filters, "waistcoatBodyLengthMin", "waistcoatBodyLengthMax");

    const hasWaistcoatSpecs = hasSelectedOptions(filters, "waistcoatCut", "waistcoatLapel", "waistcoatFormal");

    if (hasWaistcoatSpecs) {
      return false;
    }

    return true;
  }

  const measurements = listing.waistcoatMeasurements;
  const profileMeasurements = buyerProfile?.waistcoatMeasurements;
  const hasCustomRange =
    hasRangeFilter(filters, "waistcoatChestMin", "waistcoatChestMax") ||
    hasRangeFilter(filters, "waistcoatWaistMin", "waistcoatWaistMax") ||
    hasRangeFilter(filters, "waistcoatShouldersMin", "waistcoatShouldersMax") ||
    hasRangeFilter(filters, "waistcoatBodyLengthMin", "waistcoatBodyLengthMax");

  if (applyMeasurementFilters && hasCustomRange) {
    const matchesMeasurements = (
      measurementWithinCustomRange(measurements?.chest, numberFilterValue(filters.waistcoatChestMin), numberFilterValue(filters.waistcoatChestMax)) &&
      measurementWithinCustomRange(measurements?.waist, numberFilterValue(filters.waistcoatWaistMin), numberFilterValue(filters.waistcoatWaistMax)) &&
      measurementWithinCustomRange(measurements?.shoulders, numberFilterValue(filters.waistcoatShouldersMin), numberFilterValue(filters.waistcoatShouldersMax)) &&
      measurementWithinCustomRange(measurements?.bodyLength, numberFilterValue(filters.waistcoatBodyLengthMin), numberFilterValue(filters.waistcoatBodyLengthMax))
    );

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedCuts, listing.waistcoatSpecs?.cut) &&
      matchesSelectedOptions(selectedLapels, listing.waistcoatSpecs?.lapel) &&
      matchesSelectedOptions(selectedFormal, listing.waistcoatSpecs?.formal)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.chest, resolveFilterMeasurement(filters, "waistcoatChest", profileMeasurements?.chest, useProfile), 2.25) &&
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "waistcoatWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.shoulders, resolveFilterMeasurement(filters, "waistcoatShoulders", profileMeasurements?.shoulders, useProfile), 0.85) &&
      measurementWithinRange(measurements?.bodyLength, resolveFilterMeasurement(filters, "waistcoatBodyLength", profileMeasurements?.bodyLength, useProfile), 2)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedCuts, listing.waistcoatSpecs?.cut) &&
    matchesSelectedOptions(selectedLapels, listing.waistcoatSpecs?.lapel) &&
    matchesSelectedOptions(selectedFormal, listing.waistcoatSpecs?.formal)
  );
}

function matchesTrouserFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedCuts = allValues(filters.trouserCut);
  const selectedFronts = allValues(filters.trouserFront);
  const selectedFormal = allValues(filters.trouserFormal);

  if (!["trousers", "two_piece_suit", "three_piece_suit"].includes(listing.category)) {
    const hasTrouserRange =
      hasRangeFilter(filters, "trouserWaistMin", "trouserWaistMax") ||
      hasRangeFilter(filters, "trouserHipsMin", "trouserHipsMax") ||
      hasRangeFilter(filters, "trouserInseamMin", "trouserInseamMax") ||
      hasRangeFilter(filters, "trouserOutseamMin", "trouserOutseamMax") ||
      hasRangeFilter(filters, "trouserOpeningMin", "trouserOpeningMax");

    const hasTrouserSpecs = hasSelectedOptions(filters, "trouserCut", "trouserFront", "trouserFormal");

    if (hasTrouserSpecs) {
      return false;
    }

    return true;
  }

  const measurements = listing.trouserMeasurements;
  const profileMeasurements = buyerProfile?.trouserMeasurements;
  const hasCustomRange =
    hasRangeFilter(filters, "trouserWaistMin", "trouserWaistMax") ||
    hasRangeFilter(filters, "trouserHipsMin", "trouserHipsMax") ||
    hasRangeFilter(filters, "trouserInseamMin", "trouserInseamMax") ||
    hasRangeFilter(filters, "trouserOutseamMin", "trouserOutseamMax") ||
    hasRangeFilter(filters, "trouserOpeningMin", "trouserOpeningMax");

  if (applyMeasurementFilters && hasCustomRange) {
    const matchesMeasurements = (
      measurementMatchesAllowanceRange(
        measurements?.waist,
        measurements?.waistAllowance,
        numberFilterValue(filters.trouserWaistMin),
        numberFilterValue(filters.trouserWaistMax),
        includeAllowanceEnabled(filters.trouserWaistIncludeAllowance)
      ) &&
      measurementWithinCustomRange(measurements?.hips, numberFilterValue(filters.trouserHipsMin), numberFilterValue(filters.trouserHipsMax)) &&
      measurementMatchesAllowanceRange(
        measurements?.inseam,
        measurements?.inseamOutseamAllowance,
        numberFilterValue(filters.trouserInseamMin),
        numberFilterValue(filters.trouserInseamMax),
        includeAllowanceEnabled(filters.trouserInseamIncludeAllowance)
      ) &&
      measurementMatchesAllowanceRange(
        measurements?.outseam,
        measurements?.inseamOutseamAllowance,
        numberFilterValue(filters.trouserOutseamMin),
        numberFilterValue(filters.trouserOutseamMax),
        includeAllowanceEnabled(filters.trouserOutseamIncludeAllowance)
      ) &&
      measurementWithinCustomRange(measurements?.opening, numberFilterValue(filters.trouserOpeningMin), numberFilterValue(filters.trouserOpeningMax))
    );

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedCuts, listing.trouserSpecs?.cut) &&
      matchesSelectedOptions(selectedFronts, listing.trouserSpecs?.front) &&
      matchesSelectedOptions(selectedFormal, listing.trouserSpecs?.formal)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "trouserWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.hips, resolveFilterMeasurement(filters, "trouserHips", profileMeasurements?.hips, useProfile), 2.5) &&
      measurementWithinRange(measurements?.inseam, resolveFilterMeasurement(filters, "trouserInseam", profileMeasurements?.inseam, useProfile), 1.5) &&
      measurementWithinRange(measurements?.outseam, resolveFilterMeasurement(filters, "trouserOutseam", profileMeasurements?.outseam, useProfile), 1.5) &&
      measurementWithinRange(measurements?.opening, resolveFilterMeasurement(filters, "trouserOpening", profileMeasurements?.opening, useProfile), 1)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedCuts, listing.trouserSpecs?.cut) &&
    matchesSelectedOptions(selectedFronts, listing.trouserSpecs?.front) &&
    matchesSelectedOptions(selectedFormal, listing.trouserSpecs?.formal)
  );
}

function matchesCoatFilters(
  listing: Listing,
  filters: Record<string, string | string[] | undefined>,
  buyerProfile?: BuyerProfile,
  useProfile?: boolean,
  applyMeasurementFilters = true
) {
  const selectedCuts = allValues(filters.coatCut);
  const selectedLapels = allValues(filters.coatLapel);
  const selectedButtonStyles = allValues(filters.coatButtonStyle);
  const selectedVentStyles = allValues(filters.coatVentStyle);
  const selectedCanvas = allValues(filters.coatCanvas);
  const selectedLining = allValues(filters.coatLining);
  const selectedFormal = allValues(filters.coatFormal);

  if (listing.category !== "coat") {
    const hasCoatFilter =
      hasRangeFilter(filters, "coatChestMin", "coatChestMax") ||
      hasRangeFilter(filters, "coatWaistMin", "coatWaistMax") ||
      hasRangeFilter(filters, "coatShouldersMin", "coatShouldersMax") ||
      hasRangeFilter(filters, "coatBodyLengthMin", "coatBodyLengthMax") ||
      hasRangeFilter(filters, "coatArmLengthMin", "coatArmLengthMax");
    const hasCoatSpecs = hasSelectedOptions(
      filters,
      "coatCut",
      "coatLapel",
      "coatButtonStyle",
      "coatVentStyle",
      "coatCanvas",
      "coatLining",
      "coatFormal"
    );
    if (hasCoatSpecs) {
      return false;
    }
    return true;
  }

  const measurements = listing.jacketMeasurements;
  const profileMeasurements = buyerProfile?.coatMeasurements;
  const hasCustomRange =
    hasRangeFilter(filters, "coatChestMin", "coatChestMax") ||
    hasRangeFilter(filters, "coatWaistMin", "coatWaistMax") ||
    hasRangeFilter(filters, "coatShouldersMin", "coatShouldersMax") ||
    hasRangeFilter(filters, "coatBodyLengthMin", "coatBodyLengthMax") ||
    hasRangeFilter(filters, "coatArmLengthMin", "coatArmLengthMax");

  if (applyMeasurementFilters && hasCustomRange) {
    const matchesMeasurements = (
      measurementWithinCustomRange(measurements?.chest, numberFilterValue(filters.coatChestMin), numberFilterValue(filters.coatChestMax)) &&
      measurementWithinCustomRange(measurements?.waist, numberFilterValue(filters.coatWaistMin), numberFilterValue(filters.coatWaistMax)) &&
      measurementWithinCustomRange(measurements?.shoulders, numberFilterValue(filters.coatShouldersMin), numberFilterValue(filters.coatShouldersMax)) &&
      measurementWithinCustomRange(measurements?.bodyLength, numberFilterValue(filters.coatBodyLengthMin), numberFilterValue(filters.coatBodyLengthMax)) &&
      measurementMatchesAllowanceRange(
        measurements?.sleeveLength,
        measurements?.sleeveLengthAllowance,
        numberFilterValue(filters.coatArmLengthMin),
        numberFilterValue(filters.coatArmLengthMax),
        includeAllowanceEnabled(filters.coatArmLengthIncludeAllowance)
      )
    );

    return (
      matchesMeasurements &&
      matchesSelectedOptions(selectedCuts, listing.jacketSpecs?.cut) &&
      matchesSelectedOptions(selectedLapels, listing.jacketSpecs?.lapel) &&
      matchesSelectedOptions(selectedButtonStyles, listing.jacketSpecs?.buttonStyle) &&
      matchesSelectedOptions(selectedVentStyles, listing.jacketSpecs?.ventStyle) &&
      matchesSelectedOptions(selectedCanvas, listing.jacketSpecs?.canvas) &&
      matchesSelectedOptions(selectedLining, listing.jacketSpecs?.lining) &&
      matchesSelectedOptions(selectedFormal, listing.jacketSpecs?.formal)
    );
  }

  const matchesMeasurements =
    !applyMeasurementFilters ||
    (
      measurementWithinRange(measurements?.chest, resolveFilterMeasurement(filters, "coatChest", profileMeasurements?.chest, useProfile), 2.25) &&
      measurementWithinRange(measurements?.waist, resolveFilterMeasurement(filters, "coatWaist", profileMeasurements?.waist, useProfile), 2.5) &&
      measurementWithinRange(measurements?.shoulders, resolveFilterMeasurement(filters, "coatShoulders", profileMeasurements?.shoulders, useProfile), 0.85) &&
      measurementWithinRange(measurements?.bodyLength, resolveFilterMeasurement(filters, "coatBodyLength", profileMeasurements?.bodyLength, useProfile), 2) &&
      measurementWithinRange(measurements?.sleeveLength, resolveFilterMeasurement(filters, "coatArmLength", profileMeasurements?.sleeveLength, useProfile), 1)
    );

  return (
    matchesMeasurements &&
    matchesSelectedOptions(selectedCuts, listing.jacketSpecs?.cut) &&
    matchesSelectedOptions(selectedLapels, listing.jacketSpecs?.lapel) &&
    matchesSelectedOptions(selectedButtonStyles, listing.jacketSpecs?.buttonStyle) &&
    matchesSelectedOptions(selectedVentStyles, listing.jacketSpecs?.ventStyle) &&
    matchesSelectedOptions(selectedCanvas, listing.jacketSpecs?.canvas) &&
    matchesSelectedOptions(selectedLining, listing.jacketSpecs?.lining) &&
    matchesSelectedOptions(selectedFormal, listing.jacketSpecs?.formal)
  );
}

export function getMarketplaceSelections(filters: Record<string, string | string[] | undefined>) {
  const noCategoriesSelected = hasNoCategoriesSelected(filters);

  return {
    sortBy: firstValue(filters.sort) || "recommended",
    keywordQuery: normalizeSearchQuery(filters.q),
    useProfileMeasurements: firstValue(filters.useProfile) === "yes",
    fitMode: fitModeValue(filters),
    selectedCategories: noCategoriesSelected ? ["__none__"] : selectedCategoryValues(filters),
    selectedSizeLabels: allValues(filters.sizeLabel),
    selectedSizeLabelPartOne: firstValue(filters.sizeLabelPartOne) || "",
    selectedSizeLabelPartTwo: firstValue(filters.sizeLabelPartTwo) || "",
    selectedMaterials: allValues(filters.material),
    selectedIncludedBrandIds: allValues(filters.includeBrandId),
    selectedExcludedBrandIds: allValues(filters.excludeBrandId),
    selectedPatterns: allValues(filters.pattern),
    selectedPrimaryColors: allValues(filters.primaryColor),
    selectedCountryOrigins: allValues(filters.countryOfOrigin),
    selectedConditions: allValues(filters.condition),
    selectedFabricWeights: allValues(filters.fabricWeight),
    selectedFabricTypes: allValues(filters.fabricType),
    selectedVintage: allValues(filters.vintage),
    selectedReturnsAccepted: allValues(filters.returnsAccepted),
    selectedAllowOffers: allValues(filters.allowOffers),
    selectedJacketCuts: allValues(filters.jacketCut),
    selectedJacketLapels: allValues(filters.jacketLapel),
    selectedJacketButtonStyles: allValues(filters.jacketButtonStyle),
    selectedJacketVentStyles: allValues(filters.jacketVentStyle),
    selectedJacketCanvas: allValues(filters.jacketCanvas),
    selectedJacketLining: allValues(filters.jacketLining),
    selectedJacketFormal: allValues(filters.jacketFormal),
    selectedShirtCollarStyles: allValues(filters.shirtCollarStyle),
    selectedShirtCuffStyles: allValues(filters.shirtCuffStyle),
    selectedShirtPlackets: allValues(filters.shirtPlacket),
    selectedSweaterNecklines: allValues(filters.sweaterNeckline),
    selectedSweaterClosures: allValues(filters.sweaterClosure),
    selectedWaistcoatCuts: allValues(filters.waistcoatCut),
    selectedWaistcoatLapels: allValues(filters.waistcoatLapel),
    selectedWaistcoatFormal: allValues(filters.waistcoatFormal),
    selectedTrouserCuts: allValues(filters.trouserCut),
    selectedTrouserFronts: allValues(filters.trouserFront),
    selectedTrouserFormal: allValues(filters.trouserFormal),
    selectedCoatCuts: allValues(filters.coatCut),
    selectedCoatLapels: allValues(filters.coatLapel),
    selectedCoatButtonStyles: allValues(filters.coatButtonStyle),
    selectedCoatVentStyles: allValues(filters.coatVentStyle),
    selectedCoatCanvas: allValues(filters.coatCanvas),
    selectedCoatLining: allValues(filters.coatLining),
    selectedCoatFormal: allValues(filters.coatFormal)
  };
}

export function filterAndSortMarketplaceListings({
  sourceListings,
  filters,
  buyerProfile,
  defaultSort
}: {
  sourceListings: Listing[];
  filters: Record<string, string | string[] | undefined>;
  buyerProfile?: BuyerProfile;
  defaultSort?: string;
}) {
  const selections = getMarketplaceSelections(filters);
  const noCategoriesSelected = hasNoCategoriesSelected(filters);
  const canUseSavedFitMeasurements = hasSavedFitMeasurements(buyerProfile);
  const sortBy = firstValue(filters.sort) || defaultSort || "recommended";
  const useFlexibleMeasurementFiltering = selections.fitMode === "flexible" && canUseSavedFitMeasurements;
  const useExactMeasurementFiltering = selections.fitMode === "strict";
  const rankingContext: SearchRankingContext = {
    buyerProfile,
    fitMode: selections.fitMode,
    query: selections.keywordQuery,
    now: Date.now()
  };
  const filteredListings = sourceListings
    .filter((listing) => listing.status === "active")
    .filter((listing) => matchesKeywordSearch(listing, selections.keywordQuery))
    .filter((listing) => {
      if (noCategoriesSelected) {
        return false;
      }

      return selections.selectedCategories.length === 0 || selections.selectedCategories.includes(listing.category);
    })
    .filter((listing) => matchesBrandFilters(listing.brand, selections.selectedIncludedBrandIds, selections.selectedExcludedBrandIds))
    .filter((listing) => {
      if (selections.selectedSizeLabels.length > 0) {
        return selections.selectedSizeLabels.includes(listing.sizeLabel);
      }

      const [partOne = "", partTwo = ""] = listing.sizeLabel.split(/[xX×]/);
      if (selections.selectedSizeLabelPartOne && partOne !== selections.selectedSizeLabelPartOne) {
        return false;
      }
      if (selections.selectedSizeLabelPartTwo && partTwo !== selections.selectedSizeLabelPartTwo) {
        return false;
      }
      return true;
    })
    .filter((listing) => selections.selectedMaterials.length === 0 || selections.selectedMaterials.includes(listing.material))
    .filter((listing) => selections.selectedPatterns.length === 0 || selections.selectedPatterns.includes(listing.pattern))
    .filter((listing) => selections.selectedPrimaryColors.length === 0 || selections.selectedPrimaryColors.includes(listing.primaryColor))
    .filter((listing) => {
      if (selections.selectedCountryOrigins.length === 0) {
        return true;
      }

      const buyerFacingCountryOfOrigin = listing.countryOfOrigin === "unknown" ? "other" : listing.countryOfOrigin;
      return selections.selectedCountryOrigins.includes(buyerFacingCountryOfOrigin);
    })
    .filter((listing) => selections.selectedConditions.length === 0 || selections.selectedConditions.includes(listing.condition))
    .filter((listing) => selections.selectedFabricWeights.length === 0 || selections.selectedFabricWeights.includes(listing.fabricWeight))
    .filter((listing) => selections.selectedFabricTypes.length === 0 || selections.selectedFabricTypes.includes(listing.fabricType))
    .filter((listing) => selections.selectedVintage.length === 0 || selections.selectedVintage.includes(listing.vintage))
    .filter((listing) => selections.selectedReturnsAccepted.length === 0 || selections.selectedReturnsAccepted.includes(listing.returnsAccepted ? "yes" : "no"))
    .filter((listing) => selections.selectedAllowOffers.length === 0 || selections.selectedAllowOffers.includes(listing.allowOffers ? "yes" : "no"))
    .filter((listing) => {
      const minPrice = numberFilterValue(filters.minPrice);
      const maxPrice = numberFilterValue(filters.maxPrice);
      if (minPrice !== null && listing.price < minPrice) {
        return false;
      }
      if (maxPrice !== null && listing.price > maxPrice) {
        return false;
      }
      return true;
    })
    .filter((listing) => matchesJacketFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => matchesShirtFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => matchesSweaterFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => matchesWaistcoatFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => matchesTrouserFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => matchesCoatFilters(listing, filters, buyerProfile, selections.useProfileMeasurements, useExactMeasurementFiltering))
    .filter((listing) => {
      if (!useFlexibleMeasurementFiltering || !buyerProfile) {
        return true;
      }

      const fit = getFitRecommendation(buyerProfile, listing);
      return fit.status === "strong_match" || fit.status === "workable_with_tailoring";
    });

  const listings = [...filteredListings].sort((left, right) => {
    if (sortBy === "price_low") {
      return left.price - right.price;
    }

    if (sortBy === "price_high") {
      return right.price - left.price;
    }

    if (sortBy === "oldest") {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }

    if (sortBy === "newest") {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (sortBy === "recommended") {
      const leftSignals = buildSearchRankingSignals(left, rankingContext);
      const rightSignals = buildSearchRankingSignals(right, rankingContext);
      if (leftSignals.finalRecommendedScore !== rightSignals.finalRecommendedScore) {
        return rightSignals.finalRecommendedScore - leftSignals.finalRecommendedScore;
      }

      if (leftSignals.freshnessScore !== rightSignals.freshnessScore) {
        return rightSignals.freshnessScore - leftSignals.freshnessScore;
      }
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  if (process.env.NODE_ENV === "development" && sortBy === "recommended") {
    console.debug(
      "TailorGraph marketplace ranking",
      listings.map((listing) => ({
        listingId: listing.id,
        title: listing.title,
        ...buildSearchRankingSignals(listing, rankingContext)
      }))
    );
  }

  const activeFilterCount =
    [
      selections.selectedCategories,
      selections.selectedSizeLabels,
      selections.selectedSizeLabelPartOne,
      selections.selectedSizeLabelPartTwo,
      selections.selectedMaterials,
      selections.selectedPatterns,
      selections.selectedPrimaryColors,
      selections.selectedCountryOrigins,
      selections.selectedConditions,
      selections.selectedFabricWeights,
      selections.selectedFabricTypes,
      selections.selectedVintage,
      selections.selectedReturnsAccepted,
      selections.selectedAllowOffers,
      selections.selectedJacketCuts,
      selections.selectedJacketLapels,
      selections.selectedJacketButtonStyles,
      selections.selectedJacketVentStyles,
      selections.selectedJacketCanvas,
      selections.selectedJacketLining,
      selections.selectedJacketFormal,
      selections.selectedShirtCollarStyles,
      selections.selectedShirtCuffStyles,
      selections.selectedShirtPlackets,
      selections.selectedWaistcoatCuts,
      selections.selectedWaistcoatLapels,
      selections.selectedWaistcoatFormal,
      selections.selectedTrouserCuts,
      selections.selectedTrouserFronts,
      selections.selectedTrouserFormal,
      selections.selectedCoatCuts,
      selections.selectedCoatLapels,
      selections.selectedCoatButtonStyles,
      selections.selectedCoatVentStyles,
      selections.selectedCoatCanvas,
      selections.selectedCoatLining,
      selections.selectedCoatFormal
    ].filter((values) => values.length > 0).length +
    ((selections.selectedIncludedBrandIds.length > 0 || selections.selectedExcludedBrandIds.length > 0) ? 1 : 0) +
    (selections.keywordQuery ? 1 : 0) +
    ["minPrice", "maxPrice"].filter((key) => firstValue(filters[key])).length +
    ((useExactMeasurementFiltering && hasStructuredMeasurementFilters(filters)) ? 1 : 0);

  return {
    listings,
    activeFilterCount,
    totalListings: listings.length,
    ...selections,
    sortBy
  };
}

export default async function MarketplacePage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const filters = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();
  const cartIds = await getCartIds();
  const authError = displaySearchParam(filters.authError);
  const cartAdded = firstValue(filters.cartAdded);
  const saved = firstValue(filters.saved);
  const activeSavedSearchId = firstValue(filters.savedSearchId);
  const stripeEnabled = isStripeConfigured();
  const isAdmin = isAdminUser(user);
  const databaseReady = isDatabaseConfigured();
  const useProfileMeasurements = firstValue(filters.useProfile) === "yes";
  const fitMode = fitModeValue(filters);
  const sortBy = firstValue(filters.sort) || "recommended";
  const keywordQuery = normalizeSearchQuery(filters.q);
  const selectedCategories = hasNoCategoriesSelected(filters) ? ["__none__"] : selectedCategoryValues(filters);
  const selectedSizeLabels = allValues(filters.sizeLabel);
  const selectedIncludedBrandIds = allValues(filters.includeBrandId);
  const selectedExcludedBrandIds = allValues(filters.excludeBrandId);
  const sizeLabelPartOne = firstValue(filters.sizeLabelPartOne) || "";
  const sizeLabelPartTwo = firstValue(filters.sizeLabelPartTwo) || "";
  const selectedMaterials = allValues(filters.material);
  const selectedPatterns = allValues(filters.pattern);
  const selectedPrimaryColors = allValues(filters.primaryColor);
  const selectedCountryOrigins = allValues(filters.countryOfOrigin);
  const selectedConditions = allValues(filters.condition);
  const selectedFabricWeights = allValues(filters.fabricWeight);
  const selectedFabricTypes = allValues(filters.fabricType);
  const selectedVintage = allValues(filters.vintage);
  const selectedReturnsAccepted = allValues(filters.returnsAccepted);
  const selectedAllowOffers = allValues(filters.allowOffers);
  const selectedJacketCuts = allValues(filters.jacketCut);
  const selectedJacketLapels = allValues(filters.jacketLapel);
  const selectedJacketButtonStyles = allValues(filters.jacketButtonStyle);
  const selectedJacketVentStyles = allValues(filters.jacketVentStyle);
  const selectedJacketCanvas = allValues(filters.jacketCanvas);
  const selectedJacketLining = allValues(filters.jacketLining);
  const selectedJacketFormal = allValues(filters.jacketFormal);
  const selectedWaistcoatCuts = allValues(filters.waistcoatCut);
  const selectedWaistcoatLapels = allValues(filters.waistcoatLapel);
  const selectedWaistcoatFormal = allValues(filters.waistcoatFormal);
  const selectedTrouserCuts = allValues(filters.trouserCut);
  const selectedTrouserFronts = allValues(filters.trouserFront);
  const selectedTrouserFormal = allValues(filters.trouserFormal);
  const selectedCoatCuts = allValues(filters.coatCut);
  const selectedCoatLapels = allValues(filters.coatLapel);
  const selectedCoatButtonStyles = allValues(filters.coatButtonStyle);
  const selectedCoatVentStyles = allValues(filters.coatVentStyle);
  const selectedCoatCanvas = allValues(filters.coatCanvas);
  const selectedCoatLining = allValues(filters.coatLining);
  const selectedCoatFormal = allValues(filters.coatFormal);

  const marketplace = await listMarketplace();
  const savedListingIds = new Set(user ? (await listSavedListingsForUser(user.id)).map((listing) => listing.id) : []);
  const savedSearches = user ? await listSavedSearchesForUser(user.id) : [];
  const marketplaceResults = filterAndSortMarketplaceListings({
    sourceListings: marketplace,
    filters,
    buyerProfile: user?.buyerProfile,
    defaultSort: "recommended"
  });
  const currentPage = positivePageValue(filters.page);
  const totalPages = Math.max(1, Math.ceil(marketplaceResults.totalListings / MARKETPLACE_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * MARKETPLACE_PAGE_SIZE;
  const listings = marketplaceResults.listings.slice(pageStart, pageStart + MARKETPLACE_PAGE_SIZE);
  const currentSearchQueryString = new URLSearchParams(
    Object.entries(filters).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.filter(Boolean).map((item) => [key, item] as [string, string])
        : value
          ? [[key, value] as [string, string]]
          : []
    )
  );
  currentSearchQueryString.delete("page");
  currentSearchQueryString.delete("savedSearchId");

  return (
    <AppShell>
      <PageWrap>
        {authError ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
        {cartAdded ? (
          <div
            className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
              cartAdded === "existing" ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"
            }`}
          >
            <span>{cartAdded === "existing" ? "Item already in cart." : "Item added to cart."}</span>
            <Link
              href="/cart"
              className={`rounded-full bg-white px-3 py-1 text-xs font-semibold transition ${
                cartAdded === "existing"
                  ? "border border-rose-300 text-rose-900 hover:border-rose-500"
                  : "border border-emerald-300 text-emerald-900 hover:border-emerald-500"
              }`}
            >
              View Cart
            </Link>
          </div>
        ) : null}
        <section className="relative -mt-6 pb-0 pt-0">
            <div className="px-0">
              <div
                className="marketplace-context-bar rounded-b-[1.75rem] border-t-0 px-1 pb-2 pt-4"
                style={{ background: "transparent", border: "0", boxShadow: "none" }}
              >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="editorial mt-2 text-[1.8rem] font-semibold leading-tight text-stone-950 sm:text-[2rem]">
                      TailorGraph Marketplace
                    </h1>
                    <div className="editorial mt-2 max-w-4xl text-sm leading-6 text-stone-700 sm:text-[0.98rem]">
                      <p>Use your measurements to find garments that actually fit.</p>
                      <p className="mt-3">
                        <Link href="/how-to-use" className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-500">
                        Learn how TailorGraph works
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {isAdmin ? (
                      <Link href="/admin" className="font-medium text-stone-700 transition hover:text-stone-950">
                        Admin
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {saved && saved !== "saved-search" ? (
              <p className="rounded-lg bg-emerald-100 px-4 py-2 text-sm text-emerald-900">
                {saved === "password-reset" ? "Password reset successfully. You can log in with your new password." : `Saved ${saved}.`}
              </p>
            ) : null}
            {!databaseReady ? (
              <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900">
                Hosted database not configured yet. Add `DATABASE_URL` to enable signups, listings, orders, and payments.
              </p>
            ) : null}
          </div>
        </section>

        <section className="marketplace-main-pane -mt-3 pt-2">
          <div className="grid gap-8 px-5 pb-5 xl:grid-cols-[0.7fr_1.3fr] xl:px-6 xl:pb-6">
            <aside className="marketplace-tool-panel h-fit self-start rounded-[0.9rem] p-5 pb-4">
              <div>
                <h2 className="editorial text-2xl font-semibold text-stone-950">Filter by Fit, Measurements, and Garment Details</h2>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  Search TailorGraph by garment attributes, exact measurements, or profile-based fit preferences.
                </p>
              </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Start with category, measurement ranges, or garment details like fabric, pattern, and condition to narrow the field intelligently.
            </p>
            <form className="mt-5 grid gap-4">
              <MarketplaceFilterSidebar
                userHasProfile={Boolean(user)}
                buyerProfile={user?.buyerProfile}
                selectedCategories={selectedCategories}
                selectedSizeLabels={selectedSizeLabels}
                sizeLabelPartOne={sizeLabelPartOne}
                sizeLabelPartTwo={sizeLabelPartTwo}
                categoryOptions={categoryOptions}
                selectedIncludedBrandIds={selectedIncludedBrandIds}
                selectedExcludedBrandIds={selectedExcludedBrandIds}
                selectedMaterials={selectedMaterials}
                 materialOptions={materialOptions}
                 shirtMaterialOptions={shirtMaterialOptions}
                 sweaterMaterialOptions={sweaterMaterialOptions}
                 sweaterKnitTypeOptions={sweaterKnitTypeOptions}
                 selectedPatterns={selectedPatterns}
                 patternOptions={patternOptions}
                 shirtPatternOptions={shirtPatternOptions}
                 sweaterPatternOptions={sweaterPatternOptions}
                selectedPrimaryColors={selectedPrimaryColors}
                primaryColorOptions={primaryColorOptions}
                selectedCountryOrigins={selectedCountryOrigins}
                countryOfOriginOptions={countryOfOriginOptions}
                selectedFabricTypes={selectedFabricTypes}
                fabricTypeOptions={fabricTypeOptions}
                shirtClothTypeOptions={shirtClothTypeOptions}
                selectedFabricWeights={selectedFabricWeights}
                fabricWeightOptions={fabricWeightOptions}
                selectedConditions={selectedConditions}
                conditionOptions={conditionOptions}
                selectedVintage={selectedVintage}
                selectedReturnsAccepted={selectedReturnsAccepted}
                selectedAllowOffers={selectedAllowOffers}
                yesNoOptions={yesNoAnyOptions}
                vintageOptions={vintageEraOptions}
                breastedCutOptions={breastedCutOptions}
                lapelOptions={lapelOptions}
                waistcoatLapelOptions={waistcoatLapelOptions}
                jacketButtonStyleOptions={jacketButtonStyleOptions}
                ventStyleOptions={ventStyleOptions}
                 shirtCollarStyleOptions={shirtCollarStyleOptions}
                 shirtCuffStyleOptions={shirtCuffStyleOptions}
                 shirtPlacketOptions={shirtPlacketOptions}
                 sweaterNecklineOptions={sweaterNecklineOptions}
                 sweaterClosureOptions={sweaterClosureOptions}
                 canvasOptions={canvasOptions}
                liningOptions={liningOptions}
                formalOptions={formalOptions}
                trouserCutOptions={trouserCutOptions}
                trouserFrontOptions={trouserFrontOptions}
                selectedJacketCuts={selectedJacketCuts}
                selectedJacketLapels={selectedJacketLapels}
                selectedJacketButtonStyles={selectedJacketButtonStyles}
                selectedJacketVentStyles={selectedJacketVentStyles}
                selectedJacketCanvas={selectedJacketCanvas}
                selectedJacketLining={selectedJacketLining}
                selectedJacketFormal={selectedJacketFormal}
                 selectedShirtCollarStyles={marketplaceResults.selectedShirtCollarStyles}
                 selectedShirtCuffStyles={marketplaceResults.selectedShirtCuffStyles}
                 selectedShirtPlackets={marketplaceResults.selectedShirtPlackets}
                 selectedSweaterNecklines={marketplaceResults.selectedSweaterNecklines}
                 selectedSweaterClosures={marketplaceResults.selectedSweaterClosures}
                 selectedWaistcoatCuts={selectedWaistcoatCuts}
                selectedWaistcoatLapels={selectedWaistcoatLapels}
                selectedWaistcoatFormal={selectedWaistcoatFormal}
                selectedTrouserCuts={selectedTrouserCuts}
                selectedTrouserFronts={selectedTrouserFronts}
                selectedTrouserFormal={selectedTrouserFormal}
                selectedCoatCuts={selectedCoatCuts}
                selectedCoatLapels={selectedCoatLapels}
                selectedCoatButtonStyles={selectedCoatButtonStyles}
                selectedCoatVentStyles={selectedCoatVentStyles}
                selectedCoatCanvas={selectedCoatCanvas}
                selectedCoatLining={selectedCoatLining}
                selectedCoatFormal={selectedCoatFormal}
                keywordQuery={keywordQuery}
                minPrice={firstValue(filters.minPrice) || ""}
                maxPrice={firstValue(filters.maxPrice) || ""}
                fitMode={fitMode}
                useProfileMeasurements={useProfileMeasurements}
                jacketChestMin={firstValue(filters.jacketChestMin) || ""}
                jacketChestMax={firstValue(filters.jacketChestMax) || ""}
                jacketWaistMin={firstValue(filters.jacketWaistMin) || ""}
                jacketWaistMax={firstValue(filters.jacketWaistMax) || ""}
                jacketShouldersMin={firstValue(filters.jacketShouldersMin) || ""}
                jacketShouldersMax={firstValue(filters.jacketShouldersMax) || ""}
                jacketBodyLengthMin={firstValue(filters.jacketBodyLengthMin) || ""}
                jacketBodyLengthMax={firstValue(filters.jacketBodyLengthMax) || ""}
                jacketArmLengthMin={firstValue(filters.jacketArmLengthMin) || ""}
                jacketArmLengthMax={firstValue(filters.jacketArmLengthMax) || ""}
                jacketArmLengthIncludeAllowance={includeAllowanceEnabled(filters.jacketArmLengthIncludeAllowance)}
                shirtNeckMin={firstValue(filters.shirtNeckMin) || ""}
                shirtNeckMax={firstValue(filters.shirtNeckMax) || ""}
                shirtChestMin={firstValue(filters.shirtChestMin) || ""}
                shirtChestMax={firstValue(filters.shirtChestMax) || ""}
                shirtWaistMin={firstValue(filters.shirtWaistMin) || ""}
                shirtWaistMax={firstValue(filters.shirtWaistMax) || ""}
                shirtShouldersMin={firstValue(filters.shirtShouldersMin) || ""}
                shirtShouldersMax={firstValue(filters.shirtShouldersMax) || ""}
                shirtBodyLengthMin={firstValue(filters.shirtBodyLengthMin) || ""}
                shirtBodyLengthMax={firstValue(filters.shirtBodyLengthMax) || ""}
                shirtArmLengthMin={firstValue(filters.shirtArmLengthMin) || ""}
                shirtArmLengthMax={firstValue(filters.shirtArmLengthMax) || ""}
                sweaterChestMin={firstValue(filters.sweaterChestMin) || ""}
                sweaterChestMax={firstValue(filters.sweaterChestMax) || ""}
                sweaterWaistMin={firstValue(filters.sweaterWaistMin) || ""}
                sweaterWaistMax={firstValue(filters.sweaterWaistMax) || ""}
                sweaterShouldersMin={firstValue(filters.sweaterShouldersMin) || ""}
                sweaterShouldersMax={firstValue(filters.sweaterShouldersMax) || ""}
                sweaterBodyLengthMin={firstValue(filters.sweaterBodyLengthMin) || ""}
                sweaterBodyLengthMax={firstValue(filters.sweaterBodyLengthMax) || ""}
                sweaterArmLengthMin={firstValue(filters.sweaterArmLengthMin) || ""}
                sweaterArmLengthMax={firstValue(filters.sweaterArmLengthMax) || ""}
                waistcoatChestMin={firstValue(filters.waistcoatChestMin) || ""}
                waistcoatChestMax={firstValue(filters.waistcoatChestMax) || ""}
                waistcoatWaistMin={firstValue(filters.waistcoatWaistMin) || ""}
                waistcoatWaistMax={firstValue(filters.waistcoatWaistMax) || ""}
                waistcoatShouldersMin={firstValue(filters.waistcoatShouldersMin) || ""}
                waistcoatShouldersMax={firstValue(filters.waistcoatShouldersMax) || ""}
                waistcoatBodyLengthMin={firstValue(filters.waistcoatBodyLengthMin) || ""}
                waistcoatBodyLengthMax={firstValue(filters.waistcoatBodyLengthMax) || ""}
                trouserWaistMin={firstValue(filters.trouserWaistMin) || ""}
                trouserWaistMax={firstValue(filters.trouserWaistMax) || ""}
                trouserHipsMin={firstValue(filters.trouserHipsMin) || ""}
                trouserHipsMax={firstValue(filters.trouserHipsMax) || ""}
                trouserInseamMin={firstValue(filters.trouserInseamMin) || ""}
                trouserInseamMax={firstValue(filters.trouserInseamMax) || ""}
                trouserOutseamMin={firstValue(filters.trouserOutseamMin) || ""}
                trouserOutseamMax={firstValue(filters.trouserOutseamMax) || ""}
                trouserOpeningMin={firstValue(filters.trouserOpeningMin) || ""}
                trouserOpeningMax={firstValue(filters.trouserOpeningMax) || ""}
                trouserWaistIncludeAllowance={includeAllowanceEnabled(filters.trouserWaistIncludeAllowance)}
                trouserLengthIncludeAllowance={
                  includeAllowanceEnabled(filters.trouserInseamIncludeAllowance) ||
                  includeAllowanceEnabled(filters.trouserOutseamIncludeAllowance)
                }
                coatChestMin={firstValue(filters.coatChestMin) || ""}
                coatChestMax={firstValue(filters.coatChestMax) || ""}
                coatWaistMin={firstValue(filters.coatWaistMin) || ""}
                coatWaistMax={firstValue(filters.coatWaistMax) || ""}
                coatShouldersMin={firstValue(filters.coatShouldersMin) || ""}
                coatShouldersMax={firstValue(filters.coatShouldersMax) || ""}
                coatBodyLengthMin={firstValue(filters.coatBodyLengthMin) || ""}
                coatBodyLengthMax={firstValue(filters.coatBodyLengthMax) || ""}
                coatArmLengthMin={firstValue(filters.coatArmLengthMin) || ""}
                coatArmLengthMax={firstValue(filters.coatArmLengthMax) || ""}
                coatArmLengthIncludeAllowance={includeAllowanceEnabled(filters.coatArmLengthIncludeAllowance)}
              />

                  {user ? (
                    <MarketplaceSavedSearchActions
                      activeSavedSearchId={activeSavedSearchId}
                      initialSerializedQuery={currentSearchQueryString.toString()}
                      savedSearches={savedSearches.map((savedSearch) => ({
                        id: savedSearch.id,
                        queryString: savedSearch.queryString
                      }))}
                    />
                  ) : (
                      <div className="flex flex-wrap gap-3">
                      <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">Search</button>
                        <Link href="/marketplace" className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
                          Reset
                        </Link>
                      </div>
                  )}
                </form>
              </aside>

          <div className="flex flex-col gap-6 xl:border-l xl:border-stone-300/70 xl:pl-8">
            <div className="marketplace-results-bar flex flex-col gap-3 px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
                <span className="text-sm font-semibold text-stone-900">
                  {marketplaceResults.totalListings} {marketplaceResults.totalListings === 1 ? "listing" : "listings"}
                </span>
                {marketplaceResults.activeFilterCount ? (
                  <span className="text-sm text-stone-500">
                    {marketplaceResults.activeFilterCount}{" "}
                    {marketplaceResults.activeFilterCount === 1 ? "Filter Set Active" : "Filter Sets Active"}
                  </span>
                ) : null}
              </div>
              <MarketplaceSortControl
                currentSort={sortBy}
                hiddenFields={Object.entries(filters)
                  .filter(([key]) => key !== "sort" && key !== "page")
                  .flatMap(([key, value]) =>
                    Array.isArray(value)
                      ? value.map((item) => ({ key, value: item }))
                      : value
                        ? [{ key, value }]
                        : []
                  )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {listings.length ? (
                listings.map((listing) => {
                  const heroMedia = listing.media[0];

                  return (
                    <article key={listing.id} className="marketplace-card relative flex h-full flex-col rounded-[1.35rem] p-4">
                      <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
                      <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1rem] bg-stone-100 ring-1 ring-black/4">
                        <div className="aspect-[4/5] w-full">
                          {heroMedia ? (
                            heroMedia.kind === "video" ? (
                              <video src={heroMedia.url} controls className="h-full w-full object-cover" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={heroMedia.url} alt={listing.title} className="h-full w-full object-cover" />
                            )
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-stone-500">Media will appear here</div>
                          )}
                        </div>
                        <div className="pointer-events-auto absolute right-3 top-3 z-20">
                          {user ? (
                            <form action={toggleSaveListingAction}>
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="returnTo" value={`/marketplace?${new URLSearchParams(Object.entries(filters).flatMap(([key, value]) => Array.isArray(value) ? value.filter(Boolean).map((item) => [key, item] as [string, string]) : value ? [[key, value] as [string, string]] : [])).toString()}`} />
                              <button
                                className={`inline-flex min-h-[2.1rem] items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  savedListingIds.has(listing.id)
                                  ? "border border-emerald-300 bg-emerald-100 text-emerald-900"
                                    : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                                }`}
                              >
                                {savedListingIds.has(listing.id) ? "Saved" : "Save Item"}
                              </button>
                            </form>
                          ) : (
                            <Link
                              href="/login?authError=Log+in+or+create+an+account+to+save+items"
                              className="inline-flex min-h-[2.1rem] items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-950 hover:text-stone-950"
                            >
                              Save Item
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="pointer-events-none relative z-10 mt-4 flex flex-1 flex-col">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-deep)]">
                          <span className="uppercase">{formatDisplayValue(listing.category)}</span>
                          <span> - {formatListingSizeLabel(listing.sizeLabel, listing.category) || "No size listed"}</span>
                        </p>
                            <h2 className="mt-2.5 line-clamp-2 text-[1.05rem] font-semibold leading-[1.28] text-stone-950">{listing.title}</h2>
                            <p className="mt-1 text-sm italic text-stone-600">{listing.brand || "Unbranded"}</p>
                            <p className="mt-1.5 text-sm text-stone-500">
                              <Link href={`/users/${listing.sellerDisplayName}`} className="pointer-events-auto transition hover:text-stone-950">
                                @{listing.sellerDisplayName}
                              </Link>
                            </p>
                        <p className="mt-4 text-[1.65rem] font-semibold tracking-[-0.01em] text-stone-950">${listing.price.toFixed(2)}</p>
                      </div>

                      <div className="relative z-20 mt-4 grid gap-2">
                        <form action={buyNowAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/marketplace?${new URLSearchParams(
                              Object.entries(filters).flatMap(([key, value]) =>
                                Array.isArray(value)
                                  ? value.filter(Boolean).map((item) => [key, item] as [string, string])
                                  : value
                                    ? [[key, value] as [string, string]]
                                    : []
                              )
                            ).toString()}`}
                          />
                          <button className="h-11 w-full rounded-xl bg-[var(--accent)] px-3 text-center text-[13px] font-semibold leading-tight text-white">
                            Purchase
                          </button>
                        </form>
                        <div className={`grid gap-2 ${listing.allowOffers ? "grid-cols-2" : "grid-cols-[1fr_auto]"}`}>
                          {listing.allowOffers ? (
                            <Link href={`/listings/${listing.id}?intent=offer`} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-amber-300 bg-white px-2 text-center text-[13px] font-semibold leading-tight text-amber-900">
                              Make Offer
                            </Link>
                          ) : null}
                          <form action={addToCartAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/marketplace?${new URLSearchParams(
                              Object.entries(filters).flatMap(([key, value]) =>
                                Array.isArray(value)
                                  ? value.filter(Boolean).map((item) => [key, item] as [string, string])
                                  : value
                                    ? [[key, value] as [string, string]]
                                    : []
                              )
                            ).toString()}`}
                          />
                          <button className="h-10 w-full rounded-xl border border-stone-300 bg-white px-2 text-center text-[13px] font-medium leading-tight text-stone-800">
                            Add to Cart
                          </button>
                        </form>
                          {!listing.allowOffers ? (
                            <Link href={`/listings/${listing.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-3 text-center text-[13px] font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950">
                              View Item
                            </Link>
                          ) : null}
                        </div>
                        {listing.allowOffers ? (
                          <Link href={`/listings/${listing.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-3 text-center text-[13px] font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950">
                            View Item
                          </Link>
                        ) : (
                          null
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <article className="rounded-[0.9rem] border border-dashed border-stone-300 px-6 py-10 text-center text-sm text-stone-600">
                  No listings match the current filters. Adjust the measurements or reset the marketplace filters to widen the feed.
                </article>
              )}
            </div>
            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, index) => {
                  const page = index + 1;
                  const params = new URLSearchParams();
                  Object.entries(filters).forEach(([key, value]) => {
                    if (key === "page") {
                      return;
                    }

                    if (Array.isArray(value)) {
                      value.forEach((item) => {
                        if (item) {
                          params.append(key, item);
                        }
                      });
                      return;
                    }

                    if (value) {
                      params.set(key, value);
                    }
                  });
                  if (page > 1) {
                    params.set("page", String(page));
                  }

                  return (
                    <Link
                      key={page}
                      href={`/marketplace?${params.toString()}`}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        page === safePage
                          ? "bg-[var(--anchor)] text-white"
                          : "border border-stone-300 bg-white text-stone-800 hover:border-stone-950"
                      }`}
                    >
                      {page}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}

