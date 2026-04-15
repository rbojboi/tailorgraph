import Link from "next/link";
import { addToCartAction, buyNowAction, makeOfferAction, toggleSaveListingAction } from "@/app/actions";
import { ListingGallery } from "@/components/listing-gallery";
import { OfferAmountInput } from "@/components/offer-amount-input";
import { getCurrentUser } from "@/lib/auth";
import { getCountryDisplayName } from "@/lib/countries";
import { formatCurrency, formatDisplayValue, formatEraLabel, formatListingSizeLabel, formatSizeLabel } from "@/lib/display";
import { getFitRecommendation } from "@/lib/fit";
import { ensureSeedData, findBuyerOrderForListing, findListingById, findUserById, listSavedListingsForUser } from "@/lib/store";
import type { BuyerProfile } from "@/lib/types";

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value || " "}</p>
    </div>
  );
}

function DetailSection({
  title,
  fields
}: {
  title: string;
  fields: Array<{ label: string; value?: string }>;
}) {
  return (
    <section className="panel rounded-[1.75rem] p-6">
      <h2 className="text-2xl font-semibold text-stone-950">{title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <DetailField key={field.label} label={field.label} value={field.value} />
        ))}
      </div>
    </section>
  );
}

function addBusinessDays(startDate: Date, businessDays: number) {
  const date = new Date(startDate);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return date;
}

