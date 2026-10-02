import { ListingGallery } from "@/components/listing-gallery";
import Link from "next/link";
import {
  addToCartAction,
  buyNowAction,
  dismissMarketplaceIntroAction,
  logoutAction,
  toggleSaveListingAction
} from "@/app/actions";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { MarketplaceFilterPanel } from "@/components/marketplace-filter-panel";
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
import { categoryOptions, hasNoCategoriesSelected, selectedCategoryValues, fitModeValue, materialOptions, shirtMaterialOptions, sweaterMaterialOptions, sweaterKnitTypeOptions, patternOptions, shirtPatternOptions, primaryColorOptions, countryOfOriginOptions, conditionOptions, fabricWeightOptions, fabricTypeOptions, shirtClothTypeOptions, yesNoAnyOptions, vintageEraOptions, breastedCutOptions, lapelOptions, waistcoatLapelOptions, jacketButtonStyleOptions, ventStyleOptions, shirtCollarStyleOptions, shirtCuffStyleOptions, shirtPlacketOptions, sweaterNecklineOptions, sweaterClosureOptions, sweaterPatternOptions, canvasOptions, liningOptions, formalOptions, trouserCutOptions, trouserFrontOptions, firstValue, positivePageValue, allValues, normalizeSearchQuery, displaySearchParam, includeAllowanceEnabled, filterAndSortMarketplaceListings } from "@/lib/marketplace-search";

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
          <div className="grid min-w-0 grid-cols-1 gap-4 px-3 pb-4 sm:gap-8 sm:px-5 sm:pb-5 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] xl:px-6 xl:pb-6">
            <MarketplaceFilterPanel activeFilterCount={marketplaceResults.activeFilterCount}>
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
              </MarketplaceFilterPanel>

          <div className="flex min-w-0 flex-col gap-6 xl:border-l xl:border-stone-300/70 xl:pl-8">
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
                  return (
                    <article key={listing.id} className="marketplace-card relative flex h-full flex-col rounded-[1.35rem] p-4">
                      <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
                      <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1rem] bg-stone-100 ring-1 ring-black/4">
                        <div className="aspect-[4/5] w-full">
                          <ListingGallery media={listing.media} title={listing.title} variant="card" sizes="(max-width: 767px) calc(100vw - 64px), (max-width: 1279px) 45vw, 320px" />
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
