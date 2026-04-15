import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesBrandFilters,
  normalizeBrandText,
  resolveBrand,
  resolveListingBrandInput,
  searchBrandSuggestions,
  searchBrands
} from "./brands";

test("resolves exact canonical brand matches", () => {
  assert.equal(resolveBrand("Burberry")?.displayName, "Burberry");
  assert.equal(resolveBrand("Other Brand")?.displayName, "Other Brand");
  assert.equal(resolveBrand("Other Bespoke")?.displayName, "Other Bespoke");
  assert.equal(resolveBrand("Unbranded")?.displayName, "Unbranded");
});

test("resolves aliases to canonical brands", () => {
  assert.equal(resolveBrand("Burberrys")?.displayName, "Burberry");
  assert.equal(resolveBrand("Polo Ralph Lauren")?.displayName, "Ralph Lauren");
  assert.equal(resolveBrand("Golden Fleece")?.displayName, "Brooks Brothers Golden Fleece");
  assert.equal(resolveBrand("Giorgio Armani Black Label")?.displayName, "Giorgio Armani");
  assert.equal(resolveBrand("Daniel Crémieux")?.displayName, "Crémieux");
});

test("normalizes apostrophes and punctuation for brand matching", () => {
  assert.equal(normalizeBrandText("Burberry's"), normalizeBrandText("Burberrys"));
  assert.equal(resolveBrand("Churchs")?.displayName, "Church's");
  assert.equal(normalizeBrandText("T. M. Lewin"), normalizeBrandText("TM Lewin"));
  assert.equal(normalizeBrandText("Anderson & Sheppard"), normalizeBrandText("Anderson and Sheppard"));
  assert.equal(searchBrandSuggestions("Double RL")[0]?.displayName, "R.R.L.");
});

test("seller brand resolution stores canonical brands from aliases", () => {
  const resolved = resolveListingBrandInput("", "Burberrys");
  assert.equal(resolved.storedBrand, "Burberry");
  assert.equal(resolved.matchMethod, "alias_exact");
});

test("seller raw typo input does not silently store a non-canonical fuzzy typo", () => {
  const resolved = resolveListingBrandInput("", "DubbleRL");
  assert.equal(resolved.storedBrand, "");
});

test("buyer include brand filters require canonical membership", () => {
  const includeBrandId = resolveBrand("Burberry")?.id;
  assert.ok(includeBrandId);
  assert.equal(matchesBrandFilters("Burberry", [includeBrandId], []), true);
  assert.equal(matchesBrandFilters("Canali", [includeBrandId], []), false);
});

test("buyer exclude brand filters remove canonical matches", () => {
  const excludeBrandId = resolveBrand("Burberry")?.id;
  assert.ok(excludeBrandId);
  assert.equal(matchesBrandFilters("Burberry", [], [excludeBrandId]), false);
  assert.equal(matchesBrandFilters("Canali", [], [excludeBrandId]), true);
});

test("buyer alias-based search surfaces canonical brand results", () => {
  const burberryResults = searchBrands("burberrys");
  const poloResults = searchBrands("polo");
  const goldenFleeceResults = searchBrands("golden fleece");

  assert.equal(burberryResults[0]?.displayName, "Burberry");
  assert.equal(poloResults[0]?.displayName, "Ralph Lauren");
  assert.equal(goldenFleeceResults[0]?.displayName, "Brooks Brothers Golden Fleece");
});

test("fuzzy misspellings surface the expected canonical suggestions", () => {
  assert.equal(searchBrandSuggestions("DubbleRL")[0]?.displayName, "R.R.L.");
  assert.equal(searchBrandSuggestions("Canalli")[0]?.displayName, "Canali");
  assert.equal(searchBrandSuggestions("Churchs")[0]?.displayName, "Church's");
  assert.equal(searchBrandSuggestions("Hartmarx")[0]?.displayName, "Hart Schaffner Marx");
});

test("alias exact beats fuzzy and deduplicates canonical suggestions", () => {
  const suggestions = searchBrandSuggestions("Polo Ralph Lauren");
  assert.equal(suggestions[0]?.displayName, "Ralph Lauren");
  assert.equal(suggestions[0]?.matchType, "alias_exact");
  assert.equal(suggestions.filter((suggestion) => suggestion.displayName === "Ralph Lauren").length, 1);
});

test("moss bros alias search resolves to canonical moss brothers", () => {
  assert.equal(searchBrandSuggestions("Moss Bros.")[0]?.displayName, "Moss Brothers");
});

test("second-word searches surface multi-word brands", () => {
  assert.equal(searchBrandSuggestions("Barbera")[0]?.displayName, "Luciano Barbera");
});
