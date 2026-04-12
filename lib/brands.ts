import brandData from "./brand-data.json" with { type: "json" };

export type CanonicalBrand = {
  id: string;
  displayName: string;
};

export type CanonicalBrandSuggestion = {
  brandId: string;
  displayName: string;
  score: number;
  matchType:
    | "canonical_exact"
    | "alias_exact"
    | "canonical_prefix"
    | "alias_prefix"
    | "canonical_substring"
    | "alias_substring"
    | "fuzzy";
  matchedAcceptedTerm?: string;
};

type BrandRecord = CanonicalBrand & {
  aliases: string[];
};

type BrandDataRow = {
  displayName: string;
  aliases: string[];
};

type BrandMatchMethod = "canonical_exact" | "alias_exact" | "freeform";
type AcceptedTermMatchType =
  | "canonical_exact"
  | "alias_exact"
  | "canonical_prefix"
  | "alias_prefix"
  | "canonical_substring"
  | "alias_substring"
  | "fuzzy";

type AcceptedBrandTerm = {
  text: string;
  matchType: "canonical" | "alias";
  canonicalBrand: CanonicalBrand;
  normalized: string;
  compactNormalized: string;
};

const fallbackBrandDisplayNames = new Set(["Other Bespoke", "Other Brand", "Unbranded"]);

export type ResolvedBrandInput = {
  canonicalBrand: CanonicalBrand | null;
  storedBrand: string;
  rawInput: string;
  matchMethod: BrandMatchMethod;
};

