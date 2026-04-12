import Link from "next/link";
import { redirect } from "next/navigation";
import { addToCartAction, buyNowAction, toggleFollowUserAction, toggleSaveListingAction } from "@/app/actions";
import {
  breastedCutOptions,
  canvasOptions,
  categoryOptions,
  conditionOptions,
  countryOfOriginOptions,
  fabricTypeOptions,
  fabricWeightOptions,
  filterAndSortMarketplaceListings,
  firstValue,
  formalOptions,
  jacketButtonStyleOptions,
  lapelOptions,
  liningOptions,
  materialOptions,
  shirtMaterialOptions,
  sweaterMaterialOptions,
  sweaterClosureOptions,
  sweaterKnitTypeOptions,
  sweaterNecklineOptions,
  sweaterPatternOptions,
  positivePageValue,
  patternOptions,
  primaryColorOptions,
  shirtClothTypeOptions,
  shirtPatternOptions,
  shirtCollarStyleOptions,
  shirtCuffStyleOptions,
  shirtPlacketOptions,
  trouserCutOptions,
  trouserFrontOptions,
  ventStyleOptions,
  vintageEraOptions,
  waistcoatLapelOptions,
  yesNoAnyOptions
} from "@/app/marketplace/page";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { MarketplaceSortControl } from "@/components/marketplace-sort-control";
import { AppShell, PageWrap } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDisplayValue, formatListingSizeLabel, formatSizeLabel } from "@/lib/display";
import {
  ensureSeedData,
  findUserByUsername,
  getSellerReviewScores,
  getUserFollowCounts,
  isFollowingUser,
  listActiveListingsBySellerId,
  listSavedListingsForUser,
  listSoldListingsBySellerId
} from "@/lib/store";
import type { User } from "@/lib/types";
const PROFILE_MARKETPLACE_PAGE_SIZE = 24;

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function displaySearchParam(value: string | string[] | undefined) {
  const raw = firstValue(value);
  return raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : "";
}

function getPublicDisplayName(user: User) {
  const names = [];

  if (user.showPersonalNameOnProfile) {
    names.push(user.name);
  }

  if (user.showBusinessNameOnProfile && user.businessName) {
    names.push(user.businessName);
  }

  return names.join(" / ");
}

function getPublicLocation(user: User) {
  if (user.publicLocationMode === "hidden") {
    return "";
  }

  const rawLocation = user.sellerLocation || user.buyerProfile.location;
  if (!rawLocation) {
    return "";
  }

  const [city = "", state = ""] = rawLocation.split(",").map((part) => part.trim());
  const country = "United States";

  if (user.publicLocationMode === "country") {
    return country;
  }

  if (user.publicLocationMode === "state_country") {
    return state ? `${state}, ${country}` : country;
  }

  return city && state ? `${city}, ${state}, ${country}` : rawLocation;
}

function formatSellerScore(score: number | null) {
  return score === null ? "Not Yet Rated" : `${score.toFixed(2)} / 5`;
}

function formatSellerScoreValue(score: number | null) {
  return score === null ? "Not Yet Rated" : score.toFixed(2);
}

function SellerScoreDisplay({
  score,
  dark = false,
  emphasize = false
}: {
  score: number | null;
  dark?: boolean;
  emphasize?: boolean;
}) {
  if (score === null) {
    return <p className={`${emphasize ? "text-base font-semibold" : "text-sm"} ${dark ? "text-stone-200" : "text-stone-700"}`}>Not Yet Rated</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <span
            key={value}
            className={`${emphasize ? "text-[1.35rem]" : "text-xl"} leading-none ${score >= value ? "text-amber-400" : dark ? "text-stone-600" : "text-stone-300"}`}
          >
            ★
          </span>
        ))}
      </div>
      <p className={`${emphasize ? "text-base font-semibold" : "text-sm"} ${dark ? "text-stone-50" : "text-stone-700"}`}>{score.toFixed(2)}</p>
    </div>
  );
}

