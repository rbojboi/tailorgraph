import assert from "node:assert/strict";
import test from "node:test";
import { getCountryDisplayName, resolveCountry, resolveListingCountryInput, searchCountrySuggestions } from "./countries.ts";

test("resolves country aliases to canonical countries", () => {
  assert.equal(resolveCountry("P.R.C.")?.id, "china");
  assert.equal(resolveCountry("South Korea")?.id, "south_korea");
  assert.equal(resolveCountry("Dominican Republic")?.id, "dominican_republic");
});

test("fuzzy country suggestions surface canonical matches", () => {
  assert.equal(searchCountrySuggestions("Untied States", 1, "seller")[0]?.countryId, "united_states");
  assert.equal(searchCountrySuggestions("Czech Repubic", 1, "seller")[0]?.countryId, "czechia");
});

test("seller country resolution stores canonical ids", () => {
  assert.equal(resolveListingCountryInput("", "U.S.A.").storedCountry, "united_states");
  assert.equal(resolveListingCountryInput("unknown", "Unknown").storedCountry, "unknown");
});

test("buyer-facing unknown country display folds into other", () => {
  assert.equal(getCountryDisplayName("unknown", "buyer"), "Other");
  assert.equal(getCountryDisplayName("unknown", "seller"), "Unknown");
});
