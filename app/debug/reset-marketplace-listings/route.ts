import { NextResponse } from "next/server";
import type {
  BuyerJacketMeasurements,
  BuyerTrouserMeasurements,
  BuyerWaistcoatMeasurements,
  Listing,
  ListingStatus
} from "@/lib/types";
import {
  createListing,
  ensureSeedData,
  findUserByUsername,
  listMarketplace,
  updateListingStatus
} from "@/lib/store";

type ListingSeed = Omit<Listing, "id" | "sellerId" | "sellerDisplayName" | "createdAt">;

function q(value: number) {
  return Math.round(value * 4) / 4;
}

function requireJacket(measurements: BuyerJacketMeasurements | null | undefined) {
  if (
    !measurements ||
    !measurements.chest ||
    !measurements.waist ||
    !measurements.shoulders ||
    !measurements.bodyLength ||
    !measurements.sleeveLength
  ) {
    throw new Error("Bobby needs saved jacket measurements before resetting the marketplace seed set.");
  }

  return measurements;
}

function requireWaistcoat(measurements: BuyerWaistcoatMeasurements | null | undefined) {
  if (!measurements || !measurements.chest || !measurements.waist || !measurements.shoulders || !measurements.bodyLength) {
    throw new Error("Bobby needs saved waistcoat measurements before resetting the marketplace seed set.");
  }

  return measurements;
}

function requireTrousers(measurements: BuyerTrouserMeasurements | null | undefined) {
  if (
    !measurements ||
    !measurements.waist ||
    !measurements.hips ||
    !measurements.inseam ||
    !measurements.outseam ||
    !measurements.opening
  ) {
    throw new Error("Bobby needs saved trouser measurements before resetting the marketplace seed set.");
  }

  return measurements;
}

function upperSeed(
  title: string,
  category: Extract<Listing["category"], "jacket" | "shirt" | "coat" | "sweater">,
  jacket: BuyerJacketMeasurements,
  overrides: Partial<BuyerJacketMeasurements> = {},
  options?: Partial<Pick<Listing, "material" | "pattern" | "primaryColor" | "price" | "fabricType" | "fabricWeight" | "countryOfOrigin">>
): ListingSeed {
  const measurements = {
    chest: overrides.chest ?? jacket.chest,
    waist: overrides.waist ?? jacket.waist,
    shoulders: overrides.shoulders ?? jacket.shoulders,
    bodyLength: overrides.bodyLength ?? jacket.bodyLength,
    sleeveLength: overrides.sleeveLength ?? jacket.sleeveLength,
    sleeveLengthAllowance: overrides.sleeveLengthAllowance ?? 0
  };

  return {
    title,
    brand: category === "shirt" ? "Brooks Brothers" : category === "coat" ? "Chesterfield House" : "TailorGraph Lab",
    category,
    sizeLabel:
      category === "shirt"
        ? "15.5 x 34"
        : category === "coat"
          ? "40R"
          : category === "sweater"
            ? "Medium"
            : "40R",
    trouserSizeLabel: "",
    chest: measurements.chest,
    shoulder: measurements.shoulders,
    waist: measurements.waist,
    sleeve: measurements.sleeveLength,
    inseam: 0,
    outseam: 0,
    material: options?.material ?? (category === "shirt" ? "cotton" : category === "sweater" ? "cashmere_blend" : "wool"),
    pattern: options?.pattern ?? (category === "shirt" ? "thin_stripe" : "solid"),
    primaryColor: options?.primaryColor ?? (category === "shirt" ? "blue" : "navy"),
    countryOfOrigin: options?.countryOfOrigin ?? "united_states",
    lapel: "notch",
    fabricWeight: options?.fabricWeight ?? "medium",
    fabricType:
      options?.fabricType ??
      (category === "shirt" ? "oxford" : category === "coat" ? "melton" : category === "sweater" ? "fine_knit" : "worsted"),
    fabricWeave: category === "shirt" ? "twill" : "twill",
    condition: "used_excellent",
    vintage: false,
    returnsAccepted: true,
    allowOffers: true,
    price: options?.price ?? (category === "coat" ? 365 : category === "shirt" ? 78 : category === "sweater" ? 98 : 240),
    shippingPrice: 15,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 8,
    description: "Marketplace reset seed listing for fit engine review.",
    media: [],
    jacketMeasurements: category === "shirt" ? { ...measurements, neck: overrides.neck ?? 15.5 } : measurements,
    jacketSpecs:
      category === "shirt" || category === "sweater"
        ? null
        : {
            cut: "single_breasted",
            lapel: "notch",
            buttonStyle: "2_buttons",
            ventStyle: "double_vented",
            canvas: "half",
            lining: "full",
            formal: "na"
          },
    shirtSpecs:
      category === "shirt"
        ? {
            collarStyle: "button_down",
            cuffStyle: "barrel",
            placket: "standard"
          }
        : null,
    sweaterSpecs:
      category === "sweater"
        ? {
            neckline: "crew_neck",
            closure: "none"
          }
        : null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements: null,
    trouserSpecs: null,
    status: "active"
  };
}

