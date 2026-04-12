import countryData from "./country-data.json" with { type: "json" };

export type CanonicalCountry = {
  id: string;
  displayName: string;
};

type CountryDataRow = {
  id: string;
  displayName: string;
  aliases: string[];
};

type CountryTerm = {
  text: string;
  normalized: string;
  compactNormalized: string;
  canonicalCountry: CanonicalCountry;
  matchType: "canonical" | "alias";
};

export type CountrySuggestion = {
  countryId: string;
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
};

export type ResolvedCountryInput = {
  canonicalCountry: CanonicalCountry | null;
  storedCountry: string;
  rawInput: string;
};

function normalizeCountryText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[â€™â€˜â€›`Â´]/g, "'")
    .replace(/[â€œâ€]/g, "\"")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, " ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactCountryText(input: string) {
  return normalizeCountryText(input).replace(/\s+/g, "");
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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

function matchPriority(matchType: CountrySuggestion["matchType"]) {
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

const countryRecords = countryData as CountryDataRow[];
const sellerOnlyUnknownCountry: CanonicalCountry = { id: "unknown", displayName: "Unknown" };
const canonicalCountries = countryRecords.map((row) => ({ id: row.id, displayName: row.displayName } satisfies CanonicalCountry));
const sellerCountryOptions = [sellerOnlyUnknownCountry, ...canonicalCountries];
const countryById = new Map(sellerCountryOptions.map((country) => [country.id, country]));
const exactCountryMatches = new Map<string, CanonicalCountry>();
const countryTerms: CountryTerm[] = [];

for (const record of sellerCountryOptions) {
  const aliases = record.id === "unknown" ? [] : (countryRecords.find((row) => row.id === record.id)?.aliases ?? []);
  const terms = dedupeStrings([record.displayName, ...aliases]);

  for (const term of terms) {
    const normalized = normalizeCountryText(term);
    if (normalized && !exactCountryMatches.has(normalized)) {
      exactCountryMatches.set(normalized, record);
    }

    countryTerms.push({
      text: term,
      normalized,
      compactNormalized: compactCountryText(term),
      canonicalCountry: record,
      matchType: term === record.displayName ? "canonical" : "alias"
    });
  }
}

export const buyerCountryOptions: Array<[string, string]> = canonicalCountries.map((country) => [country.id, country.displayName]);
export const sellerCountryAutocompleteOptions = sellerCountryOptions;

export function getCountryById(countryId: string) {
  return countryById.get(countryId) ?? null;
}

export function getCountryDisplayName(countryId: string, audience: "buyer" | "seller" = "buyer") {
  if (countryId === "unknown" && audience === "buyer") {
    return "Other";
  }

  return getCountryById(countryId)?.displayName ?? countryId;
}

export function resolveCountry(input: string) {
  const normalized = normalizeCountryText(input);
  if (!normalized) {
    return null;
  }

  return exactCountryMatches.get(normalized) ?? null;
}

export function searchCountrySuggestions(query: string, limit = 12, audience: "buyer" | "seller" = "seller") {
  const normalized = normalizeCountryText(query);
  const compactNormalized = compactCountryText(query);
  const availableCountries = audience === "buyer" ? canonicalCountries : sellerCountryOptions;

  if (!normalized) {
    return availableCountries.slice(0, limit).map((country) => ({
      countryId: country.id,
      displayName: country.displayName,
      score: 1000,
      matchType: "canonical_prefix" as const
    }));
  }

  const allowedIds = new Set(availableCountries.map((country) => country.id));
  const deduped = new Map<string, CountrySuggestion>();

  for (const term of countryTerms) {
    if (!allowedIds.has(term.canonicalCountry.id)) {
      continue;
    }

    let match: { score: number; matchType: CountrySuggestion["matchType"] } | null = null;

    if (term.normalized === normalized || term.compactNormalized === compactNormalized) {
      match = { score: 0, matchType: term.matchType === "canonical" ? "canonical_exact" : "alias_exact" };
    } else if (term.normalized.startsWith(normalized) || term.compactNormalized.startsWith(compactNormalized)) {
      match = { score: 1, matchType: term.matchType === "canonical" ? "canonical_prefix" : "alias_prefix" };
    } else if (term.normalized.includes(normalized) || term.compactNormalized.includes(compactNormalized)) {
      match = { score: 2, matchType: term.matchType === "canonical" ? "canonical_substring" : "alias_substring" };
    } else {
      const distance = Math.min(
        levenshteinDistance(term.normalized, normalized),
        levenshteinDistance(term.compactNormalized, compactNormalized)
      );
      const threshold = Math.max(fuzzyDistanceThreshold(normalized), fuzzyDistanceThreshold(compactNormalized));

      if (distance <= threshold) {
        match = { score: 10 + distance, matchType: "fuzzy" };
      }
    }

    if (!match) {
      continue;
    }

    const current = deduped.get(term.canonicalCountry.id);
    const suggestion: CountrySuggestion = {
      countryId: term.canonicalCountry.id,
      displayName: term.canonicalCountry.displayName,
      score: match.score,
      matchType: match.matchType
    };

    if (
      !current ||
      matchPriority(suggestion.matchType) < matchPriority(current.matchType) ||
      (matchPriority(suggestion.matchType) === matchPriority(current.matchType) && suggestion.score < current.score)
    ) {
      deduped.set(term.canonicalCountry.id, suggestion);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      return (
        matchPriority(left.matchType) - matchPriority(right.matchType) ||
        left.score - right.score
      );
    })
    .slice(0, limit);
}

export function resolveListingCountryInput(selectedCountryValue: string, rawInputValue: string) {
  const selectedMatch = getCountryById(selectedCountryValue);
  if (selectedMatch) {
    return {
      canonicalCountry: selectedMatch,
      storedCountry: selectedMatch.id,
      rawInput: rawInputValue.trim() || selectedMatch.displayName
    } satisfies ResolvedCountryInput;
  }

  const rawMatch = resolveCountry(rawInputValue);
  if (rawMatch) {
    return {
      canonicalCountry: rawMatch,
      storedCountry: rawMatch.id,
      rawInput: rawInputValue.trim()
    } satisfies ResolvedCountryInput;
  }

  const topSuggestion = searchCountrySuggestions(rawInputValue, 1, "seller")[0];
  if (topSuggestion && topSuggestion.matchType === "fuzzy") {
    return {
      canonicalCountry: null,
      storedCountry: "",
      rawInput: rawInputValue.trim()
    } satisfies ResolvedCountryInput;
  }

  return {
    canonicalCountry: null,
    storedCountry: "",
    rawInput: rawInputValue.trim()
  } satisfies ResolvedCountryInput;
}