function formatEstimatedArrivalRange(startBusinessDays: number, endBusinessDays: number) {
  const now = new Date();
  const start = addBusinessDays(now, startBusinessDays);
  const end = addBusinessDays(now, endBusinessDays);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatBuyerMaterialValue(value: string) {
  return value === "unknown" ? "Other" : formatDisplayValue(value);
}

function displaySearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : "";
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

function fitStatusLabel(status: ReturnType<typeof getFitRecommendation>["status"]) {
  switch (status) {
    case "strong_match":
      return "Strong Match";
    case "workable_with_tailoring":
      return "Workable With Tailoring";
    case "risky_but_possible":
      return "Risky But Possible";
    case "not_recommended":
      return "Not Recommended";
  }
}

function fitStatusClass(status: ReturnType<typeof getFitRecommendation>["status"]) {
  switch (status) {
    case "strong_match":
      return "bg-emerald-100 text-emerald-900 border border-emerald-300";
    case "workable_with_tailoring":
      return "bg-sky-100 text-sky-900 border border-sky-300";
    case "risky_but_possible":
      return "bg-orange-100 text-orange-900 border border-orange-300";
    case "not_recommended":
      return "bg-rose-100 text-rose-900 border border-rose-300";
  }
}

function confidenceLabel(confidence: ReturnType<typeof getFitRecommendation>["confidence"]) {
  switch (confidence) {
    case "high":
      return "High Confidence";
    case "medium":
      return "Medium Confidence";
    case "low":
      return "Low Confidence";
  }
}

function feasibilityLabel(feasibility: NonNullable<ReturnType<typeof getFitRecommendation>["alterationEstimate"]>["feasibility"]) {
  switch (feasibility) {
    case "easy":
      return "Straightforward";
    case "possible":
      return "Possible With Tailoring";
    case "risky":
      return "Complex";
    case "not_realistic":
      return "Untailorable";
  }
}

function measurementLabel(measurement: ReturnType<typeof getFitRecommendation>["assessments"][number]["measurement"]) {
  switch (measurement) {
    case "body_length":
      return "Body";
    case "sleeve_length":
      return "Sleeve";
    default:
      return formatDisplayValue(measurement);
  }
}

function garmentLabel(garment: ReturnType<typeof getFitRecommendation>["assessments"][number]["garment"]) {
  switch (garment) {
    case "trousers":
      return "Trouser";
    default:
      return formatDisplayValue(garment);
  }
}

function directionLabel(direction: ReturnType<typeof getFitRecommendation>["assessments"][number]["direction"]) {
  switch (direction) {
    case "too_small":
      return "Running Small";
    case "too_large":
      return "Running Large";
    case "close":
      return "Close";
    case "unknown":
      return "Unavailable";
  }
}

function severityLabel(severity: ReturnType<typeof getFitRecommendation>["assessments"][number]["severity"]) {
  switch (severity) {
    case "good":
      return "Good";
    case "minor_issue":
      return "Minor Fit Issue";
    case "moderate_issue":
      return "Moderate Fit Issue";
    case "major_issue":
      return "Major Fit Issue";
    case "unknown":
      return "Unavailable";
  }
}

function rangePositionLabel(position: ReturnType<typeof getFitRecommendation>["assessments"][number]["rangePosition"]) {
  switch (position) {
    case "ideal":
      return "Inside Ideal Range";
    case "acceptable":
      return "Inside Acceptable Range";
    case "outside_acceptable":
      return "Outside Acceptable Range";
    case "unknown":
      return "Unavailable";
  }
}

function tailoringRiskLabel(risk: ReturnType<typeof getFitRecommendation>["assessments"][number]["tailoringRisk"]) {
  switch (risk) {
    case "easy":
      return "Easy";
    case "moderate":
      return "Moderate";
    case "risky":
      return "Risky";
    case "not_realistic":
      return "Not Realistic";
    case "unknown":
      return "Unavailable";
  }
}

function tailoringOutcomeLabel(
  action: NonNullable<ReturnType<typeof getFitRecommendation>["alterationEstimate"]>["actions"][number]
) {
  if (action.feasibility === "not_realistic") {
    return feasibilityLabel(action.feasibility);
  }

  if (action.estimatedCost === null) {
    return feasibilityLabel(action.feasibility);
  }

  return `${feasibilityLabel(action.feasibility)} - Est. $${Math.round(action.estimatedCost)}`;
}

function tailoringActionBaseLabel(action: NonNullable<ReturnType<typeof getFitRecommendation>["alterationEstimate"]>["actions"][number]["type"]) {
  switch (action) {
    case "shorten_sleeves":
      return "Shorten Sleeves";
    case "lengthen_sleeves":
      return "Lengthen Sleeves";
        case "take_in_waist":
          return "Take In Waist";
        case "let_out_waist":
          return "Let Out Waist";
        case "adjust_chest":
          return "Adjust Chest";
        case "adjust_shoulders":
          return "Adjust Shoulders";
        case "take_in_hips":
          return "Take In Hips";
        case "let_out_hips":
          return "Let Out Hips";
        case "hem_trousers":
          return "Hem Trousers";
    case "lengthen_trousers":
      return "Lengthen Trousers";
    case "shorten_body":
      return "Shorten Body";
    case "fit_issue":
      return "Fit Issue";
    case "structural_shoulder_work":
      return "Structural Shoulder Work";
    case "structural_chest_issue":
      return "Structural Chest Issue";
  }
}

function tailoringActionLabel(
  action: NonNullable<ReturnType<typeof getFitRecommendation>["alterationEstimate"]>["actions"][number],
  includeGarment = false
) {
  if (action.type === "fit_issue") {
    const base = `${measurementLabel(
      action.measurement as ReturnType<typeof getFitRecommendation>["assessments"][number]["measurement"]
    )} Fit Issue`;
    return includeGarment ? `${garmentLabel(action.garment)} ${base}` : base;
  }

  const base = tailoringActionBaseLabel(action.type);
  return includeGarment ? `${garmentLabel(action.garment)} ${base}` : base;
}

function formatDisplayInches(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function tailoringAmountCopy(
  action: NonNullable<ReturnType<typeof getFitRecommendation>["alterationEstimate"]>["actions"][number],
  assessment?: ReturnType<typeof getFitRecommendation>["assessments"][number]
) {
  const measurement = action.measurement as ReturnType<typeof getFitRecommendation>["assessments"][number]["measurement"];
  if (!assessment || assessment.target === null || assessment.actual === null || action.amount === null) {
    return `Amount varies on ${measurementLabel(measurement).toLowerCase()}.`;
  }

  if (measurement === "chest" || measurement === "waist" || measurement === "hips") {
    return `Item ${formatDisplayInches(assessment.actual)} in. vs. target ${formatDisplayInches(assessment.target)} in. (${formatDisplayInches(action.amount * 2)} in. total adjustment needed).`;
  }

  return `Item ${formatDisplayInches(assessment.actual)} in. vs. target ${formatDisplayInches(assessment.target)} in. (${formatDisplayInches(action.amount)} in. adjustment needed).`;
}

export default async function ListingDetail({
  params,
  searchParams
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { listingId } = await params;
  const resolvedSearchParams = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();
  const listing = await findListingById(listingId);

  if (!listing) {
    return (
      <main className="px-4 py-8">
        <Link href="/">Back</Link>
      </main>
    );
  }

  const seller = await findUserById(listing.sellerId);
  const buyerOrder = user ? await findBuyerOrderForListing(user.id, listing.id) : null;
  const savedListingIds = new Set(user ? (await listSavedListingsForUser(user.id)).map((savedListing) => savedListing.id) : []);

  const buyerProfile = user?.buyerProfile;
  const canShowFitGuidance = hasSavedFitMeasurements(buyerProfile);
  const fit = buyerProfile && canShowFitGuidance ? getFitRecommendation(buyerProfile, listing) : null;

  const materialFields = [
    { label: listing.category === "sweater" ? "Material" : "Fabric", value: formatBuyerMaterialValue(listing.material) },
    { label: "Primary Color", value: formatDisplayValue(listing.primaryColor) },
    { label: "Pattern", value: formatDisplayValue(listing.pattern) },
    { label: listing.category === "sweater" ? "Knit Type" : "Cloth Type", value: formatDisplayValue(listing.fabricType) },
    { label: "Cloth Weight", value: formatDisplayValue(listing.fabricWeight) }
  ];

  const sections: Array<{ title: string; fields: Array<{ label: string; value?: string }> }> = [];

  if (listing.jacketMeasurements || listing.jacketSpecs) {
    sections.push({
      title:
        listing.category === "coat"
          ? "Coat Measurements and Specifications"
          : listing.category === "shirt"
            ? "Shirt Measurements and Specifications"
            : listing.category === "sweater"
              ? "Sweater Measurements and Specifications"
            : "Jacket Measurements and Specifications",
      fields: [
        ...(listing.category === "shirt"
          ? [{ label: "Neck", value: listing.jacketMeasurements?.neck ? `${listing.jacketMeasurements.neck}"` : "" }]
          : []),
        { label: "Chest", value: listing.jacketMeasurements?.chest ? `${listing.jacketMeasurements.chest}"` : "" },
        { label: "Waist", value: listing.jacketMeasurements?.waist ? `${listing.jacketMeasurements.waist}"` : "" },
        { label: "Shoulders", value: listing.jacketMeasurements?.shoulders ? `${listing.jacketMeasurements.shoulders}"` : "" },
        { label: "Body", value: listing.jacketMeasurements?.bodyLength ? `${listing.jacketMeasurements.bodyLength}"` : "" },
        ...(listing.category === "shirt" || listing.category === "sweater"
          ? [
              {
                label: "Sleeve",
                value: listing.jacketMeasurements?.sleeveLength ? `${listing.jacketMeasurements.sleeveLength}"` : ""
              }
            ]
          : [
              {
                label: "Sleeve (+ Allowance)",
                value: listing.jacketMeasurements?.sleeveLength
                  ? `${listing.jacketMeasurements.sleeveLength}"${listing.jacketMeasurements.sleeveLengthAllowance ? ` (+ ${listing.jacketMeasurements.sleeveLengthAllowance}")` : ""}`
                  : ""
              }
            ]),
        ...(listing.category === "shirt"
          ? [
              {
                label: "Collar Style",
                value: listing.shirtSpecs?.collarStyle ? formatDisplayValue(listing.shirtSpecs.collarStyle) : ""
              },
              {
                label: "Cuff Style",
                value: listing.shirtSpecs?.cuffStyle ? formatDisplayValue(listing.shirtSpecs.cuffStyle) : ""
              },
              {
                label: "Placket",
                value: listing.shirtSpecs?.placket ? formatDisplayValue(listing.shirtSpecs.placket) : ""
              }
            ]
          : listing.category === "sweater"
            ? [
                {
                  label: "Neckline",
                  value: listing.sweaterSpecs?.neckline ? formatDisplayValue(listing.sweaterSpecs.neckline) : ""
                },
                {
                  label: "Closure",
                  value: listing.sweaterSpecs?.closure ? formatDisplayValue(listing.sweaterSpecs.closure) : ""
                }
              ]
          : [
              { label: "Cut", value: listing.jacketSpecs?.cut ? formatDisplayValue(listing.jacketSpecs.cut) : "" },
              { label: "Lapel", value: listing.jacketSpecs?.lapel ? formatDisplayValue(listing.jacketSpecs.lapel) : "" },
              {
                label: "Button Style",
                value: listing.jacketSpecs?.buttonStyle ? formatDisplayValue(listing.jacketSpecs.buttonStyle) : ""
              },
              {
                label: "Vent Style",
                value: listing.jacketSpecs?.ventStyle ? formatDisplayValue(listing.jacketSpecs.ventStyle) : ""
              },
              { label: "Canvas", value: listing.jacketSpecs?.canvas ? formatDisplayValue(listing.jacketSpecs.canvas) : "" },
              { label: "Lining", value: listing.jacketSpecs?.lining ? formatDisplayValue(listing.jacketSpecs.lining) : "" },
              { label: "Formal", value: listing.jacketSpecs?.formal ? formatDisplayValue(listing.jacketSpecs.formal) : "" }
            ])
      ]
    });
  }

  if (listing.waistcoatMeasurements || listing.waistcoatSpecs) {
    sections.push({
      title: "Waistcoat Measurements and Specifications",
      fields: [
        { label: "Chest", value: listing.waistcoatMeasurements?.chest ? `${listing.waistcoatMeasurements.chest}"` : "" },
        { label: "Waist", value: listing.waistcoatMeasurements?.waist ? `${listing.waistcoatMeasurements.waist}"` : "" },
        { label: "Shoulders", value: listing.waistcoatMeasurements?.shoulders ? `${listing.waistcoatMeasurements.shoulders}"` : "" },
        { label: "Body", value: listing.waistcoatMeasurements?.bodyLength ? `${listing.waistcoatMeasurements.bodyLength}"` : "" },
        { label: "Cut", value: listing.waistcoatSpecs?.cut ? formatDisplayValue(listing.waistcoatSpecs.cut) : "" },
        { label: "Lapel", value: listing.waistcoatSpecs?.lapel ? formatDisplayValue(listing.waistcoatSpecs.lapel) : "" },
        { label: "Formal", value: listing.waistcoatSpecs?.formal ? formatDisplayValue(listing.waistcoatSpecs.formal) : "" }
      ]
    });
  }

  if (listing.trouserMeasurements || listing.trouserSpecs) {
    sections.push({
      title: "Trouser Measurements and Specifications",
      fields: [
        ...(listing.trouserSizeLabel ? [{ label: "Tagged Size", value: formatSizeLabel(listing.trouserSizeLabel) }] : []),
        {
          label: "Waist (+ Allowance)",
          value: listing.trouserMeasurements?.waist
            ? `${listing.trouserMeasurements.waist}"${listing.trouserMeasurements.waistAllowance ? ` (+ ${listing.trouserMeasurements.waistAllowance}")` : ""}`
            : ""
        },
        { label: "Hips", value: listing.trouserMeasurements?.hips ? `${listing.trouserMeasurements.hips}"` : "" },
        {
          label: "Inseam (+ Allowance)",
          value: listing.trouserMeasurements?.inseam
            ? `${listing.trouserMeasurements.inseam}"${listing.trouserMeasurements.inseamOutseamAllowance ? ` (+ ${listing.trouserMeasurements.inseamOutseamAllowance}")` : ""}`
            : ""
        },
        {
          label: "Outseam (+ Allowance)",
          value: listing.trouserMeasurements?.outseam
            ? `${listing.trouserMeasurements.outseam}"${listing.trouserMeasurements.inseamOutseamAllowance ? ` (+ ${listing.trouserMeasurements.inseamOutseamAllowance}")` : ""}`
            : ""
        },
        { label: "Opening", value: listing.trouserMeasurements?.opening ? `${listing.trouserMeasurements.opening}"` : "" },
        { label: "Cut", value: listing.trouserSpecs?.cut ? formatDisplayValue(listing.trouserSpecs.cut) : "" },
        { label: "Front", value: listing.trouserSpecs?.front ? formatDisplayValue(listing.trouserSpecs.front) : "" },
        { label: "Formal", value: listing.trouserSpecs?.formal ? formatDisplayValue(listing.trouserSpecs.formal) : "" }
      ]
    });
  }

  const sellerUsername = seller?.username || listing.sellerDisplayName;
  const sellerLocation = seller?.sellerLocation || listing.location;
  const sellerMemberSince = seller
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(seller.createdAt))
    : "";
  const estimatedArrival = formatEstimatedArrivalRange(3, 7);
  const guestMessageHref =
    "/login?authError=Log+in+or+create+an+account+to+message+this+seller";
  const intent = Array.isArray(resolvedSearchParams.intent) ? resolvedSearchParams.intent[0] : resolvedSearchParams.intent;
  const authError = displaySearchParam(resolvedSearchParams.authError);
  const cartAdded = Array.isArray(resolvedSearchParams.cartAdded)
    ? resolvedSearchParams.cartAdded[0]
    : resolvedSearchParams.cartAdded;
  const source = Array.isArray(resolvedSearchParams.from) ? resolvedSearchParams.from[0] : resolvedSearchParams.from;
  const sourceUsername = Array.isArray(resolvedSearchParams.username)
    ? resolvedSearchParams.username[0]
    : resolvedSearchParams.username;
  const showOfferForm = intent === "offer" && listing.allowOffers;
  const backHref =
    source === "profile" && sourceUsername
      ? `/users/${sourceUsername}`
      : "/";
  const backLabel =
    source === "profile" && sourceUsername
      ? "Back to User Profile"
      : "Back to Marketplace";

  return (
    <main className="grain px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {authError ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
        {cartAdded ? (
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
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
        <section className="panel rounded-[2rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
                <span className="uppercase">{formatDisplayValue(listing.category)}</span>
                <span> - {formatListingSizeLabel(listing.sizeLabel, listing.category) || "No size listed"}</span>
                {["two_piece_suit", "three_piece_suit"].includes(listing.category) && listing.trouserSizeLabel ? (
                  <span> - Trousers {formatSizeLabel(listing.trouserSizeLabel)}</span>
                ) : null}
              </p>
              {listing.status === "sold" ? (
                <span className="inline-flex min-h-[2.5rem] items-center rounded-full bg-stone-100 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-700">
                  {buyerOrder ? "Purchased" : "Sold"}
                </span>
              ) : null}
            </div>
            <div className="max-w-3xl">
              <h1 className="mt-4 text-4xl font-semibold text-stone-950">{listing.title}</h1>
              {listing.brand ? <p className="mt-3 font-serif text-xl italic text-stone-700">{listing.brand}</p> : null}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Condition</p>
                  <p className="mt-1 text-sm font-medium text-stone-900">{formatDisplayValue(listing.condition)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Era</p>
                  <p className="mt-1 text-sm font-medium text-stone-900">{formatEraLabel(listing.vintage)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Origin</p>
                  <p className="mt-1 text-sm font-medium text-stone-900">{getCountryDisplayName(listing.countryOfOrigin, "buyer")}</p>
                </div>
              </div>
            </div>
            </div>
            <Link
              href={backHref}
              className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              {backLabel}
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="panel relative rounded-[1.75rem] p-6">
            <div className="absolute right-8 top-8 z-20">
              {user ? (
                <form action={toggleSaveListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <input type="hidden" name="returnTo" value={`/listings/${listing.id}${source === "profile" && sourceUsername ? `?from=profile&username=${sourceUsername}` : ""}`} />
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
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
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                >
                  Save Item
                </Link>
              )}
            </div>
            <ListingGallery media={listing.media} title={listing.title} />
            <div className="mt-6">
              <h2 className="text-2xl font-semibold text-stone-950">Description</h2>
              <div className="mt-4 rounded-[1.5rem] bg-white p-5">
              <p className="mt-4 text-sm leading-7 text-stone-700">
                {listing.description || "The seller has not added a description for this item."}
              </p>
              </div>
            </div>
          </section>

          <aside className="panel grid gap-5 rounded-[1.75rem] p-6 md:grid-cols-2 lg:block">
            <div className="rounded-[1.75rem] bg-stone-950 p-5 text-stone-50">
              <p className="text-lg font-semibold text-stone-50">Price Summary</p>
              <div className="mt-5 border-b border-stone-700 pb-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Item Price</p>
                <p className="mt-2 text-4xl font-semibold">${listing.price.toFixed(2)}</p>
              </div>
              <div className="border-b border-stone-700 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Estimated Shipping</p>
                <p className="mt-2 text-sm font-semibold text-stone-200">${listing.shippingPrice.toFixed(2)}</p>
              </div>
              <div className="py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Shipping Method</p>
                <p className="mt-2 text-sm font-semibold text-stone-200">Shipping</p>
              </div>
              <div className="border-t border-stone-700 pt-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Estimated Arrival</p>
                <p className="mt-2 text-sm font-semibold text-stone-200">{estimatedArrival}</p>
              </div>
              <div className="border-t border-stone-700 pt-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Accepts Returns</p>
                <p className="mt-2 text-sm font-semibold text-stone-200">{listing.returnsAccepted ? "Yes" : "No"}</p>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <form action={addToCartAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/listings/${listing.id}${source === "profile" && sourceUsername ? `?from=profile&username=${sourceUsername}` : ""}`}
                  />
                  <button
                    disabled={listing.status !== "active"}
                    className="w-full rounded-full border border-stone-400 bg-stone-200 px-4 py-3 text-sm font-semibold text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add to Cart
                  </button>
                </form>
                <form action={buyNowAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button
                    disabled={listing.status !== "active"}
                    className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Purchase
                  </button>
                </form>
                {listing.allowOffers ? (
                  <Link
                    href={`/listings/${listing.id}?intent=offer`}
                    className="inline-flex w-full items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900"
                  >
                    Make Offer
                  </Link>
                ) : null}
              </div>
              {showOfferForm ? (
                <form action={makeOfferAction} className="mt-5 rounded-[1.5rem] border border-stone-700 bg-stone-900/60 p-4">
                  <input type="hidden" name="listingId" value={listing.id} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-50">Make an Offer</p>
                      <p className="mt-1 text-xs text-stone-400">Enter your offer amount below in dollars. Adding a note for the seller is optional.</p>
                    </div>
                    <Link
                      href={`/listings/${listing.id}`}
                      className="rounded-full border border-stone-600 px-3 py-1 text-xs font-semibold text-stone-200"
                    >
                      Cancel
                    </Link>
                  </div>
                  <label className="mt-4 flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-stone-400">Offer Amount</span>
                    <OfferAmountInput name="amount" placeholder={formatCurrency(listing.price)} />
                  </label>
                  <label className="mt-4 flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-stone-400">Message (optional, max. 1000 characters)</span>
                    <textarea
                      name="message"
                      rows={4}
                      maxLength={1000}
                      placeholder="Add a note to the seller if you'd like."
                      className="rounded-2xl border border-stone-600 bg-stone-950 px-4 py-3 text-sm text-stone-50 outline-none"
                    />
                  </label>
                  <button className="mt-4 w-full rounded-full border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
                    Send Offer
                  </button>
                </form>
              ) : null}
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 lg:mt-5">
              <p className="text-lg font-semibold text-stone-950">Seller Information</p>
              <div className="mt-5 border-b border-stone-200 pb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Username</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/users/${sellerUsername}?from=listing&listingId=${listing.id}`}
                    className="w-fit break-words text-sm font-semibold text-stone-900 transition hover:text-[var(--accent)]"
                  >
                    @{sellerUsername}
                  </Link>
                  {!user || user.id !== listing.sellerId ? (
                    <Link
                      href={user ? `/messages?listingId=${listing.id}` : guestMessageHref}
                      className="inline-flex w-fit items-center justify-center rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    >
                      Message User
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="border-b border-stone-200 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Location</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">{sellerLocation || " "}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Member Since</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">{sellerMemberSince || " "}</p>
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <DetailSection key={section.title} title={section.title} fields={section.fields} />
            ))}

            <DetailSection title="Fabric Specifications" fields={materialFields} />

            <section className="panel rounded-[1.75rem] p-6">
              <h2 className="text-2xl font-semibold text-stone-950">Computer-Assisted Fit Guidance</h2>
              {user && fit ? (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase ${fitStatusClass(fit.status)}`}>
                      {fitStatusLabel(fit.status)}
                    </span>
                  </div>

                  <div className="rounded-[1.5rem] bg-white p-5">
                    <p className="text-sm leading-7 text-stone-700">{fit.summary}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Fit Score</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{fit.score}/100</p>
                        </div>
                        <div className="rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Tailoring Feasibility</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {fit.alterationEstimate
                              ? fit.alterationEstimate.actions.length > 0
                                ? feasibilityLabel(fit.alterationEstimate.feasibility)
                                : "Not applicable"
                              : "Unavailable"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Tailoring Actions</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {fit.alterationEstimate ? fit.alterationEstimate.actions.length : 0}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Tailoring Cost</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {fit.estimatedAlterationCost !== null ? `$${Math.round(fit.estimatedAlterationCost)}` : "Not Advisable"}
                          </p>
                        </div>
                      </div>
                  </div>

                  {fit.alterationEstimate && fit.alterationEstimate.actions.length > 0 ? (
                    <div className="rounded-[1.5rem] bg-white p-5">
                      <p className="text-lg font-semibold text-stone-950">Likely Fit Issues & Tailoring Actions</p>
                      <div className="mt-4 grid gap-3">
                        {fit.alterationEstimate.actions.map((action) => {
                          const assessment = fit.assessments.find(
                            (item) => item.measurement === action.measurement && item.garment === action.garment
                          );

                          return (
                            <div
                              key={`${action.garment}-${action.type}-${action.measurement}`}
                              className={`rounded-2xl border px-4 py-3 ${
                                action.feasibility === "not_realistic"
                                  ? "border-rose-200 bg-rose-50"
                                  : "border-stone-200 bg-stone-50"
                              }`}
                            >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold ${action.feasibility === "not_realistic" ? "text-rose-950" : "text-stone-950"}`}>{tailoringActionLabel(action, listing.category === "two_piece_suit" || listing.category === "three_piece_suit")}</p>
                                  <p className={`mt-1 text-sm ${action.feasibility === "not_realistic" ? "text-rose-800" : "text-stone-700"}`}>{tailoringAmountCopy(action, assessment)}</p>
                                </div>
                                <div className="ml-auto text-right">
                                  <p className={`text-sm font-semibold ${action.feasibility === "not_realistic" ? "text-rose-900" : "text-stone-900"}`}>
                                    {tailoringOutcomeLabel(action)}
                                  </p>
                                </div>
                              </div>
                              {action.note ? (
                                <p className={`mt-3 text-sm leading-6 ${action.feasibility === "not_realistic" ? "text-rose-800" : "text-stone-700"}`}>
                                  {action.note}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : user ? (
                <p className="mt-3 text-sm text-stone-700">
                  Guidance is unavailable until you add measurements to your buyer profile.
                </p>
              ) : (
                <p className="mt-3 text-sm text-stone-700">
                  Log in with a buyer profile to see personalized fit and alteration guidance.
                </p>
              )}
              {listing.status !== "active" ? (
                <p className="mt-3 text-sm text-stone-700">
                  This listing is currently {listing.status}, so checkout is disabled until it is reactivated.
                </p>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
