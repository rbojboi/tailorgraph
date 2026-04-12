import { NextRequest, NextResponse } from "next/server";
import { getFitRecommendation } from "@/lib/fit";
import { ensureSeedData, findUserByUsername, listMarketplace } from "@/lib/store";

export async function GET(request: NextRequest) {
  await ensureSeedData();

  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ ok: false, error: "Pass ?title=..." }, { status: 400 });
  }

  const user = await findUserByUsername("bobbyveebee");
  if (!user) {
    return NextResponse.json({ ok: false, error: "Could not find @bobbyveebee." }, { status: 404 });
  }

  const listing = (await listMarketplace()).find((entry) => entry.title === title);
  if (!listing) {
    return NextResponse.json({ ok: false, error: `Could not find listing titled "${title}".` }, { status: 404 });
  }

  const recommendation = getFitRecommendation(user.buyerProfile, listing);

  return NextResponse.json({
    ok: true,
    listing: {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      jacketMeasurements: listing.jacketMeasurements,
      trouserMeasurements: listing.trouserMeasurements
    },
    buyerProfile: {
      shirtMeasurements: user.buyerProfile.shirtMeasurements,
      jacketMeasurements: user.buyerProfile.jacketMeasurements,
      coatMeasurements: user.buyerProfile.coatMeasurements,
      sweaterMeasurements: user.buyerProfile.sweaterMeasurements,
      waistcoatMeasurements: user.buyerProfile.waistcoatMeasurements,
      trouserMeasurements: user.buyerProfile.trouserMeasurements
    },
    recommendation
  });
}
