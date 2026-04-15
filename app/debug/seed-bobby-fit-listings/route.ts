import { NextResponse } from "next/server";
import type {
  BuyerJacketMeasurements,
  BuyerTrouserMeasurements,
  JacketMeasurements,
  Listing,
  TrouserMeasurements
} from "@/lib/types";
import { createListing, ensureSeedData, findUserByUsername, listSellerInventory } from "@/lib/store";

type ListingSeed = Omit<Listing, "id" | "sellerId" | "sellerDisplayName" | "createdAt">;

function roundQuarter(value: number) {
  return Math.round(value * 4) / 4;
}

function requireJacketMeasurements(measurements: BuyerJacketMeasurements | null | undefined) {
  if (
    !measurements ||
    !measurements.chest ||
    !measurements.waist ||
    !measurements.shoulders ||
    !measurements.bodyLength ||
    !measurements.sleeveLength
  ) {
    throw new Error("Bobby needs saved jacket measurements before these fit-test listings can be generated.");
  }

  return {
    chest: measurements.chest,
    waist: measurements.waist,
    shoulders: measurements.shoulders,
    bodyLength: measurements.bodyLength,
    sleeveLength: measurements.sleeveLength,
    sleeveLengthAllowance: measurements.sleeveLengthAllowance ?? 0
  } satisfies JacketMeasurements;
}

function requireTrouserMeasurements(measurements: BuyerTrouserMeasurements | null | undefined) {
  if (
    !measurements ||
    !measurements.waist ||
    !measurements.hips ||
    !measurements.inseam ||
    !measurements.outseam ||
    !measurements.opening
  ) {
    throw new Error("Bobby needs saved trouser measurements before these fit-test listings can be generated.");
  }

  return {
    waist: measurements.waist,
    waistAllowance: measurements.waistAllowance ?? 0,
    hips: measurements.hips,
    inseam: measurements.inseam,
    inseamOutseamAllowance: measurements.inseamOutseamAllowance ?? 0,
    outseam: measurements.outseam,
    opening: measurements.opening
  } satisfies TrouserMeasurements;
}

function baseUpperListing(
  category: Extract<Listing["category"], "jacket" | "coat">,
  title: string,
  jacket: JacketMeasurements,
  overrides: Partial<JacketMeasurements> = {}
): ListingSeed {
  const jacketMeasurements: JacketMeasurements = {
    chest: overrides.chest ?? jacket.chest,
    waist: overrides.waist ?? jacket.waist,
    shoulders: overrides.shoulders ?? jacket.shoulders,
    bodyLength: overrides.bodyLength ?? jacket.bodyLength,
    sleeveLength: overrides.sleeveLength ?? jacket.sleeveLength,
    sleeveLengthAllowance: overrides.sleeveLengthAllowance ?? 0.5
  };

  return {
    title,
    brand: "TailorGraph Fit Lab",
    category,
    sizeLabel: "40R",
    trouserSizeLabel: "",
    chest: jacketMeasurements.chest,
    shoulder: jacketMeasurements.shoulders,
    waist: jacketMeasurements.waist,
    sleeve: jacketMeasurements.sleeveLength,
    inseam: 0,
    outseam: 0,
    material: "wool",
    pattern: "solid",
    primaryColor: category === "coat" ? "gray_charcoal" : "navy",
    countryOfOrigin: "united_states",
    lapel: "notch",
    fabricWeight: category === "coat" ? "heavy" : "medium",
    fabricType: category === "coat" ? "flannel" : "twill",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: "modern",
    returnsAccepted: true,
    allowOffers: true,
    price: category === "coat" ? 325 : 245,
    shippingPrice: 18,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 12,
    description: "Fit-testing seed listing generated for marketplace guidance review.",
    media: [],
    jacketMeasurements,
    jacketSpecs: {
      cut: "single_breasted",
      lapel: "notch",
      buttonStyle: "2_buttons",
      ventStyle: "double_vented",
      canvas: "half",
      lining: "full",
      formal: "na"
    },
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements: null,
    trouserSpecs: null,
    status: "active"
  };
}

