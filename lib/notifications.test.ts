import test from "node:test";
import assert from "node:assert/strict";
import { getEstimatedArrivalLabel, normalizeSmsNumber } from "./notifications";
import type { Listing, Order } from "./types";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1234-5678",
    buyerId: "buyer-1",
    buyerName: "Buyer",
    sellerId: "seller-1",
    sellerName: "sellername",
    listingId: "listing-1",
    listingTitle: "Test Jacket",
    amount: 425,
    subtotal: 400,
    shippingAmount: 25,
    paymentMethod: "stripe_checkout",
    status: "processing",
    listingStatus: "sold",
    returnsAccepted: true,
    stripeCheckoutSessionId: "cs_test_123",
    stripePaymentIntentId: "pi_test_123",
    shippingAddress: {
      fullName: "Buyer",
      line1: "123 Main St",
      line2: "",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US"
    },
    shippingMethod: "ship",
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    trackingStatus: null,
    shippingEta: null,
    shippingLabelUrl: null,
    shippingProvider: null,
    shippingProviderShipmentId: null,
    shippingProviderRateId: null,
    shippingProviderTransactionId: null,
    issueReason: null,
    sellerNotes: null,
    shippedAt: null,
    deliveredAt: null,
    reviewOverallRating: null,
    reviewMeasurementRating: null,
    reviewConditionRating: null,
    reviewShippingRating: null,
    reviewCommunicationRating: null,
    reviewFeedback: "",
    createdAt: "2026-04-11T14:00:00.000Z",
    ...overrides
  };
}

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    sellerId: "seller-1",
    sellerDisplayName: "sellername",
    title: "Test Jacket",
    brand: "Canali",
    category: "jacket",
    sizeLabel: "40R",
    trouserSizeLabel: "",
    chest: 20,
    shoulder: 18,
    waist: 18,
    sleeve: 34,
    inseam: 0,
    outseam: 0,
    material: "wool",
    pattern: "solid",
    primaryColor: "navy",
    countryOfOrigin: "italy",
    lapel: "notch",
    fabricWeight: "medium",
    fabricType: "flannel",
    fabricWeave: "twill",
    condition: "used_excellent",
    vintage: "modern",
    returnsAccepted: true,
    allowOffers: true,
    price: 400,
    shippingPrice: 25,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 3,
    location: "New York, NY",
    distanceMiles: 5,
    description: "A test listing.",
    media: [],
    jacketMeasurements: null,
    jacketSpecs: null,
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements: null,
    trouserSpecs: null,
    status: "active",
    createdAt: "2026-04-11T14:00:00.000Z",
    ...overrides
  };
}

test("normalizeSmsNumber converts common US formats to E.164", () => {
  assert.equal(normalizeSmsNumber("(212) 555-1234"), "+12125551234");
  assert.equal(normalizeSmsNumber("+1 212-555-1234"), "+12125551234");
  assert.equal(normalizeSmsNumber("2125551234"), "+12125551234");
});

test("normalizeSmsNumber rejects malformed values", () => {
  assert.equal(normalizeSmsNumber("555-123"), null);
});

test("getEstimatedArrivalLabel reflects processing days plus transit window", () => {
  const label = getEstimatedArrivalLabel(buildOrder(), buildListing({ processingDays: 2 }));
  assert.equal(typeof label, "string");
  assert.ok(label.length > 0);
});
