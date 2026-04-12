import type { Listing, Order, ShippingAddress, User } from "@/lib/types";

const SHIPPO_API_BASE = "https://api.goshippo.com";
const SHIPPO_API_VERSION = "2018-02-08";

type ShippoAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type ShippoParcel = {
  length: string;
  width: string;
  height: string;
  distance_unit: "in";
  weight: string;
  mass_unit: "oz";
};

type ShippoRate = {
  object_id: string;
  amount: string;
  currency?: string;
  provider?: string;
  servicelevel?: {
    name?: string;
    token?: string;
  } | null;
  estimated_days?: number | null;
  duration_terms?: string | null;
};

type ShippoShipmentResponse = {
  object_id: string;
  rates?: ShippoRate[];
  messages?: Array<{ text?: string }>;
};

type ShippoTransactionResponse = {
  object_id: string;
  status?: string;
  rate?: {
    amount?: string;
    currency?: string;
    provider?: string;
  } | null;
  tracking_number?: string | null;
  tracking_status?: string | null;
  tracking_url_provider?: string | null;
  label_url?: string | null;
  eta?: string | null;
  messages?: Array<{ text?: string }>;
};

export type ShippoLabelPurchase = {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  trackingStatus: string | null;
  shippingEta: string | null;
  shippingLabelUrl: string | null;
  shippingProvider: "shippo";
  shippingProviderShipmentId: string | null;
  shippingProviderRateId: string | null;
  shippingProviderTransactionId: string | null;
  selectedRateAmount: number | null;
  selectedRateCurrency: string | null;
};

export type ShippoRateOption = {
  rateId: string;
  provider: string;
  serviceLevel: string;
  amount: number | null;
  currency: string | null;
  estimatedDays: number | null;
  durationTerms: string | null;
};

export type ShippoShipmentQuote = {
  shipmentId: string;
  rates: ShippoRateOption[];
};

function getShippoToken() {
  return process.env.SHIPPO_API_TOKEN || "";
}

export function isShippoConfigured() {
  return Boolean(getShippoToken());
}

function getShippoHeaders() {
  const token = getShippoToken();

  if (!token) {
    throw new Error("SHIPPO_API_TOKEN is not configured");
  }

  return {
    Authorization: `ShippoToken ${token}`,
    "Content-Type": "application/json",
    "SHIPPO-API-VERSION": SHIPPO_API_VERSION
  };
}

function formatShippoErrors(messages?: Array<{ text?: string }>) {
  const message = messages?.map((entry) => entry.text?.trim()).filter(Boolean)[0];
  return message || "Shippo could not create a label for this order.";
}

function normalizeShippoAddress(address: ShippingAddress, fallbackName: string): ShippoAddress | null {
  if (!address.line1 || !address.city || !address.state || !address.postalCode || !address.country) {
    return null;
  }

  return {
    name: address.fullName || fallbackName,
    street1: address.line1,
    street2: address.line2 || undefined,
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    country: address.country.toUpperCase()
  };
}

export function getSellerShipFromAddress(user: Pick<User, "name" | "buyerProfile">): ShippingAddress | null {
  const savedAddresses = user.buyerProfile.addresses.length ? user.buyerProfile.addresses : [user.buyerProfile.address];
  return (
    savedAddresses.find((address) => address.line1 && address.city && address.state && address.postalCode && address.country) ||
    null
  );
}

export function estimateShippoParcel(listing: Pick<Listing, "category">): ShippoParcel {
  switch (listing.category) {
    case "coat":
      return { length: "18", width: "15", height: "6", distance_unit: "in", weight: "88", mass_unit: "oz" };
    case "three_piece_suit":
      return { length: "18", width: "14", height: "6", distance_unit: "in", weight: "84", mass_unit: "oz" };
    case "two_piece_suit":
      return { length: "18", width: "14", height: "5", distance_unit: "in", weight: "72", mass_unit: "oz" };
    case "jacket":
      return { length: "16", width: "12", height: "4", distance_unit: "in", weight: "48", mass_unit: "oz" };
    case "sweater":
      return { length: "15", width: "12", height: "4", distance_unit: "in", weight: "32", mass_unit: "oz" };
    case "trousers":
      return { length: "15", width: "12", height: "3", distance_unit: "in", weight: "28", mass_unit: "oz" };
    case "waistcoat":
      return { length: "14", width: "11", height: "3", distance_unit: "in", weight: "24", mass_unit: "oz" };
    case "shirt":
      return { length: "13", width: "10", height: "2", distance_unit: "in", weight: "18", mass_unit: "oz" };
    default:
      return { length: "14", width: "12", height: "3", distance_unit: "in", weight: "24", mass_unit: "oz" };
  }
}