function waistcoatSeed(
  title: string,
  waistcoat: BuyerWaistcoatMeasurements,
  overrides: Partial<BuyerWaistcoatMeasurements> = {},
  options?: Partial<Pick<Listing, "material" | "pattern" | "primaryColor" | "price">>
): ListingSeed {
  const measurements = {
    chest: overrides.chest ?? waistcoat.chest,
    waist: overrides.waist ?? waistcoat.waist,
    shoulders: overrides.shoulders ?? waistcoat.shoulders,
    bodyLength: overrides.bodyLength ?? waistcoat.bodyLength
  };

  return {
    title,
    brand: "TailorGraph Lab",
    category: "waistcoat",
    sizeLabel: "40R",
    trouserSizeLabel: "",
    chest: measurements.chest,
    shoulder: measurements.shoulders,
    waist: measurements.waist,
    sleeve: 0,
    inseam: 0,
    outseam: 0,
    material: options?.material ?? "wool",
    pattern: options?.pattern ?? "solid",
    primaryColor: options?.primaryColor ?? "gray_charcoal",
    countryOfOrigin: "united_states",
    lapel: "notch",
    fabricWeight: "medium",
    fabricType: "worsted",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: false,
    returnsAccepted: true,
    allowOffers: true,
    price: options?.price ?? 110,
    shippingPrice: 12,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 8,
    description: "Marketplace reset seed listing for fit engine review.",
    media: [],
    jacketMeasurements: null,
    jacketSpecs: null,
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: measurements,
    waistcoatSpecs: {
      cut: "single_breasted",
      lapel: "na",
      formal: "na"
    },
    trouserMeasurements: null,
    trouserSpecs: null,
    status: "active"
  };
}

function trouserSeed(
  title: string,
  trousers: BuyerTrouserMeasurements,
  overrides: Partial<BuyerTrouserMeasurements> = {},
  options?: Partial<Pick<Listing, "material" | "pattern" | "primaryColor" | "price">>
): ListingSeed {
  const measurements = {
    waist: overrides.waist ?? trousers.waist,
    waistAllowance: overrides.waistAllowance ?? 0,
    hips: overrides.hips ?? trousers.hips,
    inseam: overrides.inseam ?? trousers.inseam,
    inseamOutseamAllowance: overrides.inseamOutseamAllowance ?? 0,
    outseam: overrides.outseam ?? trousers.outseam,
    opening: overrides.opening ?? trousers.opening
  };

  return {
    title,
    brand: "TailorGraph Lab",
    category: "trousers",
    sizeLabel: "",
    trouserSizeLabel: "34 x 32",
    chest: 0,
    shoulder: 0,
    waist: 0,
    sleeve: 0,
    inseam: measurements.inseam,
    outseam: measurements.outseam,
    material: options?.material ?? "wool",
    pattern: options?.pattern ?? "solid",
    primaryColor: options?.primaryColor ?? "gray_charcoal",
    countryOfOrigin: "united_states",
    lapel: "notch",
    fabricWeight: "medium",
    fabricType: "worsted",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: false,
    returnsAccepted: true,
    allowOffers: true,
    price: options?.price ?? 120,
    shippingPrice: 12,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 8,
    description: "Marketplace reset seed listing for fit engine review.",
    media: [],
    jacketMeasurements: null,
    jacketSpecs: null,
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements: measurements,
    trouserSpecs: {
      cut: "straight",
      front: "flat",
      formal: "na"
    },
    status: "active"
  };
}