function slugifyBrandId(displayName: string) {
  return normalizeBrandText(displayName).replace(/\s+/g, "-");
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeApostrophes(value: string) {
  return value
    .replace(/[’‘‛`´]/g, "'")
    .replace(/[“”]/g, "\"");
}

export function normalizeBrandText(input: string) {
  const normalized = normalizeApostrophes(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, " ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1");
}

function compactBrandText(input: string) {
  return normalizeBrandText(input).replace(/\s+/g, "");
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function fuzzyDistanceThreshold(value: string) {
  if (value.length <= 4) {
    return 1;
  }

  if (value.length <= 8) {
    return 2;
  }

  return 3;
}

const brandRecords = (brandData as BrandDataRow[]).map((row) => ({
  id: slugifyBrandId(row.displayName),
  displayName: row.displayName,
  aliases: dedupeStrings(row.aliases ?? [])
})) satisfies BrandRecord[];

const canonicalById = new Map(brandRecords.map((brand) => [brand.id, { id: brand.id, displayName: brand.displayName } satisfies CanonicalBrand]));
const exactBrandMatches = new Map<string, CanonicalBrand>();
const acceptedBrandTerms: AcceptedBrandTerm[] = [];
brandRecords.forEach((brand) => {
  const canonical = canonicalById.get(brand.id)!;
  const searchTerms = dedupeStrings([brand.displayName, ...brand.aliases]);

  for (const searchTerm of searchTerms) {
    const normalized = normalizeBrandText(searchTerm);
    if (normalized && !exactBrandMatches.has(normalized)) {
      exactBrandMatches.set(normalized, canonical);
    }

    acceptedBrandTerms.push({
      text: searchTerm,
      matchType: searchTerm === brand.displayName ? "canonical" : "alias",
      canonicalBrand: canonical,
      normalized,
      compactNormalized: compactBrandText(searchTerm)
    });
  }
});

export const canonicalBrands = brandRecords
  .map((brand) => canonicalById.get(brand.id)!)
  .sort((left, right) => brandDisplaySort(left.displayName, right.displayName));

export function getCanonicalBrandById(brandId: string) {
  return canonicalById.get(brandId) ?? null;
}

export function resolveBrand(input: string) {
  const normalized = normalizeBrandText(input);
  if (!normalized) {
    return null;
  }

  return exactBrandMatches.get(normalized) ?? null;
}

function buildAcceptedTermMatch(term: AcceptedBrandTerm, query: string, compactQuery: string) {
  if (!query) {
    return null;
  }

  if (term.normalized === query || term.compactNormalized === compactQuery) {
    const matchType: AcceptedTermMatchType = term.matchType === "canonical" ? "canonical_exact" : "alias_exact";
    return { term, score: 0, matchType };
  }

  if (term.normalized.startsWith(query) || term.compactNormalized.startsWith(compactQuery)) {
    const matchType: AcceptedTermMatchType = term.matchType === "canonical" ? "canonical_prefix" : "alias_prefix";
    return { term, score: 1, matchType };
  }

  if (term.normalized.includes(query) || term.compactNormalized.includes(compactQuery)) {
    const matchType: AcceptedTermMatchType = term.matchType === "canonical" ? "canonical_substring" : "alias_substring";
    return { term, score: 2, matchType };
  }

  const distance = Math.min(
    levenshteinDistance(term.normalized, query),
    levenshteinDistance(term.compactNormalized, compactQuery)
  );
  const threshold = Math.max(fuzzyDistanceThreshold(query), fuzzyDistanceThreshold(compactQuery));

  if (distance <= threshold) {
    return {
      term,
      score: 10 + distance,
      matchType: "fuzzy" as const
    };
  }

  return null;
}

function matchPriority(matchType: AcceptedTermMatchType) {
  switch (matchType) {
    case "canonical_exact":
      return 0;
    case "alias_exact":
      return 1;
    case "canonical_prefix":
      return 2;
    case "alias_prefix":
      return 3;
    case "canonical_substring":
      return 4;
    case "alias_substring":
      return 5;
    case "fuzzy":
      return 6;
    default:
      return 7;
  }
}

function brandDisplaySort(left: string, right: string) {
  const leftIsFallback = fallbackBrandDisplayNames.has(left);
  const rightIsFallback = fallbackBrandDisplayNames.has(right);

  if (leftIsFallback && !rightIsFallback) {
    return 1;
  }

  if (!leftIsFallback && rightIsFallback) {
    return -1;
  }

  return left.localeCompare(right);
}

export function searchBrandSuggestions(query: string, limit = 12) {
  const normalized = normalizeBrandText(query);
  const compactNormalized = compactBrandText(query);

  if (!normalized) {
    return canonicalBrands.slice(0, limit).map((brand) => ({
      brandId: brand.id,
      displayName: brand.displayName,
      score: 1000,
      matchType: "canonical_prefix" as const
    }));
  }

  const deduped = new Map<string, CanonicalBrandSuggestion>();

  for (const term of acceptedBrandTerms) {
    const match = buildAcceptedTermMatch(term, normalized, compactNormalized);
    if (!match) {
      continue;
    }

    const current = deduped.get(term.canonicalBrand.id);
    const suggestion: CanonicalBrandSuggestion = {
      brandId: term.canonicalBrand.id,
      displayName: term.canonicalBrand.displayName,
      score: match.score,
      matchType: match.matchType,
      matchedAcceptedTerm: term.text
    };

    if (
      !current ||
      matchPriority(suggestion.matchType) < matchPriority(current.matchType) ||
      (matchPriority(suggestion.matchType) === matchPriority(current.matchType) && suggestion.score < current.score)
    ) {
      deduped.set(term.canonicalBrand.id, suggestion);
    }
  }

    return Array.from(deduped.values())
      .sort((left, right) => {
        return (
          matchPriority(left.matchType) - matchPriority(right.matchType) ||
          left.score - right.score ||
          brandDisplaySort(left.displayName, right.displayName)
        );
      })
    .slice(0, limit);
}

export function searchBrands(query: string, limit = 12) {
  return searchBrandSuggestions(query, limit).map((suggestion) => ({
    id: suggestion.brandId,
    displayName: suggestion.displayName
  }));
}

export function resolveListingBrandInput(selectedBrandValue: string, rawInputValue: string) {
  const selectedMatch = resolveBrand(selectedBrandValue);
  if (selectedMatch) {
    return {
      canonicalBrand: selectedMatch,
      storedBrand: selectedMatch.displayName,
      rawInput: rawInputValue.trim() || selectedMatch.displayName,
      matchMethod: "canonical_exact"
    } satisfies ResolvedBrandInput;
  }

  const rawMatch = resolveBrand(rawInputValue);
  if (rawMatch) {
    const rawNormalized = normalizeBrandText(rawInputValue);
    const canonicalNormalized = normalizeBrandText(rawMatch.displayName);

    return {
      canonicalBrand: rawMatch,
      storedBrand: rawMatch.displayName,
      rawInput: rawInputValue.trim(),
      matchMethod: rawNormalized === canonicalNormalized ? "canonical_exact" : "alias_exact"
    } satisfies ResolvedBrandInput;
  }

  const trimmedRawInput = rawInputValue.trim();
  const topSuggestion = searchBrandSuggestions(rawInputValue, 1)[0];

  if (topSuggestion && topSuggestion.matchType === "fuzzy") {
    return {
      canonicalBrand: null,
      storedBrand: "",
      rawInput: trimmedRawInput,
      matchMethod: "freeform"
    } satisfies ResolvedBrandInput;
  }

  return {
    canonicalBrand: null,
    storedBrand: trimmedRawInput || selectedBrandValue.trim(),
    rawInput: trimmedRawInput,
    matchMethod: "freeform"
  } satisfies ResolvedBrandInput;
}

export function matchesBrandFilters(listingBrand: string, includeBrandIds: string[], excludeBrandIds: string[]) {
  if (includeBrandIds.includes("__none__")) {
    return false;
  }

  const resolvedBrand = resolveBrand(listingBrand);
  const canonicalBrandId = resolvedBrand?.id ?? null;

  if (includeBrandIds.length > 0 && (!canonicalBrandId || !includeBrandIds.includes(canonicalBrandId))) {
    return false;
  }

  if (excludeBrandIds.length > 0 && canonicalBrandId && excludeBrandIds.includes(canonicalBrandId)) {
    return false;
  }

  return true;
}