function baseTrouserListing(
  title: string,
  trousers: TrouserMeasurements,
  overrides: Partial<TrouserMeasurements> = {}
): ListingSeed {
  const trouserMeasurements: TrouserMeasurements = {
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
    brand: "TailorGraph Fit Lab",
    category: "trousers",
    sizeLabel: "",
    trouserSizeLabel: "34x31",
    chest: 0,
    shoulder: 0,
    waist: 0,
    sleeve: 0,
    inseam: trouserMeasurements.inseam,
    outseam: trouserMeasurements.outseam,
    material: "wool",
    pattern: "solid",
    primaryColor: "gray_charcoal",
    countryOfOrigin: "united_states",
    lapel: "notch",
    fabricWeight: "medium",
    fabricType: "twill",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: "modern",
    returnsAccepted: true,
    allowOffers: true,
    price: 135,
    shippingPrice: 15,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 12,
    description: "Fit-testing seed listing generated for marketplace guidance review.",
    media: [],
    jacketMeasurements: null,
    jacketSpecs: null,
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements,
    trouserSpecs: {
      cut: "straight",
      front: "flat",
      formal: "na"
    },
    status: "active"
  };
}

function buildSeedListings(
  jacket: JacketMeasurements,
  trousers: TrouserMeasurements
): ListingSeed[] {
  return [
    baseUpperListing("jacket", "Fit Test: Ideal Jacket", jacket),
    baseUpperListing("jacket", "Fit Test: Jacket With Slightly Large Shoulders", jacket, {
      shoulders: roundQuarter(jacket.shoulders + 0.75)
    }),
    baseUpperListing("jacket", "Fit Test: Jacket With Slightly Small Shoulders", jacket, {
      shoulders: roundQuarter(jacket.shoulders - 0.75)
    }),
    baseUpperListing("jacket", "Fit Test: Jacket With Close Chest But Long Sleeves", jacket, {
      chest: roundQuarter(jacket.chest + 0.25),
      sleeveLength: roundQuarter(jacket.sleeveLength + 1.5)
    }),
    baseUpperListing("coat", "Fit Test: Coat With Random Measurements", jacket, {
      chest: roundQuarter(jacket.chest + 2.75),
      waist: roundQuarter(jacket.waist + 2.5),
      shoulders: roundQuarter(jacket.shoulders + 1.25),
      bodyLength: roundQuarter(jacket.bodyLength + 5.5),
      sleeveLength: roundQuarter(jacket.sleeveLength + 1)
    }),
    baseTrouserListing("Fit Test: Trousers With Enough Waist Allowance", trousers, {
      waist: roundQuarter(trousers.waist - 0.75),
      waistAllowance: 1.5
    }),
    baseTrouserListing("Fit Test: Trouser Inseam Too Short", trousers, {
      inseam: roundQuarter(trousers.inseam - 2),
      outseam: roundQuarter(trousers.outseam - 1.5),
      inseamOutseamAllowance: 0
    }),
    baseUpperListing("jacket", "Fit Test: Rank Order Jacket A", jacket, {
      chest: roundQuarter(jacket.chest + 0.5),
      waist: roundQuarter(jacket.waist + 0.5),
      shoulders: roundQuarter(jacket.shoulders + 0.35),
      bodyLength: roundQuarter(jacket.bodyLength + 1),
      sleeveLength: roundQuarter(jacket.sleeveLength + 0.5)
    }),
    baseUpperListing("jacket", "Fit Test: Rank Order Jacket B", jacket, {
      chest: roundQuarter(jacket.chest + 1.25),
      waist: roundQuarter(jacket.waist + 1),
      shoulders: roundQuarter(jacket.shoulders + 0.65),
      bodyLength: roundQuarter(jacket.bodyLength + 1.75),
      sleeveLength: roundQuarter(jacket.sleeveLength + 0.75)
    })
  ];
}

export async function GET() {
  await ensureSeedData();

  const user = await findUserByUsername("bobbyveebee");
  if (!user) {
    return NextResponse.json({ ok: false, error: "Could not find @bobbyveebee." }, { status: 404 });
  }

  const jacket = requireJacketMeasurements(user.buyerProfile.jacketMeasurements);
  const trousers = requireTrouserMeasurements(user.buyerProfile.trouserMeasurements);
  const existing = await listSellerInventory(user.id);
  const existingTitles = new Set(existing.map((listing) => listing.title));

  const seeds = buildSeedListings(jacket, trousers);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const seed of seeds) {
    if (existingTitles.has(seed.title)) {
      skipped.push(seed.title);
      continue;
    }

    await createListing(user, seed);
    created.push(seed.title);
  }

  return NextResponse.json({
    ok: true,
    seller: user.username,
    created,
    skipped,
    totalRequested: seeds.length
  });
}