function buildSeeds(
  jacket: BuyerJacketMeasurements,
  waistcoat: BuyerWaistcoatMeasurements,
  trousers: BuyerTrouserMeasurements
): ListingSeed[] {
  return [
    upperSeed("Mid Fit Seed: Navy Jacket With Slightly Broad Shoulders", "jacket", jacket, {
      chest: q(jacket.chest + 0.75),
      waist: q(jacket.waist + 0.5),
      shoulders: q(jacket.shoulders + 0.75),
      sleeveLength: q(jacket.sleeveLength + 0.75)
    }, { primaryColor: "navy", price: 248 }),
    upperSeed("Mid Fit Seed: Trim Gray Jacket With Shorter Body", "jacket", jacket, {
      chest: q(jacket.chest - 0.75),
      waist: q(jacket.waist - 1),
      shoulders: q(jacket.shoulders - 0.25),
      bodyLength: q(jacket.bodyLength - 1.5),
      sleeveLength: q(jacket.sleeveLength - 0.75)
    }, { primaryColor: "gray_charcoal", pattern: "herringbone", price: 236 }),
    upperSeed("Mid Fit Seed: Soft Shoulder Jacket With Extra Chest", "jacket", jacket, {
      chest: q(jacket.chest + 1.25),
      waist: q(jacket.waist + 1),
      shoulders: q(jacket.shoulders + 0.5),
      bodyLength: q(jacket.bodyLength + 1),
      sleeveLength: q(jacket.sleeveLength + 0.5)
    }, { primaryColor: "brown", pattern: "windowpane", price: 258 }),
    upperSeed("Mid Fit Seed: Charcoal Coat With Long Body", "coat", jacket, {
      chest: q(jacket.chest + 1.5),
      waist: q(jacket.waist + 1.75),
      shoulders: q(jacket.shoulders + 1),
      bodyLength: q(jacket.bodyLength + 8),
      sleeveLength: q(jacket.sleeveLength + 1)
    }, { primaryColor: "gray_charcoal", price: 348, fabricType: "melton", fabricWeight: "heavy" }),
    waistcoatSeed("Mid Fit Seed: Close Waistcoat With Slightly Full Chest", waistcoat, {
      chest: q(waistcoat.chest + 1.25),
      waist: q(waistcoat.waist + 1),
      shoulders: q(waistcoat.shoulders + 0.5),
      bodyLength: q(waistcoat.bodyLength + 0.75)
    }, { primaryColor: "navy", price: 114 }),
    trouserSeed("Mid Fit Seed: Pleated Trousers With Easy Waist Let-Out", trousers, {
      waist: q(trousers.waist - 1),
      waistAllowance: 1.5,
      hips: q(trousers.hips + 0.25),
      inseam: q(trousers.inseam - 0.5),
      inseamOutseamAllowance: 1,
      opening: q(trousers.opening + 0.25)
    }, { primaryColor: "navy", price: 132 }),
    trouserSeed("Mid Fit Seed: Roomier Trousers With Hem Needed", trousers, {
      waist: q(trousers.waist + 1.25),
      hips: q(trousers.hips + 1.25),
      inseam: q(trousers.inseam + 1.5),
      outseam: q(trousers.outseam + 1.5),
      opening: q(trousers.opening + 0.5)
    }, { primaryColor: "gray_charcoal", price: 128 }),
    trouserSeed("Mid Fit Seed: Trim Trousers With Limited Allowance", trousers, {
      waist: q(trousers.waist - 0.75),
      waistAllowance: 1,
      hips: q(trousers.hips - 0.5),
      inseam: q(trousers.inseam),
      opening: q(trousers.opening - 0.25)
    }, { primaryColor: "brown", price: 126 })
  ];
}

function shouldPreserve(listing: Listing) {
  return listing.sellerDisplayName === "bobbyveebee" && listing.title.includes("Brooks Brothers");
}

export async function GET() {
  await ensureSeedData();

  const user = await findUserByUsername("bobbyveebee");
  if (!user) {
    return NextResponse.json({ ok: false, error: "Could not find @bobbyveebee." }, { status: 404 });
  }

  const jacket = requireJacket(user.buyerProfile.jacketMeasurements);
  const waistcoat = requireWaistcoat(user.buyerProfile.waistcoatMeasurements);
  const trousers = requireTrousers(user.buyerProfile.trouserMeasurements);

  const listings = await listMarketplace();
  const archived: Array<{ title: string; from: ListingStatus }> = [];

  for (const listing of listings) {
    if (shouldPreserve(listing)) {
      continue;
    }

    if (listing.status !== "archived") {
      await updateListingStatus(listing.id, "archived");
      archived.push({ title: listing.title, from: listing.status });
    }
  }

  const seeds = buildSeeds(jacket, waistcoat, trousers);
  const created: string[] = [];

  for (const seed of seeds) {
    const newListing = await createListing(user, seed);
    created.push(newListing.title);
  }

  return NextResponse.json({
    ok: true,
    preserved: listings.filter(shouldPreserve).map((listing) => ({ title: listing.title, seller: listing.sellerDisplayName })),
    archivedCount: archived.length,
    createdCount: created.length,
    created
  });
}
