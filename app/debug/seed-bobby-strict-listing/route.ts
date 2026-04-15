import { NextResponse } from "next/server";
import type { BuyerJacketMeasurements, JacketMeasurements, Listing } from "@/lib/types";
import { createListing, ensureSeedData, findUserByUsername, listSellerInventory } from "@/lib/store";

type ListingSeed = Omit<Listing, "id" | "sellerId" | "sellerDisplayName" | "createdAt">;

function requireJacketMeasurements(measurements: BuyerJacketMeasurements | null | undefined): JacketMeasurements {
  if (
    !measurements ||
    !measurements.chest ||
    !measurements.waist ||
    !measurements.shoulders ||
    !measurements.bodyLength ||
    !measurements.sleeveLength
  ) {
    throw new Error("Bobby needs saved jacket measurements before the strict-fit test listing can be created.");
  }

  return {
    chest: measurements.chest,
    waist: measurements.waist,
    shoulders: measurements.shoulders,
    bodyLength: measurements.bodyLength,
    sleeveLength: measurements.sleeveLength,
    sleeveLengthAllowance: measurements.sleeveLengthAllowance ?? 0
  };
}

function buildStrictJacketListing(jacket: JacketMeasurements): ListingSeed {
  const jacketMeasurements: JacketMeasurements = {
    chest: jacket.chest,
    waist: jacket.waist,
    shoulders: jacket.shoulders,
    bodyLength: jacket.bodyLength,
    sleeveLength: jacket.sleeveLength,
    sleeveLengthAllowance: 0.5
  };

  return {
    title: "Strict Filter Test: Exact Bobby Jacket",
    brand: "TailorGraph Fit Lab",
    category: "jacket",
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
    primaryColor: "navy",
    countryOfOrigin: "united_states",
    lapel: "notch",
    fabricWeight: "medium",
    fabricType: "twill",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: "modern",
    returnsAccepted: true,
    allowOffers: true,
    price: 255,
    shippingPrice: 15,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York, NY",
    distanceMiles: 10,
    description: "Exact-match jacket listing for validating strict marketplace profile filters.",
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

export async function GET() {
  try {
    await ensureSeedData();

    const user = await findUserByUsername("bobbyveebee");
    if (!user) {
      return NextResponse.json({ ok: false, error: "Could not find @bobbyveebee." }, { status: 404 });
    }

    const title = "Strict Filter Test: Exact Bobby Jacket";
    const existing = await listSellerInventory(user.id);
    const existingListing = existing.find((listing) => listing.title === title);
    if (existingListing) {
      return NextResponse.json({ ok: true, created: false, title, id: existingListing.id });
    }

    const jacket = requireJacketMeasurements(user.buyerProfile.jacketMeasurements);
    const listing = await createListing(user, buildStrictJacketListing(jacket));

    return NextResponse.json({ ok: true, created: true, title: listing.title, id: listing.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error creating strict test listing." },
      { status: 500 }
    );
  }
}