export default async function UserProfilePage({
  params,
  searchParams
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  await ensureSeedData();

  const viewer = await getCurrentUser();
  const user = await findUserByUsername(username);

  if (!user) {
    redirect("/users");
  }

  const [activeListings, soldListings, sellerScores, followCounts] = await Promise.all([
    listActiveListingsBySellerId(user.id),
    listSoldListingsBySellerId(user.id),
    getSellerReviewScores(user.id),
    getUserFollowCounts(user.id)
  ]);
  const savedListingIds = new Set(viewer ? (await listSavedListingsForUser(viewer.id)).map((listing) => listing.id) : []);
  const isFollowing =
    viewer && viewer.id !== user.id ? await isFollowingUser(viewer.id, user.id) : false;
  const publicDisplayName = getPublicDisplayName(user);
  const publicLocation = getPublicLocation(user);
  const profileDescription = user.profileDescription || "User has not added a description.";
  const hasSellerProfileData = activeListings.length > 0 || soldListings.length > 0;
  const source = Array.isArray(resolvedSearchParams.from)
    ? resolvedSearchParams.from[0]
    : resolvedSearchParams.from;
  const listingId = Array.isArray(resolvedSearchParams.listingId)
    ? resolvedSearchParams.listingId[0]
    : resolvedSearchParams.listingId;
  const isOwnProfile = viewer?.id === user.id;
  const topRightHref = isOwnProfile
    ? "/account/profile"
    : source === "listing" && listingId
      ? `/listings/${listingId}`
      : source === "messages"
        ? "/messages"
        : "/";
  const topRightLabel = isOwnProfile
    ? "Edit Profile"
    : source === "listing" && listingId
      ? "Back to Item"
      : source === "messages"
      ? "Back to Messages"
      : "Back to Marketplace";
  const returnTo = `/users/${user.username}${source === "listing" && listingId ? `?from=listing&listingId=${listingId}` : source === "messages" ? "?from=messages" : ""}`;
  const resetHref = `/users/${user.username}${source === "listing" && listingId ? `?from=listing&listingId=${listingId}` : source === "messages" ? "?from=messages" : ""}`;
  const guestInteractionHref =
    "/login?authError=Log+in+or+create+an+account+to+message+or+save+users";
  const authError = displaySearchParam(resolvedSearchParams.authError);
  const cartAdded = Array.isArray(resolvedSearchParams.cartAdded)
    ? resolvedSearchParams.cartAdded[0]
    : resolvedSearchParams.cartAdded;
  const profileMarketplace = filterAndSortMarketplaceListings({
    sourceListings: activeListings,
    filters: resolvedSearchParams,
    buyerProfile: viewer?.buyerProfile
  });
  const currentPage = positivePageValue(resolvedSearchParams.page);
  const totalPages = Math.max(1, Math.ceil(profileMarketplace.totalListings / PROFILE_MARKETPLACE_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedListings = profileMarketplace.listings.slice(
    (safePage - 1) * PROFILE_MARKETPLACE_PAGE_SIZE,
    safePage * PROFILE_MARKETPLACE_PAGE_SIZE
  );

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-7xl">
        {authError ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          {cartAdded ? (
            <div
              className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Public Profile</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold text-stone-950">@{user.username}</h1>
                {!isOwnProfile ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={viewer ? `/messages?compose=1&to=${user.username}` : guestInteractionHref}
                      className="inline-flex items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Message User
                    </Link>
                    {viewer ? (
                      <form action={toggleFollowUserAction}>
                        <input type="hidden" name="username" value={user.username} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button
                          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                            isFollowing
                              ? "border border-emerald-300 bg-emerald-100 text-emerald-900"
                              : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                          }`}
                        >
                          {isFollowing ? "Saved User" : "Save User"}
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={guestInteractionHref}
                        className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                      >
                        Save User
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
              {publicDisplayName ? <p className="mt-3 text-lg font-medium text-stone-700">{publicDisplayName}</p> : null}
            </div>
            <Link
              href={topRightHref}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              {topRightLabel}
            </Link>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-stone-300 bg-white p-5">
            <div className="mb-3 min-h-[2rem]">
              <h2 className="text-2xl font-semibold text-stone-950">User Information</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Location</p>
                <p className="mt-2 text-base font-semibold text-stone-950">{publicLocation || "Not Public"}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Member Since</p>
                <p className="mt-2 text-base font-semibold text-stone-950">{formatMemberSince(user.createdAt)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Followed By</p>
                <p className="mt-2 text-base font-semibold text-stone-950">{followCounts.followerCount}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Following</p>
                <p className="mt-2 text-base font-semibold text-stone-950">{followCounts.followingCount}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-stone-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Description</p>
              <p className="mt-2 text-sm leading-7 text-stone-700">
                {profileDescription}
              </p>
            </div>

            {hasSellerProfileData ? (
              <div className="mt-5">
                <div className="mb-3 flex min-h-[2rem] items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold text-stone-950">Seller Information</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Active Listings</p>
                    <p className="mt-2 text-base font-semibold text-stone-950">{activeListings.length}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Sold Listings</p>
                    <p className="mt-2 text-base font-semibold text-stone-950">{soldListings.length}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-stone-950 px-5 py-4 text-stone-50">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-stone-300">Overall Seller Score</p>
                  <div className="mt-3 px-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SellerScoreDisplay score={sellerScores.overallScore} dark emphasize />
                      <p className="text-sm text-stone-300">
                        {sellerScores.reviewCount} review{sellerScores.reviewCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2.5">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-700 bg-stone-900/40 px-4 py-2.5">
                      <p className="text-sm font-medium text-stone-200">Measurement Accuracy</p>
                      <SellerScoreDisplay score={sellerScores.measurementAccuracyScore} dark />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-700 bg-stone-900/40 px-4 py-2.5">
                      <p className="text-sm font-medium text-stone-200">Condition Accuracy</p>
                      <SellerScoreDisplay score={sellerScores.conditionAccuracyScore} dark />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-700 bg-stone-900/40 px-4 py-2.5">
                      <p className="text-sm font-medium text-stone-200">Shipping Speed and Handling</p>
                      <SellerScoreDisplay score={sellerScores.shippingSpeedHandlingScore} dark />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-700 bg-stone-900/40 px-4 py-2.5">
                      <p className="text-sm font-medium text-stone-200">Communication</p>
                      <SellerScoreDisplay score={sellerScores.communicationScore} dark />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {activeListings.length ? (
          <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
              <aside className="panel h-fit self-start rounded-[1.75rem] p-6 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Filters</p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-950">Refine This Profile</h2>
                  <p className="mt-3 text-sm leading-6 text-stone-700">
                    Search only within @{user.username}&apos;s active listings by keyword, measurements, and garment attributes.
                  </p>
                </div>
                <form className="mt-5 grid gap-4">
                  {source ? <input type="hidden" name="from" value={source} /> : null}
                  {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
                  <MarketplaceFilterSidebar
                    userHasProfile={Boolean(viewer)}
                    buyerProfile={viewer?.buyerProfile}
                    selectedCategories={profileMarketplace.selectedCategories}
                    selectedSizeLabels={profileMarketplace.selectedSizeLabels}
                    sizeLabelPartOne={profileMarketplace.selectedSizeLabelPartOne}
                    sizeLabelPartTwo={profileMarketplace.selectedSizeLabelPartTwo}
                    categoryOptions={categoryOptions}
                    selectedIncludedBrandIds={profileMarketplace.selectedIncludedBrandIds}
                    selectedExcludedBrandIds={profileMarketplace.selectedExcludedBrandIds}
                    selectedMaterials={profileMarketplace.selectedMaterials}
                    materialOptions={materialOptions}
                    shirtMaterialOptions={shirtMaterialOptions}
                    sweaterMaterialOptions={sweaterMaterialOptions}
                    sweaterKnitTypeOptions={sweaterKnitTypeOptions}
                    selectedPatterns={profileMarketplace.selectedPatterns}
                    patternOptions={patternOptions}
                    shirtPatternOptions={shirtPatternOptions}
                    sweaterPatternOptions={sweaterPatternOptions}
                    selectedPrimaryColors={profileMarketplace.selectedPrimaryColors}
                    primaryColorOptions={primaryColorOptions}
                    selectedCountryOrigins={profileMarketplace.selectedCountryOrigins}
                    countryOfOriginOptions={countryOfOriginOptions}
                    selectedFabricTypes={profileMarketplace.selectedFabricTypes}
                    fabricTypeOptions={fabricTypeOptions}
                    shirtClothTypeOptions={shirtClothTypeOptions}
                    selectedFabricWeights={profileMarketplace.selectedFabricWeights}
                    fabricWeightOptions={fabricWeightOptions}
                    selectedConditions={profileMarketplace.selectedConditions}
                    conditionOptions={conditionOptions}
                    selectedVintage={profileMarketplace.selectedVintage}
                    vintageOptions={vintageEraOptions}
                    selectedReturnsAccepted={profileMarketplace.selectedReturnsAccepted}
                    selectedAllowOffers={profileMarketplace.selectedAllowOffers}
                    yesNoOptions={yesNoAnyOptions}
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
                    selectedJacketCuts={profileMarketplace.selectedJacketCuts}
                    selectedJacketLapels={profileMarketplace.selectedJacketLapels}
                    selectedJacketButtonStyles={profileMarketplace.selectedJacketButtonStyles}
                    selectedJacketVentStyles={profileMarketplace.selectedJacketVentStyles}
                    selectedJacketCanvas={profileMarketplace.selectedJacketCanvas}
                    selectedJacketLining={profileMarketplace.selectedJacketLining}
                    selectedJacketFormal={profileMarketplace.selectedJacketFormal}
                    selectedShirtCollarStyles={profileMarketplace.selectedShirtCollarStyles}
                    selectedShirtCuffStyles={profileMarketplace.selectedShirtCuffStyles}
                    selectedShirtPlackets={profileMarketplace.selectedShirtPlackets}
                    selectedSweaterNecklines={profileMarketplace.selectedSweaterNecklines}
                    selectedSweaterClosures={profileMarketplace.selectedSweaterClosures}
                    selectedWaistcoatCuts={profileMarketplace.selectedWaistcoatCuts}
                    selectedWaistcoatLapels={profileMarketplace.selectedWaistcoatLapels}
                    selectedWaistcoatFormal={profileMarketplace.selectedWaistcoatFormal}
                    selectedTrouserCuts={profileMarketplace.selectedTrouserCuts}
                    selectedTrouserFronts={profileMarketplace.selectedTrouserFronts}
                    selectedTrouserFormal={profileMarketplace.selectedTrouserFormal}
                    selectedCoatCuts={profileMarketplace.selectedCoatCuts}
                    selectedCoatLapels={profileMarketplace.selectedCoatLapels}
                    selectedCoatButtonStyles={profileMarketplace.selectedCoatButtonStyles}
                    selectedCoatVentStyles={profileMarketplace.selectedCoatVentStyles}
                    selectedCoatCanvas={profileMarketplace.selectedCoatCanvas}
                    selectedCoatLining={profileMarketplace.selectedCoatLining}
                    selectedCoatFormal={profileMarketplace.selectedCoatFormal}
                     keywordQuery={profileMarketplace.keywordQuery}
                     minPrice={firstValue(resolvedSearchParams.minPrice) || ""}
                     maxPrice={firstValue(resolvedSearchParams.maxPrice) || ""}
                     fitMode={profileMarketplace.fitMode}
                     useProfileMeasurements={profileMarketplace.useProfileMeasurements}
                    jacketChestMin={firstValue(resolvedSearchParams.jacketChestMin) || ""}
                    jacketChestMax={firstValue(resolvedSearchParams.jacketChestMax) || ""}
                    jacketWaistMin={firstValue(resolvedSearchParams.jacketWaistMin) || ""}
                    jacketWaistMax={firstValue(resolvedSearchParams.jacketWaistMax) || ""}
                    jacketShouldersMin={firstValue(resolvedSearchParams.jacketShouldersMin) || ""}
                    jacketShouldersMax={firstValue(resolvedSearchParams.jacketShouldersMax) || ""}
                    jacketBodyLengthMin={firstValue(resolvedSearchParams.jacketBodyLengthMin) || ""}
                    jacketBodyLengthMax={firstValue(resolvedSearchParams.jacketBodyLengthMax) || ""}
                    jacketArmLengthMin={firstValue(resolvedSearchParams.jacketArmLengthMin) || ""}
                jacketArmLengthMax={firstValue(resolvedSearchParams.jacketArmLengthMax) || ""}
                jacketArmLengthIncludeAllowance={firstValue(resolvedSearchParams.jacketArmLengthIncludeAllowance) === "yes"}
                shirtNeckMin={firstValue(resolvedSearchParams.shirtNeckMin) || ""}
                shirtNeckMax={firstValue(resolvedSearchParams.shirtNeckMax) || ""}
                shirtChestMin={firstValue(resolvedSearchParams.shirtChestMin) || ""}
                shirtChestMax={firstValue(resolvedSearchParams.shirtChestMax) || ""}
                    shirtWaistMin={firstValue(resolvedSearchParams.shirtWaistMin) || ""}
                    shirtWaistMax={firstValue(resolvedSearchParams.shirtWaistMax) || ""}
                    shirtShouldersMin={firstValue(resolvedSearchParams.shirtShouldersMin) || ""}
                    shirtShouldersMax={firstValue(resolvedSearchParams.shirtShouldersMax) || ""}
                    shirtBodyLengthMin={firstValue(resolvedSearchParams.shirtBodyLengthMin) || ""}
                shirtBodyLengthMax={firstValue(resolvedSearchParams.shirtBodyLengthMax) || ""}
                shirtArmLengthMin={firstValue(resolvedSearchParams.shirtArmLengthMin) || ""}
                shirtArmLengthMax={firstValue(resolvedSearchParams.shirtArmLengthMax) || ""}
                sweaterChestMin={firstValue(resolvedSearchParams.sweaterChestMin) || ""}
                sweaterChestMax={firstValue(resolvedSearchParams.sweaterChestMax) || ""}
                sweaterWaistMin={firstValue(resolvedSearchParams.sweaterWaistMin) || ""}
                sweaterWaistMax={firstValue(resolvedSearchParams.sweaterWaistMax) || ""}
                sweaterShouldersMin={firstValue(resolvedSearchParams.sweaterShouldersMin) || ""}
                sweaterShouldersMax={firstValue(resolvedSearchParams.sweaterShouldersMax) || ""}
                sweaterBodyLengthMin={firstValue(resolvedSearchParams.sweaterBodyLengthMin) || ""}
                sweaterBodyLengthMax={firstValue(resolvedSearchParams.sweaterBodyLengthMax) || ""}
                sweaterArmLengthMin={firstValue(resolvedSearchParams.sweaterArmLengthMin) || ""}
                sweaterArmLengthMax={firstValue(resolvedSearchParams.sweaterArmLengthMax) || ""}
                waistcoatChestMin={firstValue(resolvedSearchParams.waistcoatChestMin) || ""}
                    waistcoatChestMax={firstValue(resolvedSearchParams.waistcoatChestMax) || ""}
                    waistcoatWaistMin={firstValue(resolvedSearchParams.waistcoatWaistMin) || ""}
                    waistcoatWaistMax={firstValue(resolvedSearchParams.waistcoatWaistMax) || ""}
                    waistcoatShouldersMin={firstValue(resolvedSearchParams.waistcoatShouldersMin) || ""}
                    waistcoatShouldersMax={firstValue(resolvedSearchParams.waistcoatShouldersMax) || ""}
                    waistcoatBodyLengthMin={firstValue(resolvedSearchParams.waistcoatBodyLengthMin) || ""}
                    waistcoatBodyLengthMax={firstValue(resolvedSearchParams.waistcoatBodyLengthMax) || ""}
                    trouserWaistMin={firstValue(resolvedSearchParams.trouserWaistMin) || ""}
                    trouserWaistMax={firstValue(resolvedSearchParams.trouserWaistMax) || ""}
                    trouserHipsMin={firstValue(resolvedSearchParams.trouserHipsMin) || ""}
                    trouserHipsMax={firstValue(resolvedSearchParams.trouserHipsMax) || ""}
                    trouserInseamMin={firstValue(resolvedSearchParams.trouserInseamMin) || ""}
                    trouserInseamMax={firstValue(resolvedSearchParams.trouserInseamMax) || ""}
                    trouserOutseamMin={firstValue(resolvedSearchParams.trouserOutseamMin) || ""}
                    trouserOutseamMax={firstValue(resolvedSearchParams.trouserOutseamMax) || ""}
                    trouserOpeningMin={firstValue(resolvedSearchParams.trouserOpeningMin) || ""}
                    trouserOpeningMax={firstValue(resolvedSearchParams.trouserOpeningMax) || ""}
                    trouserWaistIncludeAllowance={firstValue(resolvedSearchParams.trouserWaistIncludeAllowance) === "yes"}
                    trouserLengthIncludeAllowance={
                      firstValue(resolvedSearchParams.trouserInseamIncludeAllowance) === "yes" ||
                      firstValue(resolvedSearchParams.trouserOutseamIncludeAllowance) === "yes"
                    }
                    coatChestMin={firstValue(resolvedSearchParams.coatChestMin) || ""}
                    coatChestMax={firstValue(resolvedSearchParams.coatChestMax) || ""}
                    coatWaistMin={firstValue(resolvedSearchParams.coatWaistMin) || ""}
                    coatWaistMax={firstValue(resolvedSearchParams.coatWaistMax) || ""}
                    coatShouldersMin={firstValue(resolvedSearchParams.coatShouldersMin) || ""}
                    coatShouldersMax={firstValue(resolvedSearchParams.coatShouldersMax) || ""}
                    coatBodyLengthMin={firstValue(resolvedSearchParams.coatBodyLengthMin) || ""}
                    coatBodyLengthMax={firstValue(resolvedSearchParams.coatBodyLengthMax) || ""}
                    coatArmLengthMin={firstValue(resolvedSearchParams.coatArmLengthMin) || ""}
                    coatArmLengthMax={firstValue(resolvedSearchParams.coatArmLengthMax) || ""}
                    coatArmLengthIncludeAllowance={firstValue(resolvedSearchParams.coatArmLengthIncludeAllowance) === "yes"}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
                    <Link href={resetHref} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800">
                      Reset
                    </Link>
                  </div>
                </form>
              </aside>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 rounded-[1.5rem] bg-white/70 p-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3 text-sm text-stone-600">
                    <span className="rounded-full bg-stone-100 px-3 py-2 font-semibold text-stone-900">
                      {profileMarketplace.totalListings} Listings
                    </span>
                    {profileMarketplace.activeFilterCount ? (
                      <span className="rounded-full bg-stone-100 px-3 py-2">{profileMarketplace.activeFilterCount} Filter Sets Active</span>
                    ) : null}
                  </div>
                  <MarketplaceSortControl
                    currentSort={profileMarketplace.sortBy}
                    hiddenFields={Object.entries(resolvedSearchParams)
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
                  {paginatedListings.length ? (
                    paginatedListings.map((listing) => {
                      const heroMedia = listing.media[0];

                      return (
                        <article key={listing.id} className="panel relative flex h-full flex-col rounded-[1.75rem] p-4">
                          <Link href={`/listings/${listing.id}?from=profile&username=${user.username}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
                          <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1.25rem] bg-stone-100">
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
                              {viewer ? (
                                <form action={toggleSaveListingAction}>
                                  <input type="hidden" name="listingId" value={listing.id} />
                                  <input type="hidden" name="returnTo" value={`/users/${user.username}?${new URLSearchParams(Object.entries(resolvedSearchParams).flatMap(([key, value]) => Array.isArray(value) ? value.filter(Boolean).map((item) => [key, item] as [string, string]) : value ? [[key, value] as [string, string]] : [])).toString()}`} />
                                  <button
                                    className={`inline-flex min-h-[2.2rem] items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
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
                                  className="inline-flex min-h-[2.2rem] items-center justify-center rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-950 hover:text-stone-950"
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
                            <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-stone-950">{listing.title}</h2>
                            <p className="mt-1 text-sm italic text-stone-600">{listing.brand || "Unbranded"}</p>
                            <p className="mt-2 text-sm text-stone-600">
                              <Link href={`/users/${user.username}`} className="pointer-events-auto transition hover:text-stone-950">
                                @{user.username}
                              </Link>
                            </p>
                            <p className="mt-4 text-2xl font-semibold text-stone-950">${listing.price.toFixed(2)}</p>
                          </div>

                          <div className="relative z-20 mt-4 grid grid-cols-2 gap-2">
                            <Link href={`/listings/${listing.id}?from=profile&username=${user.username}`} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-stone-950 px-2 text-center text-[13px] font-semibold leading-tight text-white">
                              View Item
                            </Link>
                            <form action={addToCartAction}>
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input
                                type="hidden"
                                name="returnTo"
                                value={`/users/${user.username}?${new URLSearchParams(
                                  Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
                                    Array.isArray(value)
                                      ? value.filter(Boolean).map((item) => [key, item] as [string, string])
                                      : value
                                        ? [[key, value] as [string, string]]
                                        : []
                                  )
                                ).toString()}`}
                              />
                              <button className="h-11 w-full rounded-full border border-stone-300 bg-white px-2 text-center text-[13px] font-semibold leading-tight text-stone-800">
                                Add to Cart
                              </button>
                            </form>
                            <form action={buyNowAction}>
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input
                                type="hidden"
                                name="returnTo"
                                value={`/users/${user.username}?${new URLSearchParams(
                                  Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
                                    Array.isArray(value)
                                      ? value.filter(Boolean).map((item) => [key, item] as [string, string])
                                      : value
                                        ? [[key, value] as [string, string]]
                                        : []
                                  )
                                ).toString()}`}
                              />
                              <button className="h-11 w-full rounded-full bg-[var(--accent)] px-2 text-center text-[13px] font-semibold leading-tight text-white">
                                Purchase
                              </button>
                            </form>
                            {listing.allowOffers ? (
                              <Link href={`/listings/${listing.id}?intent=offer`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-2 text-center text-[13px] font-semibold leading-tight text-amber-900">
                                Make Offer
                              </Link>
                            ) : (
                              <div />
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <article className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-600">
                      No listings match the current filters for this profile.
                    </article>
                  )}
                </div>
                {totalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;
                      const params = new URLSearchParams();
                      Object.entries(resolvedSearchParams).forEach(([key, value]) => {
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
                          href={`/users/${user.username}?${params.toString()}`}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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
          </section>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white px-4 py-8 text-sm text-stone-600">
            No active listings yet.
          </div>
        )}
      </PageWrap>
    </AppShell>
  );
}
