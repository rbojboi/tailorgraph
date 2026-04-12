import test from "node:test";
import assert from "node:assert/strict";
import { estimateShippoParcel, getSellerShipFromAddress } from "@/lib/shippo";
import type { BuyerProfile, User } from "@/lib/types";

function buildBuyerProfile(overrides: Partial<BuyerProfile>): BuyerProfile {
  return {
    zipCode: "",
    location: "",
    address: {
      fullName: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US"
    },
    addresses: [],
    height: 70,
    weight: 180,
    chest: 20,
    shoulder: 18,
    waist: 17,
    sleeve: 25,
    neck: 15.5,
    inseam: 31,
    fitPreference: "classic",
    maxAlterationBudget: 150,
    searchRadius: 100,
    jacketMeasurements: null,
    shirtMeasurements: null,
    waistcoatMeasurements: null,
    trouserMeasurements: null,
    coatMeasurements: null,
    sweaterMeasurements: null,
    suggestedMeasurementRanges: null,
    ...overrides
  };
}

function buildUser(profile: BuyerProfile): Pick<User, "name" | "buyerProfile"> {
  return {
    name: "Seller Test",
    buyerProfile: profile
  };
}

test("estimateShippoParcel uses larger defaults for coats than jackets", () => {
  const coat = estimateShippoParcel({ category: "coat" });
  const jacket = estimateShippoParcel({ category: "jacket" });

  assert.equal(coat.weight, "88");
  assert.equal(jacket.weight, "48");
  assert.equal(coat.height, "6");
  assert.equal(jacket.height, "4");
});

test("getSellerShipFromAddress prefers saved addresses", () => {
  const seller = buildUser(
    buildBuyerProfile({
      address: {
        fullName: "Primary",
        line1: "1 Main St",
        line2: "",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US"
      },
      addresses: [
        {
          fullName: "Warehouse",
          line1: "99 Shipping Ave",
          line2: "",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11201",
          country: "US"
        }
      ]
    })
  );

  assert.equal(getSellerShipFromAddress(seller)?.line1, "99 Shipping Ave");
});

test("getSellerShipFromAddress falls back to primary account address", () => {
  const seller = buildUser(
    buildBuyerProfile({
      address: {
        fullName: "Primary",
        line1: "1 Main St",
        line2: "",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US"
      }
    })
  );

  assert.equal(getSellerShipFromAddress(seller)?.line1, "1 Main St");
});