function mapRateOption(rate: ShippoRate): ShippoRateOption {
  return {
    rateId: rate.object_id,
    provider: rate.provider || "Shippo",
    serviceLevel: rate.servicelevel?.name || "Standard",
    amount: Number.isFinite(Number(rate.amount)) ? Number(rate.amount) : null,
    currency: rate.currency || null,
    estimatedDays: rate.estimated_days ?? null,
    durationTerms: rate.duration_terms ?? null
  };
}

async function shippoRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${SHIPPO_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getShippoHeaders(),
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  const data = (await response.json()) as T & { detail?: string; messages?: Array<{ text?: string }> };

  if (!response.ok) {
    throw new Error(data.detail || formatShippoErrors(data.messages));
  }

  return data as T;
}

function getNormalizedShippoAddresses(input: {
  order: Pick<Order, "id" | "shippingAddress">;
  seller: Pick<User, "name" | "buyerProfile">;
}) {
  const shipFromSource = getSellerShipFromAddress(input.seller);
  const addressFrom = shipFromSource ? normalizeShippoAddress(shipFromSource, input.seller.name) : null;
  const addressTo = normalizeShippoAddress(input.order.shippingAddress, input.order.shippingAddress.fullName || "Buyer");

  if (!addressFrom) {
    throw new Error("Add a saved sender address in Account Settings before buying a label.");
  }

  if (!addressTo) {
    throw new Error("The buyer shipping address is incomplete, so a label cannot be created yet.");
  }

  return { addressFrom, addressTo };
}

export async function createShippoShipmentQuote(input: {
  order: Pick<Order, "id" | "shippingAddress">;
  listing: Pick<Listing, "category">;
  seller: Pick<User, "name" | "buyerProfile">;
}): Promise<ShippoShipmentQuote> {
  const { addressFrom, addressTo } = getNormalizedShippoAddresses(input);

  const shipment = await shippoRequest<ShippoShipmentResponse>("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: addressFrom,
      address_to: addressTo,
      parcels: [estimateShippoParcel(input.listing)],
      async: false,
      metadata: `order:${input.order.id}`
    })
  });

  const rates = (shipment.rates || []).map(mapRateOption).filter((rate) => rate.amount !== null);

  if (!rates.length) {
    throw new Error(formatShippoErrors(shipment.messages));
  }

  return {
    shipmentId: shipment.object_id,
    rates: rates.sort((left, right) => (left.amount ?? 0) - (right.amount ?? 0))
  };
}

export async function purchaseShippoLabelForRate(input: {
  orderId: string;
  shipmentId: string;
  rateId: string;
  rate?: ShippoRateOption | null;
}): Promise<ShippoLabelPurchase> {
  const transaction = await shippoRequest<ShippoTransactionResponse>("/transactions/", {
    method: "POST",
    body: JSON.stringify({
      rate: input.rateId,
      async: false,
      label_file_type: "PDF",
      metadata: `order:${input.orderId}`
    })
  });

  if ((transaction.status || "").toUpperCase() !== "SUCCESS" || !transaction.tracking_number) {
    throw new Error(formatShippoErrors(transaction.messages));
  }

  return {
    carrier: transaction.rate?.provider || input.rate?.provider || "Shippo",
    trackingNumber: transaction.tracking_number,
    trackingUrl: transaction.tracking_url_provider || null,
    trackingStatus: transaction.tracking_status || null,
    shippingEta: transaction.eta || null,
    shippingLabelUrl: transaction.label_url || null,
    shippingProvider: "shippo",
    shippingProviderShipmentId: input.shipmentId || null,
    shippingProviderRateId: input.rateId || null,
    shippingProviderTransactionId: transaction.object_id || null,
    selectedRateAmount: Number.isFinite(Number(transaction.rate?.amount))
      ? Number(transaction.rate?.amount)
      : input.rate?.amount ?? null,
    selectedRateCurrency: transaction.rate?.currency || input.rate?.currency || null
  };
}

export async function purchaseShippoLabel(input: {
  order: Pick<Order, "id" | "shippingAddress">;
  listing: Pick<Listing, "category">;
  seller: Pick<User, "name" | "buyerProfile">;
}): Promise<ShippoLabelPurchase> {
  const quote = await createShippoShipmentQuote(input);
  const selectedRate = quote.rates[0];

  return purchaseShippoLabelForRate({
    orderId: input.order.id,
    shipmentId: quote.shipmentId,
    rateId: selectedRate.rateId,
    rate: selectedRate
  });
}
