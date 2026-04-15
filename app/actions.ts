"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCart, clearCart, getCartIds, removeFromCart } from "@/lib/cart";
import {
  clearSession,
  createSession,
  getCurrentUser,
  hashPassword,
  verifyPassword
} from "@/lib/auth";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  attachStripeSessionToOrder,
  createListing,
  createOffer,
  createOrder,
  createEmailVerificationToken,
  createPasswordResetToken,
  createSavedSearch,
  createUser,
  clearPasswordResetTokensForUser,
  clearEmailVerificationTokensForUser,
  createDirectMessageThread,
  deleteMessageThreadForUser,
  deleteSavedSearch,
  dismissMarketplaceIntro,
  findListingById,
  findMessageThreadByIdForUser,
  findOrderById,
  findOrderReviewByOrderId,
  findValidPasswordResetUserByTokenHash,
  findValidEmailVerificationUserByTokenHash,
  followUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  getOrCreateListingMessageThread,
  isFollowingUser,
  isListingSavedByUser,
  listFollowerUsersForSeller,
  listSavedSearchesForUser,
  listOrdersByStripeCheckoutSessionId,
  markPasswordResetTokenUsed,
  markEmailVerificationTokenUsed,
  markUserEmailVerified,
  markListingSold,
  markOrderDelivered,
  markOrderPaidById,
  markUserStripeOnboardingComplete,
  reopenListing,
  reserveListing,
  restoreMessageThreadForUser,
  saveOrderReview,
  saveListingForUser,
  isDatabaseConfigured,
  unfollowUser,
  unsaveListingForUser,
  updateSavedSearchName,
  updateSavedSearchQuery,
  updateListingStatus,
  updateListing,
  updateBuyerAccount,
  updateOrderIssue,
  updateOrderShipping,
  updateOrderShippingWithProvider,
  updateSellerLocation,
  updateUserEmail,
  updateUser,
  updateUsername,
  updateUserPassword,
  updateUserStripeAccount,
  sendMessageInThread
} from "@/lib/store";
import { saveListingMediaFiles } from "@/lib/media";
import {
  sendDirectMessageNotification,
  sendEmailVerificationNotification,
  sendNewListingFollowerNotification,
  sendOrderShippedNotifications,
  sendPasswordResetNotification
} from "@/lib/notifications";
import { purchaseShippoLabel, purchaseShippoLabelForRate } from "@/lib/shippo";
import { estimateShippingCost, estimateTailoringDistanceFromSellerLocation } from "@/lib/shipping";
import { combineSplitSize } from "@/lib/sizing";
import { resolveUsZipCode, sanitizeZipCode } from "@/lib/zip";
import { resolveListingBrandInput } from "@/lib/brands";
import { resolveListingCountryInput } from "@/lib/countries";
import { generateBuyerMeasurementSuggestions, generateBuyerMeasurementSuggestionsFromAnchor } from "@/lib/measurement-guide";
import {
  runBuyerGarmentMeasurementSanityCheck,
  type BuyerBodyMeasurementSanityCheckResult
} from "@/lib/measurement-guide-support";
import type {
  BuyerJacketMeasurements,
  BuyerTrouserMeasurements,
  BuyerWaistcoatMeasurements,
  BuyerProfile,
  BuyerFitPreference,
  BuyerSuggestedMeasurementRanges,
  JacketMeasurements,
  JacketSpecs,
  Listing,
  ListingMedia,
  ListingStatus,
  PublicLocationMode,
  Role,
  ShirtSpecs,
  ShippingAddress,
  SweaterSpecs,
  TrouserMeasurements,
  TrouserSpecs,
  WaistcoatMeasurements,
  WaistcoatSpecs
} from "@/lib/types";

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string) {
  return Number(formData.get(key) || 0);
}

function currencyNumberValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) {
    return 0;
  }

  return Number(raw.replace(/[$,\s]/g, ""));
}

function optionalNumberValue(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (raw === null) {
    return null;
  }

  const value = String(raw).trim();
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function buildSellerGarmentMeasurementInputs(
  category: Listing["category"],
  jacketMeasurements: JacketMeasurements | null,
  waistcoatMeasurements: WaistcoatMeasurements | null,
  trouserMeasurements: TrouserMeasurements | null
) {
  return {
    jacketMeasurements:
      category === "jacket" || category === "two_piece_suit" || category === "three_piece_suit"
        ? jacketMeasurements
        : null,
    shirtMeasurements: category === "shirt" ? jacketMeasurements : null,
    coatMeasurements: category === "coat" ? jacketMeasurements : null,
    sweaterMeasurements: category === "sweater" ? jacketMeasurements : null,
    waistcoatMeasurements,
    trouserMeasurements
  };
}

function redirectWithSellerMeasurementWarnings(
  basePath: string,
  sanityCheck: BuyerBodyMeasurementSanityCheckResult,
  sellerListingDraft?: string,
  sellerListingMedia?: string
): never {
  const params = new URLSearchParams();
  params.set("measurementWarnings", encodeURIComponent(JSON.stringify(sanityCheck)));
  if (sellerListingDraft) {
    params.set("sellerListingDraft", encodeURIComponent(sellerListingDraft));
  }
  if (sellerListingMedia) {
    params.set("sellerListingMedia", encodeURIComponent(sellerListingMedia));
  }
  redirect(`${basePath}${basePath.includes("?") ? "&" : "?"}${params.toString()}`);
}

type SellerListingDraft = Record<string, string>;

function serializeSellerListingDraft(formData: FormData): string {
  const draft: SellerListingDraft = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      continue;
    }

    draft[key] = String(value);
  }

  return JSON.stringify(draft);
}

function parseSellerListingDraft(raw: string): SellerListingDraft {
  return JSON.parse(decodeURIComponent(raw)) as SellerListingDraft;
}

function parseSellerListingMedia(raw: string): ListingMedia[] {
  return JSON.parse(decodeURIComponent(raw)) as ListingMedia[];
}

function sellerDraftStringValue(draft: SellerListingDraft, key: string) {
  return String(draft[key] || "").trim();
}

function sellerDraftNumberValue(draft: SellerListingDraft, key: string) {
  return Number(draft[key] || 0);
}

function sellerDraftOptionalNumberValue(draft: SellerListingDraft, key: string) {
  const raw = String(draft[key] || "").trim();
  return raw ? Number(raw) : null;
}

function resolvedDraftListingBrand(draft: SellerListingDraft) {
  return resolveListingBrandInput(
    sellerDraftStringValue(draft, "brand"),
    sellerDraftStringValue(draft, "brandQuery")
  ).storedBrand;
}

function resolvedSubmittedListingBrand(formData: FormData) {
  return resolveListingBrandInput(
    stringValue(formData, "brand"),
    stringValue(formData, "brandQuery")
  ).storedBrand;
}

function resolvedDraftListingCountry(draft: SellerListingDraft) {
  return resolveListingCountryInput(
    sellerDraftStringValue(draft, "countryOfOrigin"),
    sellerDraftStringValue(draft, "countryOfOriginQuery")
  ).storedCountry;
}

function resolvedSubmittedListingCountry(formData: FormData) {
  return resolveListingCountryInput(
    stringValue(formData, "countryOfOrigin"),
    stringValue(formData, "countryOfOriginQuery")
  ).storedCountry;
}

function buildListingPayloadFromDraft(
  draft: SellerListingDraft,
  media: ListingMedia[],
  sellerLocation: string,
  status: ListingStatus
) {
  const category = sellerDraftStringValue(draft, "category") as
    | "jacket"
    | "two_piece_suit"
    | "three_piece_suit"
    | "waistcoat"
    | "trousers"
    | "coat"
    | "shirt"
    | "sweater";

  const jacketMeasurements: JacketMeasurements | null = hasJacket(category)
    ? {
        neck: sellerDraftOptionalNumberValue(draft, "jacketNeck") ?? undefined,
        chest: sellerDraftNumberValue(draft, "jacketChest"),
        waist: sellerDraftNumberValue(draft, "jacketWaist"),
        shoulders: sellerDraftNumberValue(draft, "jacketShoulders"),
        bodyLength: sellerDraftNumberValue(draft, "jacketBodyLength"),
        sleeveLength: sellerDraftNumberValue(draft, "jacketArmLength"),
        sleeveLengthAllowance:
          hasShirt(category) || hasSweater(category) ? 0 : sellerDraftNumberValue(draft, "jacketArmLengthAllowance")
      }
    : null;

  const jacketSpecs: JacketSpecs | null = hasJacket(category) && !hasShirt(category) && !hasSweater(category)
    ? {
        cut: sellerDraftStringValue(draft, "jacketCut") as JacketSpecs["cut"],
        lapel: sellerDraftStringValue(draft, "jacketLapel") as JacketSpecs["lapel"],
        buttonStyle: sellerDraftStringValue(draft, "jacketButtonStyle") as JacketSpecs["buttonStyle"],
        ventStyle: sellerDraftStringValue(draft, "jacketVentStyle") as JacketSpecs["ventStyle"],
        canvas: sellerDraftStringValue(draft, "jacketCanvas") as JacketSpecs["canvas"],
        lining: sellerDraftStringValue(draft, "jacketLining") as JacketSpecs["lining"],
        formal: sellerDraftStringValue(draft, "jacketFormal") as JacketSpecs["formal"]
      }
    : null;
  const shirtSpecs: ShirtSpecs | null = hasShirt(category)
    ? {
        collarStyle: sellerDraftStringValue(draft, "shirtCollarStyle") as ShirtSpecs["collarStyle"],
        cuffStyle: sellerDraftStringValue(draft, "shirtCuffStyle") as ShirtSpecs["cuffStyle"],
        placket: sellerDraftStringValue(draft, "shirtPlacket") as ShirtSpecs["placket"]
      }
    : null;
  const sweaterSpecs: SweaterSpecs | null = hasSweater(category)
    ? {
        neckline: sellerDraftStringValue(draft, "sweaterNeckline") as SweaterSpecs["neckline"],
        closure: sellerDraftStringValue(draft, "sweaterClosure") as SweaterSpecs["closure"]
      }
    : null;
  const waistcoatMeasurements: WaistcoatMeasurements | null = hasWaistcoat(category)
    ? {
        chest: sellerDraftNumberValue(draft, "waistcoatChest"),
        waist: sellerDraftNumberValue(draft, "waistcoatWaist"),
        shoulders: sellerDraftNumberValue(draft, "waistcoatShoulders"),
        bodyLength: sellerDraftNumberValue(draft, "waistcoatBodyLength")
      }
    : null;
  const waistcoatSpecs: WaistcoatSpecs | null = hasWaistcoat(category)
    ? {
        cut: sellerDraftStringValue(draft, "waistcoatCut") as WaistcoatSpecs["cut"],
        lapel: sellerDraftStringValue(draft, "waistcoatLapel") as WaistcoatSpecs["lapel"],
        formal: sellerDraftStringValue(draft, "waistcoatFormal") as WaistcoatSpecs["formal"]
      }
    : null;
  const trouserMeasurements: TrouserMeasurements | null = hasTrousers(category)
    ? {
        waist: sellerDraftNumberValue(draft, "trouserWaist"),
        waistAllowance: sellerDraftNumberValue(draft, "trouserWaistAllowance"),
        hips: sellerDraftNumberValue(draft, "trouserHips"),
        inseam: sellerDraftNumberValue(draft, "trouserInseam"),
        inseamOutseamAllowance: sellerDraftNumberValue(draft, "trouserInseamOutseamAllowance"),
        outseam: sellerDraftNumberValue(draft, "trouserOutseam"),
        opening: sellerDraftNumberValue(draft, "trouserOpening")
      }
    : null;
  const trouserSpecs: TrouserSpecs | null = hasTrousers(category)
    ? {
        cut: sellerDraftStringValue(draft, "trouserCut") as TrouserSpecs["cut"],
        front: sellerDraftStringValue(draft, "trouserFront") as TrouserSpecs["front"],
        formal: sellerDraftStringValue(draft, "trouserFormal") as TrouserSpecs["formal"]
      }
    : null;

  const primaryChest = jacketMeasurements?.chest ?? waistcoatMeasurements?.chest ?? 0;
  const primaryShoulder = jacketMeasurements?.shoulders ?? waistcoatMeasurements?.shoulders ?? 0;
  const primaryWaist = trouserMeasurements?.waist ?? jacketMeasurements?.waist ?? waistcoatMeasurements?.waist ?? 0;
  const primarySleeve = jacketMeasurements?.sleeveLength ?? 0;
  const primaryInseam = trouserMeasurements?.inseam ?? 0;
  const primaryOutseam = trouserMeasurements?.outseam ?? 0;
  const sizeLabel =
    combineSplitSize(sellerDraftStringValue(draft, "sizeLabelPartOne"), sellerDraftStringValue(draft, "sizeLabelPartTwo")) ||
    sellerDraftStringValue(draft, "sizeLabel");
  const trouserSizeLabel =
    combineSplitSize(
      sellerDraftStringValue(draft, "trouserSizeLabelPartOne"),
      sellerDraftStringValue(draft, "trouserSizeLabelPartTwo")
    ) || sellerDraftStringValue(draft, "trouserSizeLabel");

  return {
    category,
    input: {
      title: sellerDraftStringValue(draft, "title"),
      brand: resolvedDraftListingBrand(draft),
      category,
      sizeLabel,
      trouserSizeLabel,
      chest: primaryChest,
      shoulder: primaryShoulder,
      waist: primaryWaist,
      sleeve: primarySleeve,
      inseam: primaryInseam,
      outseam: primaryOutseam,
      material: sellerDraftStringValue(draft, "material") as Listing["material"],
      pattern: sellerDraftStringValue(draft, "pattern") as Listing["pattern"],
      primaryColor: sellerDraftStringValue(draft, "primaryColor") as Listing["primaryColor"],
      countryOfOrigin: resolvedDraftListingCountry(draft) as Listing["countryOfOrigin"],
      lapel: (jacketSpecs?.lapel === "shawl" || jacketSpecs?.lapel === "peak" || jacketSpecs?.lapel === "notch"
        ? jacketSpecs.lapel
        : waistcoatSpecs?.lapel === "shawl" || waistcoatSpecs?.lapel === "peak" || waistcoatSpecs?.lapel === "notch"
          ? waistcoatSpecs.lapel
          : "notch") as "notch" | "peak" | "shawl",
      fabricWeight: (sellerDraftStringValue(draft, "fabricWeight") || "medium") as Listing["fabricWeight"],
      fabricType: sellerDraftStringValue(draft, "fabricType") as Listing["fabricType"],
      fabricWeave: (sellerDraftStringValue(draft, "fabricWeave") || "na") as Listing["fabricWeave"],
      condition: sellerDraftStringValue(draft, "condition") as Listing["condition"],
      vintage: (sellerDraftStringValue(draft, "vintage") || "modern") as Listing["vintage"],
      returnsAccepted: sellerDraftStringValue(draft, "returnsAccepted") === "yes",
      allowOffers: sellerDraftStringValue(draft, "allowOffers") === "yes",
      price: sellerDraftNumberValue(draft, "price"),
      shippingPrice: estimateShippingCost(category, sizeLabel),
      shippingIncluded: false as const,
      shippingMethod: "ship" as const,
      processingDays: 3,
      location: sellerLocation,
      distanceMiles: estimateTailoringDistanceFromSellerLocation(sellerLocation),
      description: sellerDraftStringValue(draft, "description"),
      media,
      jacketMeasurements,
      jacketSpecs,
      shirtSpecs,
      sweaterSpecs,
      waistcoatMeasurements,
      waistcoatSpecs,
      trouserMeasurements,
      trouserSpecs,
      status
    }
  };
}

function isCheckedValue(formData: FormData, key: string) {
  return stringValue(formData, key) === "yes";
}

function draftNumberValue(draft: Record<string, unknown>, key: string) {
  const raw = draft[key];
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const numeric = Number(raw);
  return Number.isNaN(numeric) ? null : numeric;
}

function parseDraftPayload(value: string) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeUsPhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  return digits.length === 10 ? `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null;
}

type BuyerMeasurementCategoryKey =
  | "jacketMeasurements"
  | "shirtMeasurements"
  | "waistcoatMeasurements"
  | "trouserMeasurements"
  | "coatMeasurements"
  | "sweaterMeasurements";

type BuyerSuggestedCategoryKey =
  Exclude<keyof BuyerSuggestedMeasurementRanges, "fitPreference">;

const BUYER_MEASUREMENT_CATEGORY_MAP: Record<BuyerMeasurementCategoryKey, BuyerSuggestedCategoryKey> = {
  jacketMeasurements: "jacket",
  shirtMeasurements: "shirt",
  waistcoatMeasurements: "waistcoat",
  trouserMeasurements: "trousers",
  coatMeasurements: "coat",
  sweaterMeasurements: "sweater"
};

function mergeBuyerGeneratedMeasurements(
  buyerProfile: BuyerProfile,
  generated: {
    jacketMeasurements: BuyerProfile["jacketMeasurements"];
    shirtMeasurements: BuyerProfile["shirtMeasurements"];
    waistcoatMeasurements: BuyerProfile["waistcoatMeasurements"];
    trouserMeasurements: BuyerProfile["trouserMeasurements"];
    coatMeasurements: BuyerProfile["coatMeasurements"];
    sweaterMeasurements: BuyerProfile["sweaterMeasurements"];
    suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges | null;
  },
  fillMissingOnly: boolean,
  preservedCategories: BuyerMeasurementCategoryKey[] = []
) {
  if (!fillMissingOnly) {
    return generated;
  }

  const isMissingValue = (value: unknown) =>
    value === null || value === undefined || (typeof value === "number" && value === 0);

  const mergeObjectFields = <T extends Record<string, unknown> | null>(
    existingObject: T,
    generatedObject: T,
    preserveWholeObject = false
  ): T => {
    if (preserveWholeObject) {
      return existingObject;
    }

    if (!existingObject) {
      return generatedObject;
    }

    if (!generatedObject) {
      return existingObject;
    }

    const mergedEntries = Object.keys(generatedObject).map((key) => {
      const existingValue = (existingObject as Record<string, unknown>)[key];
      const generatedValue = (generatedObject as Record<string, unknown>)[key];

      return [key, isMissingValue(existingValue) ? generatedValue : existingValue] as const;
    });

    return Object.fromEntries(mergedEntries) as T;
  };

  const preserved = new Set<BuyerMeasurementCategoryKey>(preservedCategories);
  const mergedMeasurements = {
    jacketMeasurements: null as BuyerProfile["jacketMeasurements"],
    shirtMeasurements: null as BuyerProfile["shirtMeasurements"],
    waistcoatMeasurements: null as BuyerProfile["waistcoatMeasurements"],
    trouserMeasurements: null as BuyerProfile["trouserMeasurements"],
    coatMeasurements: null as BuyerProfile["coatMeasurements"],
    sweaterMeasurements: null as BuyerProfile["sweaterMeasurements"]
  };

  (Object.keys(BUYER_MEASUREMENT_CATEGORY_MAP) as BuyerMeasurementCategoryKey[]).forEach((key) => {
    const existingMeasurement = buyerProfile[key];
    const generatedMeasurement = generated[key];
    mergedMeasurements[key] = mergeObjectFields(existingMeasurement, generatedMeasurement, preserved.has(key));
  });

  const existingRanges = buyerProfile.suggestedMeasurementRanges;
  const generatedRanges = generated.suggestedMeasurementRanges;
  const mergedRanges: BuyerSuggestedMeasurementRanges | null =
    existingRanges || generatedRanges
        ? {
          fitPreference: generatedRanges?.fitPreference ?? existingRanges?.fitPreference ?? buyerProfile.fitPreference,
          jacket: mergeObjectFields(existingRanges?.jacket ?? null, generatedRanges?.jacket ?? null, preserved.has("jacketMeasurements")),
          shirt: mergeObjectFields(existingRanges?.shirt ?? null, generatedRanges?.shirt ?? null, preserved.has("shirtMeasurements")),
          waistcoat: mergeObjectFields(existingRanges?.waistcoat ?? null, generatedRanges?.waistcoat ?? null, preserved.has("waistcoatMeasurements")),
          trousers: mergeObjectFields(existingRanges?.trousers ?? null, generatedRanges?.trousers ?? null, preserved.has("trouserMeasurements")),
          coat: mergeObjectFields(existingRanges?.coat ?? null, generatedRanges?.coat ?? null, preserved.has("coatMeasurements")),
          sweater: mergeObjectFields(existingRanges?.sweater ?? null, generatedRanges?.sweater ?? null, preserved.has("sweaterMeasurements"))
        }
      : null;

  return {
    ...mergedMeasurements,
    suggestedMeasurementRanges: mergedRanges
  };
}

function withUpdatedQueryParam(path: string, key: string, value: string) {
  const [pathname, query = ""] = path.split("?", 2);
  const params = new URLSearchParams(query);
  params.set(key, value);
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function withUpdatedQueryParams(path: string, updates: Record<string, string | null | undefined>) {
  const [pathname, query = ""] = path.split("?", 2);
  const params = new URLSearchParams(query);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function passwordValidationError(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  return null;
}

function validateMessageBody(body: string) {
  if (!body) {
    return "Enter a message before sending";
  }

  if (body.length > 1000) {
    return "Message body must be 1000 characters or fewer";
  }

  return null;
}

function buildSavedSearchName(queryString: string, existingSearches: Array<{ queryString: string }>) {
  const params = new URLSearchParams(queryString);
  const keyword = params.get("q")?.trim();

  if (keyword) {
    return keyword.length > 60 ? `${keyword.slice(0, 57)}...` : keyword;
  }

  const keywordlessCount = existingSearches.filter((savedSearch) => {
    const savedParams = new URLSearchParams(savedSearch.queryString);
    return !savedParams.get("q")?.trim();
  }).length;

  return `Saved Search ${keywordlessCount + 1}`;
}

function serializeMarketplaceSearchForm(formData: FormData) {
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      continue;
    }

    if (!value) {
      continue;
    }

    if (key === "page" || key === "queryString" || key === "returnTo" || key === "savedSearchId") {
      continue;
    }

    params.append(key, value);
  }

  params.delete("page");
  return params.toString();
}

function validateMessageSubject(subject: string) {
  if (!subject) {
    return "Enter a subject before sending";
  }

  if (subject.length > 60) {
    return "Subject must be 60 characters or fewer";
  }

  return null;
}

function validateOfferAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a valid offer amount";
  }

  return null;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function reviewHasDetailedContent(review: {
  measurementRating: number | null;
  conditionRating: number | null;
  shippingRating: number | null;
  communicationRating: number | null;
  feedback: string;
}) {
  return Boolean(
    review.measurementRating ||
      review.conditionRating ||
      review.shippingRating ||
      review.communicationRating ||
      review.feedback.trim()
  );
}

async function issuePasswordResetPreview(userId: string) {
  const rawToken = randomUUID();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
  await createPasswordResetToken(userId, tokenHash, expiresAt);
  return `${getAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

async function issueEmailVerificationLink(userId: string) {
  const rawToken = randomUUID();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await createEmailVerificationToken(userId, tokenHash, expiresAt);
  return `${getAppUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function buildBuyerTopMeasurementsFromGetter(
  getter: (key: string) => number | null,
  prefix: string,
  includeNeck = false
) {
  const neck = includeNeck ? getter(`${prefix}Neck`) : null;
  const chest = getter(`${prefix}Chest`);
  const waist = getter(`${prefix}Waist`);
  const shoulders = getter(`${prefix}Shoulders`);
  const bodyLength = getter(`${prefix}BodyLength`);
  const sleeveLength = getter(`${prefix}ArmLength`);

  if ([neck, chest, waist, shoulders, bodyLength, sleeveLength].every((value) => value === null)) {
    return null;
  }

  return {
    ...(includeNeck && neck !== null ? { neck } : {}),
    ...(chest !== null ? { chest } : {}),
    ...(waist !== null ? { waist } : {}),
    ...(shoulders !== null ? { shoulders } : {}),
    ...(bodyLength !== null ? { bodyLength } : {}),
    ...(sleeveLength !== null ? { sleeveLength, sleeveLengthAllowance: 0 } : {})
  } as BuyerJacketMeasurements;
}

function buildBuyerWaistcoatMeasurementsFromGetter(getter: (key: string) => number | null) {
  const chest = getter("buyerWaistcoatChest");
  const waist = getter("buyerWaistcoatWaist");
  const shoulders = getter("buyerWaistcoatShoulders");
  const bodyLength = getter("buyerWaistcoatBodyLength");

  if ([chest, waist, shoulders, bodyLength].every((value) => value === null)) {
    return null;
  }

  return {
    ...(chest !== null ? { chest } : {}),
    ...(waist !== null ? { waist } : {}),
    ...(shoulders !== null ? { shoulders } : {}),
    ...(bodyLength !== null ? { bodyLength } : {})
  } as BuyerWaistcoatMeasurements;
}

function buildBuyerTrouserMeasurementsFromGetter(getter: (key: string) => number | null) {
  const waist = getter("buyerTrouserWaist");
  const hips = getter("buyerTrouserHips");
  const inseam = getter("buyerTrouserInseam");
  const outseam = getter("buyerTrouserOutseam");
  const opening = getter("buyerTrouserOpening");

  if ([waist, hips, inseam, outseam, opening].every((value) => value === null)) {
    return null;
  }

  return {
    ...(waist !== null ? { waist, waistAllowance: 0 } : {}),
    ...(hips !== null ? { hips } : {}),
    ...(inseam !== null ? { inseam, inseamOutseamAllowance: 0 } : {}),
    ...(outseam !== null ? { outseam } : {}),
    ...(opening !== null ? { opening } : {})
  } as BuyerTrouserMeasurements;
}

function collectBuyerMeasurementDraft(formData: FormData) {
  const keys = [
    "buyerJacketChest",
    "buyerJacketWaist",
    "buyerJacketShoulders",
    "buyerJacketBodyLength",
    "buyerJacketArmLength",
    "buyerWaistcoatChest",
    "buyerWaistcoatWaist",
    "buyerWaistcoatShoulders",
    "buyerWaistcoatBodyLength",
    "buyerTrouserWaist",
    "buyerTrouserHips",
    "buyerTrouserInseam",
    "buyerTrouserOutseam",
    "buyerTrouserOpening",
    "buyerCoatChest",
    "buyerCoatWaist",
    "buyerCoatShoulders",
    "buyerCoatBodyLength",
    "buyerCoatArmLength",
    "buyerShirtNeck",
    "buyerShirtChest",
    "buyerShirtWaist",
    "buyerShirtShoulders",
    "buyerShirtBodyLength",
    "buyerShirtArmLength",
    "buyerSweaterChest",
    "buyerSweaterWaist",
    "buyerSweaterShoulders",
    "buyerSweaterBodyLength",
    "buyerSweaterArmLength"
  ] as const;

  return Object.fromEntries(
    keys
      .map((key) => [key, stringValue(formData, key)] as const)
      .filter(([, value]) => value !== "")
  );
}

function usernameValidationError(username: string) {
  if (!username) {
    return "Username is required";
  }

  if (!/^[a-z0-9_-]+$/.test(username)) {
    return "Username can only use lowercase letters, numbers, hyphens, and underscores";
  }

  if (username.length < 3) {
    return "Username must be at least 3 characters";
  }

  if (username.length > 30) {
    return "Username must be 30 characters or fewer";
  }

  return null;
}

function isValidPublicLocationMode(value: string): value is PublicLocationMode {
  return ["hidden", "city_state_country", "state_country", "country"].includes(value);
}

function isValidBuyerFitPreference(value: string): value is BuyerFitPreference {
  return ["trim", "classic", "relaxed"].includes(value);
}

function reorderFilesFromManifest(formData: FormData, files: File[]) {
  const manifestValue = formData.get("mediaManifest");

  if (typeof manifestValue !== "string" || !manifestValue.trim()) {
    return files;
  }

  try {
    const manifest = JSON.parse(manifestValue) as Array<{
      name: string;
      size: number;
      type: string;
      order: number;
    }>;
    const remaining = [...files];

    return manifest
      .sort((a, b) => a.order - b.order)
      .map((entry) => {
        const matchIndex = remaining.findIndex(
          (file) => file.name === entry.name && file.size === entry.size && file.type === entry.type
        );

        if (matchIndex === -1) {
          return null;
        }

        const [match] = remaining.splice(matchIndex, 1);
        return match;
      })
      .filter((file): file is File => Boolean(file));
  } catch {
    return files;
  }
}

function buildShippingAddress(formData: FormData): ShippingAddress {
  return {
    fullName: stringValue(formData, "shippingFullName"),
    line1: stringValue(formData, "shippingLine1"),
    line2: stringValue(formData, "shippingLine2"),
    city: stringValue(formData, "shippingCity"),
    state: stringValue(formData, "shippingState"),
    postalCode: stringValue(formData, "shippingPostalCode"),
    country: stringValue(formData, "shippingCountry") || "US"
  };
}

function validateShippingAddress(address: ShippingAddress) {
  return Boolean(
    address.fullName &&
      address.line1 &&
      address.city &&
      address.state &&
      address.postalCode &&
      address.country
  );
}

function getStoredBuyerAddresses(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) {
    return [];
  }

  const addresses =
    user.buyerProfile.addresses.length > 0 ? user.buyerProfile.addresses : [user.buyerProfile.address];

  return addresses.filter((address) =>
    Boolean(address.line1 && address.city && address.state && address.postalCode && address.country)
  );
}

async function maybeSaveCheckoutAddress(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  shippingAddress: ShippingAddress,
  shouldSave: boolean
) {
  if (!shouldSave) {
    return;
  }

  const existingAddresses = getStoredBuyerAddresses(user);
  const alreadyExists = existingAddresses.some(
    (address) =>
      address.fullName === shippingAddress.fullName &&
      address.line1 === shippingAddress.line1 &&
      address.line2 === shippingAddress.line2 &&
      address.city === shippingAddress.city &&
      address.state === shippingAddress.state &&
      address.postalCode === shippingAddress.postalCode &&
      address.country === shippingAddress.country
  );

  if (alreadyExists) {
    return;
  }

  const nextAddresses = [...existingAddresses, shippingAddress];

  await updateBuyerAccount(user.id, {
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    zipCode: user.buyerProfile.zipCode,
    location: user.buyerProfile.location,
    address: nextAddresses[0] || shippingAddress,
    addresses: nextAddresses,
    businessName: user.businessName,
    profileDescription: user.profileDescription,
    showPersonalNameOnProfile: user.showPersonalNameOnProfile,
    showBusinessNameOnProfile: user.showBusinessNameOnProfile,
    publicLocationMode: user.publicLocationMode
  });
}

async function resolveCheckoutShippingAddress(
  formData: FormData,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  const selectedAddress = stringValue(formData, "shippingAddressSelection");
  const storedAddresses = getStoredBuyerAddresses(user);

  if (selectedAddress.startsWith("saved:")) {
    const addressIndex = Number(selectedAddress.replace("saved:", ""));
    const shippingAddress = storedAddresses[addressIndex];

    if (!shippingAddress) {
      redirect("/cart?checkoutError=Choose+a+valid+saved+address");
    }

    return shippingAddress;
  }

  const shippingAddress = buildShippingAddress(formData);
  if (!validateShippingAddress(shippingAddress)) {
    redirect("/cart?checkoutError=Please+complete+the+shipping+address");
  }

  await maybeSaveCheckoutAddress(user, shippingAddress, stringValue(formData, "saveAddressToAccount") === "yes");
  return shippingAddress;
}

function listingStatusFromIntent(intent: string): ListingStatus {
  return intent === "save_draft" ? "draft" : "active";
}

function hasJacket(category: string) {
  return ["jacket", "two_piece_suit", "three_piece_suit", "coat", "shirt", "sweater"].includes(category);
}

function hasShirt(category: string) {
  return category === "shirt";
}

function hasSweater(category: string) {
  return category === "sweater";
}

function hasWaistcoat(category: string) {
  return ["three_piece_suit", "waistcoat"].includes(category);
}

function hasTrousers(category: string) {
  return ["two_piece_suit", "three_piece_suit", "trousers"].includes(category);
}

function redirectIfDatabaseUnavailable(path = "/?authError=Hosted+database+not+configured") {
  if (!isDatabaseConfigured()) {
    redirect(path);
  }
}

function validatePublishedListing(formData: FormData, category: string, mediaCount: number) {
  const requiredGeneralFields = [
    "title",
    "category",
    "material",
    "pattern",
    "primaryColor",
    "condition",
    "vintage",
    "countryOfOrigin",
    "price",
    "returnsAccepted",
    "allowOffers"
  ];

  const missingGeneralField = requiredGeneralFields.find((field) => !stringValue(formData, field));
  if (missingGeneralField) {
    return "Complete all required listing details before publishing";
  }

  if (mediaCount < 1) {
    return "Add at least one photo before publishing";
  }

  if (hasShirt(category)) {
      const requiredShirtFields = [
        "jacketNeck",
        "jacketChest",
        "jacketWaist",
        "jacketShoulders",
      "jacketBodyLength",
      "jacketArmLength",
      "shirtCollarStyle",
      "shirtCuffStyle",
      "shirtPlacket"
    ];

    if (requiredShirtFields.some((field) => !stringValue(formData, field))) {
      return "Complete all required shirt measurements and specifications before publishing";
    }
  } else if (hasSweater(category)) {
    const requiredSweaterFields = [
      "jacketChest",
      "jacketWaist",
      "jacketShoulders",
      "jacketBodyLength",
      "jacketArmLength",
      "sweaterNeckline",
      "sweaterClosure"
    ];

    if (requiredSweaterFields.some((field) => !stringValue(formData, field))) {
      return "Complete all required sweater measurements and specifications before publishing";
    }
  } else if (hasJacket(category)) {
    const requiredJacketFields = [
      "jacketChest",
      "jacketWaist",
      "jacketShoulders",
      "jacketBodyLength",
      "jacketArmLength",
      "jacketCut",
      "jacketLapel",
          "jacketButtonStyle",
          "jacketVentStyle"
    ];

    if (requiredJacketFields.some((field) => !stringValue(formData, field))) {
      return "Complete all required jacket measurements and specifications before publishing";
    }
  }

  if (hasWaistcoat(category)) {
    const requiredWaistcoatFields = [
      "waistcoatChest",
      "waistcoatWaist",
      "waistcoatShoulders",
      "waistcoatBodyLength",
      "waistcoatCut",
      "waistcoatLapel"
    ];

    if (requiredWaistcoatFields.some((field) => !stringValue(formData, field))) {
      return "Complete all required waistcoat measurements and specifications before publishing";
    }
  }

  if (hasTrousers(category)) {
    const requiredTrouserFields = [
      "trouserWaist",
      "trouserHips",
      "trouserInseam",
      "trouserOutseam",
      "trouserOpening",
      "trouserCut",
      "trouserFront"
    ];

    if (requiredTrouserFields.some((field) => !stringValue(formData, field))) {
      return "Complete all required trouser measurements and specifications before publishing";
    }
  }

  return null;
}

export async function signUpAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/signup?authError=Add+DATABASE_URL+to+enable+signups");
  const name = stringValue(formData, "name");
  const rawUsername = stringValue(formData, "username").toLowerCase();
  const username = normalizeUsername(rawUsername);
  const email = stringValue(formData, "email").toLowerCase();
  const password = stringValue(formData, "password");
  const confirmPassword = stringValue(formData, "confirmPassword");

  if (!name || !username || !email || !password || !confirmPassword) {
    redirect("/signup?authError=Missing+required+signup+fields");
  }

  const usernameError = usernameValidationError(username);
  if (usernameError) {
    redirect(`/signup?authError=${encodeURIComponent(usernameError)}`);
  }

  if (rawUsername !== username) {
    redirect("/signup?authError=Username+can+only+use+lowercase+letters,+numbers,+hyphens,+and+underscores");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    redirect("/signup?authError=Account+already+exists");
  }

  const existingUsername = await findUserByUsername(username);
  if (existingUsername) {
    redirect("/signup?authError=Username+is+already+taken");
  }

  const passwordError = passwordValidationError(password);
  if (passwordError) {
    redirect(`/signup?authError=${encodeURIComponent(passwordError)}`);
  }

  if (password !== confirmPassword) {
    redirect("/signup?authError=Passwords+do+not+match");
  }

  const user = await createUser({
    name,
    username,
    email,
    role: "both",
    passwordHash: hashPassword(password)
  });

  const verificationUrl = await issueEmailVerificationLink(user.id);
  await sendEmailVerificationNotification({
    user,
    verificationUrl
  });

  await createSession(user.id);
  revalidatePath("/");
  redirect("/?saved=account-created");
}

export async function loginAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/?authError=Add+DATABASE_URL+to+enable+login");
  const identifier = stringValue(formData, "username").toLowerCase();
  const username = normalizeUsername(identifier);
  const password = stringValue(formData, "password");
  const user = identifier.includes("@")
    ? await findUserByEmail(identifier)
    : await findUserByUsername(username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?authError=Invalid+username,+email,+or+password");
  }

  await createSession(user.id);
  revalidatePath("/");
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  revalidatePath("/");
  redirect("/");
}

export async function changePasswordAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/account/security?authError=Add+DATABASE_URL+to+manage+passwords");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+manage+your+password");
  }

  const currentPassword = stringValue(formData, "currentPassword");
  const newPassword = stringValue(formData, "newPassword");
  const confirmPassword = stringValue(formData, "confirmPassword");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/account/security/password?authError=Complete+all+password+fields");
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    redirect("/account/security/password?authError=Current+password+is+incorrect");
  }

  const validationError = passwordValidationError(newPassword);
  if (validationError) {
    redirect(`/account/security/password?authError=${encodeURIComponent(validationError)}`);
  }

  if (newPassword !== confirmPassword) {
    redirect("/account/security/password?authError=New+passwords+do+not+match");
  }

  if (verifyPassword(newPassword, user.passwordHash)) {
    redirect("/account/security/password?authError=Choose+a+new+password+that+is+different+from+your+current+password");
  }

  await updateUserPassword(user.id, hashPassword(newPassword));
  await clearPasswordResetTokensForUser(user.id);
  revalidatePath("/account/security");
  revalidatePath("/account/security/password");
  redirect("/account/security?saved=password");
}

export async function changeUsernameAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/account/security?authError=Add+DATABASE_URL+to+manage+usernames");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+manage+your+username");
  }

  const currentPassword = stringValue(formData, "currentPassword");
  const rawUsername = stringValue(formData, "username").toLowerCase();
  const username = normalizeUsername(rawUsername);

  if (!currentPassword || !username) {
    redirect("/account/security/username?authError=Complete+all+username+fields");
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    redirect("/account/security/username?authError=Current+password+is+incorrect");
  }

  const usernameError = usernameValidationError(username);
  if (usernameError) {
    redirect(`/account/security/username?authError=${encodeURIComponent(usernameError)}`);
  }

  if (rawUsername !== username) {
    redirect("/account/security/username?authError=Username+can+only+use+lowercase+letters,+numbers,+hyphens,+and+underscores");
  }

  if (username === user.username) {
    redirect("/account/security/username?authError=Choose+a+different+username");
  }

  const existingUser = await findUserByUsername(username);
  if (existingUser && existingUser.id !== user.id) {
    redirect("/account/security/username?authError=Username+is+already+taken");
  }

  await updateUsername(user.id, username);
  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/account/security");
  revalidatePath("/account/security/username");
  revalidatePath("/users");
  revalidatePath(`/users/${user.username}`);
  revalidatePath(`/users/${username}`);
  redirect("/account/security?saved=username");
}

export async function changeEmailAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/account/security?authError=Add+DATABASE_URL+to+manage+email");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+manage+your+email");
  }

  const currentPassword = stringValue(formData, "currentPassword");
  const email = stringValue(formData, "email").toLowerCase();
  const confirmEmail = stringValue(formData, "confirmEmail").toLowerCase();

  if (!currentPassword || !email || !confirmEmail) {
    redirect("/account/security/email?authError=Complete+all+email+fields");
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    redirect("/account/security/email?authError=Current+password+is+incorrect");
  }

  if (email !== confirmEmail) {
    redirect("/account/security/email?authError=Email+addresses+do+not+match");
  }

  if (email === user.email) {
    redirect("/account/security/email?authError=Choose+a+different+email+address");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser && existingUser.id !== user.id) {
    redirect("/account/security/email?authError=Email+address+is+already+in+use");
  }

  await updateUserEmail(user.id, email);
  await clearEmailVerificationTokensForUser(user.id);
  const verificationUrl = await issueEmailVerificationLink(user.id);
  await sendEmailVerificationNotification({
    user: {
      ...user,
      email,
      emailVerified: false
    },
    verificationUrl
  });
  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/account/security");
  revalidatePath("/account/security/email");
  redirect("/account/security?saved=email-verification");
}

export async function requestPasswordResetAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/forgot-password?authError=Add+DATABASE_URL+to+reset+passwords");
  const email = stringValue(formData, "email").toLowerCase();

  if (!email) {
    redirect("/forgot-password?authError=Enter+your+email+address");
  }

  const user = await findUserByEmail(email);
  let previewUrl = "";

  if (user) {
    previewUrl = await issuePasswordResetPreview(user.id);
    await sendPasswordResetNotification({
      user,
      resetUrl: previewUrl
    });
  }

  revalidatePath("/forgot-password");
  const params = new URLSearchParams({ sent: "reset" });

  if (previewUrl) {
    params.set("preview", previewUrl);
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function requestCurrentUserPasswordResetAction() {
  redirectIfDatabaseUnavailable("/account/security/password?authError=Add+DATABASE_URL+to+reset+passwords");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+reset+your+password");
  }

  const previewUrl = await issuePasswordResetPreview(user.id);
  await sendPasswordResetNotification({
    user,
    resetUrl: previewUrl
  });
  revalidatePath("/account/security/password");
  const params = new URLSearchParams({
    sent: "reset-link",
    preview: previewUrl
  });
  redirect(`/account/security/password?${params.toString()}`);
}

export async function resetPasswordAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/forgot-password?authError=Add+DATABASE_URL+to+reset+passwords");
  const token = stringValue(formData, "token");
  const newPassword = stringValue(formData, "newPassword");
  const confirmPassword = stringValue(formData, "confirmPassword");

  if (!token || !newPassword || !confirmPassword) {
    redirect("/forgot-password?authError=Reset+link+is+missing+required+details");
  }

  const validationError = passwordValidationError(newPassword);
  if (validationError) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&authError=${encodeURIComponent(validationError)}`);
  }

  if (newPassword !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&authError=New+passwords+do+not+match`);
  }

  const tokenHash = hashResetToken(token);
  const user = await findValidPasswordResetUserByTokenHash(tokenHash);

  if (!user) {
    redirect("/forgot-password?authError=That+reset+link+is+invalid+or+has+expired");
  }

  await updateUserPassword(user.id, hashPassword(newPassword));
  await markPasswordResetTokenUsed(tokenHash);
  await clearPasswordResetTokensForUser(user.id);
  revalidatePath("/buyer/security");
  redirect("/?saved=password-reset");
}

export async function resendEmailVerificationAction() {
  redirectIfDatabaseUnavailable("/account/security?authError=Add+DATABASE_URL+to+manage+email+verification");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+verify+your+email");
  }

  if (user.emailVerified) {
    redirect("/account/security?saved=email-verified");
  }

  const verificationUrl = await issueEmailVerificationLink(user.id);
  await sendEmailVerificationNotification({
    user,
    verificationUrl
  });

  revalidatePath("/account/security");
  redirect("/account/security?saved=verification-sent");
}

export async function verifyEmailAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/verify-email?authError=Add+DATABASE_URL+to+verify+email");
  const token = stringValue(formData, "token");

  if (!token) {
    redirect("/verify-email?authError=Verification+link+is+missing");
  }

  const tokenHash = hashResetToken(token);
  const user = await findValidEmailVerificationUserByTokenHash(tokenHash);

  if (!user) {
    redirect("/verify-email?authError=That+verification+link+is+invalid+or+has+expired");
  }

  await markUserEmailVerified(user.id);
  await markEmailVerificationTokenUsed(tokenHash);
  await clearEmailVerificationTokensForUser(user.id);
  revalidatePath("/");
  revalidatePath("/account/security");
  redirect("/account/security?saved=email-verified");
}

export async function dismissMarketplaceIntroAction() {
  redirectIfDatabaseUnavailable();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  await dismissMarketplaceIntro(user.id);
  revalidatePath("/");
  redirect("/");
}

export async function saveBuyerProfileAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const buyerZipCode = stringValue(formData, "buyerZipCode");
  const sanitizedBuyerZipCode = sanitizeZipCode(buyerZipCode);
  const buyerZipResult = buyerZipCode ? await resolveUsZipCode(buyerZipCode) : null;

  if (buyerZipCode && !buyerZipResult) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Enter+a+valid+US+ZIP+code"));
  }
  const jacketMeasurements = buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerJacket");
  const shirtMeasurements = buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerShirt", true);
  const waistcoatMeasurements = buildBuyerWaistcoatMeasurementsFromGetter((key) => optionalNumberValue(formData, key));
  const trouserMeasurements = buildBuyerTrouserMeasurementsFromGetter((key) => optionalNumberValue(formData, key));
  const coatMeasurements = buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerCoat");
  const sweaterMeasurements = buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerSweater");
  const fitPreferenceValue = stringValue(formData, "fitPreference");
  const fitPreference = isValidBuyerFitPreference(fitPreferenceValue)
    ? fitPreferenceValue
    : user.buyerProfile.fitPreference;
  const sanityCheck = runBuyerGarmentMeasurementSanityCheck({
    jacketMeasurements,
    shirtMeasurements,
    waistcoatMeasurements,
    trouserMeasurements,
    coatMeasurements,
    sweaterMeasurements
  });

  if (sanityCheck.status !== "ok") {
    redirect(
      withUpdatedQueryParams(returnTo, {
        buyerMeasurementReview: sanityCheck.status,
        buyerMeasurementIssues:
          sanityCheck.warnings.length > 0
            ? JSON.stringify(
                sanityCheck.warnings.map((warning) => ({
                  message: warning.message,
                  suggestion: warning.suggestion ?? null
                }))
              )
            : null,
        buyerMeasurementDraft: JSON.stringify(collectBuyerMeasurementDraft(formData))
      })
    );
  }

  await updateUser(user.id, {
    zipCode: buyerZipCode ? buyerZipResult?.zipCode ?? sanitizedBuyerZipCode ?? "" : user.buyerProfile.zipCode,
    location: buyerZipCode ? buyerZipResult?.location ?? "" : user.buyerProfile.location,
    address: user.buyerProfile.address,
    addresses: user.buyerProfile.addresses,
    height: optionalNumberValue(formData, "height") ?? user.buyerProfile.height,
    weight: optionalNumberValue(formData, "weight") ?? user.buyerProfile.weight,
    chest: user.buyerProfile.chest,
    shoulder: user.buyerProfile.shoulder,
    waist: user.buyerProfile.waist,
    sleeve: user.buyerProfile.sleeve,
    neck: optionalNumberValue(formData, "neck") ?? shirtMeasurements?.neck ?? user.buyerProfile.neck,
    inseam: user.buyerProfile.inseam,
    fitPreference,
    maxAlterationBudget:
      optionalNumberValue(formData, "maxAlterationBudget") ?? user.buyerProfile.maxAlterationBudget,
    searchRadius: optionalNumberValue(formData, "searchRadius") ?? user.buyerProfile.searchRadius,
    jacketMeasurements,
    shirtMeasurements,
    waistcoatMeasurements,
    trouserMeasurements,
    coatMeasurements,
    sweaterMeasurements,
      suggestedMeasurementRanges: user.buyerProfile.suggestedMeasurementRanges
    });

    revalidatePath("/");
    revalidatePath("/buyer");
    revalidatePath("/buyer/measurements");
    redirect(withUpdatedQueryParams(returnTo, { saved: "user measurements", buyerMeasurementReview: null, buyerMeasurementIssues: null, buyerMeasurementDraft: null }));
}

export async function forceSaveBuyerProfileAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const draft = parseDraftPayload(stringValue(formData, "buyerMeasurementDraft"));

  const jacketMeasurements = buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerJacket");
  const shirtMeasurements = buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerShirt", true);
  const waistcoatMeasurements = buildBuyerWaistcoatMeasurementsFromGetter((key) => draftNumberValue(draft, key));
  const trouserMeasurements = buildBuyerTrouserMeasurementsFromGetter((key) => draftNumberValue(draft, key));
  const coatMeasurements = buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerCoat");
  const sweaterMeasurements = buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerSweater");

  await updateUser(user.id, {
    ...user.buyerProfile,
    jacketMeasurements,
    shirtMeasurements,
    waistcoatMeasurements,
    trouserMeasurements,
    coatMeasurements,
    sweaterMeasurements,
    suggestedMeasurementRanges: user.buyerProfile.suggestedMeasurementRanges
  });

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
  redirect(withUpdatedQueryParams(returnTo, { saved: "user measurements", buyerMeasurementReview: null, buyerMeasurementIssues: null, buyerMeasurementDraft: null }));
}

function buildBuyerMeasurementsFromFormData(formData: FormData) {
  return {
    jacketMeasurements: buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerJacket"),
    shirtMeasurements: buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerShirt", true),
    waistcoatMeasurements: buildBuyerWaistcoatMeasurementsFromGetter((key) => optionalNumberValue(formData, key)),
    trouserMeasurements: buildBuyerTrouserMeasurementsFromGetter((key) => optionalNumberValue(formData, key)),
    coatMeasurements: buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerCoat"),
    sweaterMeasurements: buildBuyerTopMeasurementsFromGetter((key) => optionalNumberValue(formData, key), "buyerSweater")
  };
}

function buildBuyerMeasurementsFromDraft(draft: Record<string, unknown>) {
  return {
    jacketMeasurements: buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerJacket"),
    shirtMeasurements: buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerShirt", true),
    waistcoatMeasurements: buildBuyerWaistcoatMeasurementsFromGetter((key) => draftNumberValue(draft, key)),
    trouserMeasurements: buildBuyerTrouserMeasurementsFromGetter((key) => draftNumberValue(draft, key)),
    coatMeasurements: buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerCoat"),
    sweaterMeasurements: buildBuyerTopMeasurementsFromGetter((key) => draftNumberValue(draft, key), "buyerSweater")
  };
}

type BuyerMeasurementCategorySaveKey =
  | "jacketMeasurements"
  | "shirtMeasurements"
  | "waistcoatMeasurements"
  | "trouserMeasurements"
  | "coatMeasurements"
  | "sweaterMeasurements";

function sanitizeBuyerMeasurementCategoryKey(value: string): BuyerMeasurementCategorySaveKey | null {
  return [
    "jacketMeasurements",
    "shirtMeasurements",
    "waistcoatMeasurements",
    "trouserMeasurements",
    "coatMeasurements",
    "sweaterMeasurements"
  ].includes(value)
    ? (value as BuyerMeasurementCategorySaveKey)
    : null;
}

function singularBuyerMeasurementIssues(
  category: BuyerMeasurementCategorySaveKey,
  allMeasurements: ReturnType<typeof buildBuyerMeasurementsFromFormData>
) {
  const empty = {
    jacketMeasurements: null,
    shirtMeasurements: null,
    waistcoatMeasurements: null,
    trouserMeasurements: null,
    coatMeasurements: null,
    sweaterMeasurements: null
  };

  return runBuyerGarmentMeasurementSanityCheck({
    ...empty,
    [category]: allMeasurements[category]
  });
}

export async function saveBuyerMeasurementCategoryAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const category = sanitizeBuyerMeasurementCategoryKey(stringValue(formData, "saveCategory"));

  if (!category) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Choose+a+valid+measurement+category+to+save"));
  }

  const allMeasurements = buildBuyerMeasurementsFromFormData(formData);
  const sanityCheck = singularBuyerMeasurementIssues(category, allMeasurements);

  if (sanityCheck.status !== "ok") {
    redirect(
      withUpdatedQueryParams(returnTo, {
        buyerMeasurementReview: sanityCheck.status,
        buyerMeasurementIssues:
          sanityCheck.warnings.length > 0
            ? JSON.stringify(
                sanityCheck.warnings.map((warning) => ({
                  message: warning.message,
                  suggestion: warning.suggestion ?? null
                }))
              )
            : null,
        buyerMeasurementDraft: JSON.stringify(collectBuyerMeasurementDraft(formData)),
        buyerMeasurementCategorySave: category
      })
    );
  }

  const nextProfile: BuyerProfile = {
    ...user.buyerProfile,
    [category]: allMeasurements[category]
  };

  if (category === "shirtMeasurements") {
    nextProfile.neck = allMeasurements.shirtMeasurements?.neck ?? user.buyerProfile.neck;
  }

  await updateUser(user.id, nextProfile);

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
  redirect(
    withUpdatedQueryParams(returnTo, {
      saved: "user measurements",
      buyerMeasurementReview: null,
      buyerMeasurementIssues: null,
      buyerMeasurementDraft: null,
      buyerMeasurementCategorySave: null
    })
  );
}

export async function forceSaveBuyerMeasurementCategoryAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const category = sanitizeBuyerMeasurementCategoryKey(stringValue(formData, "buyerMeasurementCategorySave"));
  const draft = parseDraftPayload(stringValue(formData, "buyerMeasurementDraft"));

  if (!category) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Choose+a+valid+measurement+category+to+save"));
  }

  const allMeasurements = buildBuyerMeasurementsFromDraft(draft);
  const nextProfile: BuyerProfile = {
    ...user.buyerProfile,
    [category]: allMeasurements[category]
  };

  if (category === "shirtMeasurements") {
    nextProfile.neck = allMeasurements.shirtMeasurements?.neck ?? user.buyerProfile.neck;
  }

  await updateUser(user.id, nextProfile);

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
  redirect(
    withUpdatedQueryParams(returnTo, {
      saved: "user measurements",
      buyerMeasurementReview: null,
      buyerMeasurementIssues: null,
      buyerMeasurementDraft: null,
      buyerMeasurementCategorySave: null
    })
  );
}

export async function generateBuyerMeasurementSuggestionsAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer/measurements?edit=1";
  const fitPreferenceValue = stringValue(formData, "fitPreference");
  const fitPreference = isValidBuyerFitPreference(fitPreferenceValue) ? fitPreferenceValue : "classic";
  const fillMissingOnly = isCheckedValue(formData, "fillMissingOnly");

  const suggestions = generateBuyerMeasurementSuggestions({
    height: optionalNumberValue(formData, "height"),
    weight: optionalNumberValue(formData, "weight"),
    chest: optionalNumberValue(formData, "bodyChest"),
    waist: optionalNumberValue(formData, "bodyWaist"),
    hips: optionalNumberValue(formData, "bodyHips"),
    shoulders: optionalNumberValue(formData, "bodyShoulders"),
    sleeveLength: optionalNumberValue(formData, "bodySleeve"),
    neck: optionalNumberValue(formData, "neck"),
    fitPreference
  });

  if (suggestions.sanityCheck.status !== "ok") {
    redirect(
      withUpdatedQueryParams(returnTo, {
        measurementReview: suggestions.sanityCheck.status,
        measurementIssues:
          suggestions.sanityCheck.warnings.length > 0
            ? JSON.stringify(
                suggestions.sanityCheck.warnings.map((warning) => ({
                  message: warning.message,
                  suggestion: warning.suggestion ?? null
                }))
              )
            : null,
        measurementHeight: stringValue(formData, "height") || null,
        measurementWeight: stringValue(formData, "weight") || null,
        measurementBodyChest: stringValue(formData, "bodyChest") || null,
        measurementBodyWaist: stringValue(formData, "bodyWaist") || null,
        measurementBodyHips: stringValue(formData, "bodyHips") || null,
          measurementBodyShoulders: stringValue(formData, "bodyShoulders") || null,
          measurementBodySleeve: stringValue(formData, "bodySleeve") || null,
          measurementNeck: stringValue(formData, "neck") || null,
          measurementFitPreference: fitPreference,
          measurementFillMissingOnly: fillMissingOnly ? "yes" : null
        })
      );
    }

  const mergedSuggestions = mergeBuyerGeneratedMeasurements(
    user.buyerProfile,
    {
      jacketMeasurements: suggestions.jacketMeasurements,
      shirtMeasurements: suggestions.shirtMeasurements,
      waistcoatMeasurements: suggestions.waistcoatMeasurements,
      trouserMeasurements: suggestions.trouserMeasurements,
      coatMeasurements: suggestions.coatMeasurements,
      sweaterMeasurements: suggestions.sweaterMeasurements,
      suggestedMeasurementRanges: suggestions.suggestedMeasurementRanges
    },
    fillMissingOnly
  );

  await updateUser(user.id, {
    zipCode: user.buyerProfile.zipCode,
    location: user.buyerProfile.location,
    address: user.buyerProfile.address,
    addresses: user.buyerProfile.addresses,
    height: optionalNumberValue(formData, "height") ?? user.buyerProfile.height,
    weight: optionalNumberValue(formData, "weight") ?? user.buyerProfile.weight,
    chest: optionalNumberValue(formData, "bodyChest") ?? user.buyerProfile.chest,
    shoulder: optionalNumberValue(formData, "bodyShoulders") ?? user.buyerProfile.shoulder,
    waist: optionalNumberValue(formData, "bodyWaist") ?? user.buyerProfile.waist,
    sleeve: optionalNumberValue(formData, "bodySleeve") ?? user.buyerProfile.sleeve,
    neck: optionalNumberValue(formData, "neck") ?? suggestions.shirtMeasurements?.neck ?? user.buyerProfile.neck,
      inseam: suggestions.trouserMeasurements?.inseam ?? user.buyerProfile.inseam,
      fitPreference,
      maxAlterationBudget: user.buyerProfile.maxAlterationBudget,
      searchRadius: user.buyerProfile.searchRadius,
      jacketMeasurements: mergedSuggestions.jacketMeasurements,
      shirtMeasurements: mergedSuggestions.shirtMeasurements,
      waistcoatMeasurements: mergedSuggestions.waistcoatMeasurements,
      trouserMeasurements: mergedSuggestions.trouserMeasurements,
      coatMeasurements: mergedSuggestions.coatMeasurements,
      sweaterMeasurements: mergedSuggestions.sweaterMeasurements,
      suggestedMeasurementRanges: mergedSuggestions.suggestedMeasurementRanges
    });

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
    redirect(
      withUpdatedQueryParams(returnTo, {
        saved: "user generated measurements",
        measurementReview:
          suggestions.sanityCheck.status === "ok" ? null : suggestions.sanityCheck.status,
        measurementIssues:
          suggestions.sanityCheck.warnings.length > 0
            ? JSON.stringify(
                suggestions.sanityCheck.warnings.map((warning) => ({
                  message: warning.message,
                  suggestion: warning.suggestion ?? null
                }))
              )
            : null,
        measurementFillMissingOnly: null
      })
    );
}

export async function forceGenerateBuyerMeasurementSuggestionsAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer/measurements?edit=1";
  const fitPreferenceValue = stringValue(formData, "fitPreference");
  const fitPreference = isValidBuyerFitPreference(fitPreferenceValue) ? fitPreferenceValue : "classic";
  const fillMissingOnly = isCheckedValue(formData, "fillMissingOnly");

  const suggestions = generateBuyerMeasurementSuggestions({
    height: optionalNumberValue(formData, "height"),
    weight: optionalNumberValue(formData, "weight"),
    chest: optionalNumberValue(formData, "bodyChest"),
    waist: optionalNumberValue(formData, "bodyWaist"),
    hips: optionalNumberValue(formData, "bodyHips"),
    shoulders: optionalNumberValue(formData, "bodyShoulders"),
    sleeveLength: optionalNumberValue(formData, "bodySleeve"),
    neck: optionalNumberValue(formData, "neck"),
    fitPreference
  });

  const mergedSuggestions = mergeBuyerGeneratedMeasurements(
    user.buyerProfile,
    {
      jacketMeasurements: suggestions.jacketMeasurements,
      shirtMeasurements: suggestions.shirtMeasurements,
      waistcoatMeasurements: suggestions.waistcoatMeasurements,
      trouserMeasurements: suggestions.trouserMeasurements,
      coatMeasurements: suggestions.coatMeasurements,
      sweaterMeasurements: suggestions.sweaterMeasurements,
      suggestedMeasurementRanges: suggestions.suggestedMeasurementRanges
    },
    fillMissingOnly
  );

  await updateUser(user.id, {
    zipCode: user.buyerProfile.zipCode,
    location: user.buyerProfile.location,
    address: user.buyerProfile.address,
    addresses: user.buyerProfile.addresses,
    height: optionalNumberValue(formData, "height") ?? user.buyerProfile.height,
    weight: optionalNumberValue(formData, "weight") ?? user.buyerProfile.weight,
    chest: optionalNumberValue(formData, "bodyChest") ?? user.buyerProfile.chest,
    shoulder: optionalNumberValue(formData, "bodyShoulders") ?? user.buyerProfile.shoulder,
    waist: optionalNumberValue(formData, "bodyWaist") ?? user.buyerProfile.waist,
    sleeve: optionalNumberValue(formData, "bodySleeve") ?? user.buyerProfile.sleeve,
    neck: optionalNumberValue(formData, "neck") ?? suggestions.shirtMeasurements?.neck ?? user.buyerProfile.neck,
      inseam: suggestions.trouserMeasurements?.inseam ?? user.buyerProfile.inseam,
      fitPreference,
      maxAlterationBudget: user.buyerProfile.maxAlterationBudget,
      searchRadius: user.buyerProfile.searchRadius,
      jacketMeasurements: mergedSuggestions.jacketMeasurements,
      shirtMeasurements: mergedSuggestions.shirtMeasurements,
      waistcoatMeasurements: mergedSuggestions.waistcoatMeasurements,
      trouserMeasurements: mergedSuggestions.trouserMeasurements,
      coatMeasurements: mergedSuggestions.coatMeasurements,
      sweaterMeasurements: mergedSuggestions.sweaterMeasurements,
      suggestedMeasurementRanges: mergedSuggestions.suggestedMeasurementRanges
    });

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
    redirect(
      withUpdatedQueryParams(returnTo, {
        saved: "user generated measurements",
        measurementReview: null,
        measurementIssues: null,
        measurementHeight: null,
      measurementWeight: null,
      measurementBodyChest: null,
      measurementBodyWaist: null,
      measurementBodyHips: null,
        measurementBodyShoulders: null,
        measurementBodySleeve: null,
        measurementNeck: null,
        measurementFitPreference: null,
        measurementFillMissingOnly: null
      })
    );
}

export async function generateBuyerMeasurementSuggestionsFromAnchorAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer/measurements";
  const anchorCategory = stringValue(formData, "anchorCategory");
  const fillMissingOnly = isCheckedValue(formData, "fillMissingOnly");

  if (anchorCategory !== "jacket") {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Choose+a+saved+jacket+profile+to+use+as+your+fit+anchor"));
  }

  const enteredAnchorMeasurements = buildBuyerTopMeasurementsFromGetter(
    (key) => optionalNumberValue(formData, key),
    "anchorJacket"
  );
  const enteredAnchorTrouserMeasurements = {
    waist: optionalNumberValue(formData, "anchorTrouserWaist"),
    hips: optionalNumberValue(formData, "anchorTrouserHips"),
    inseam: optionalNumberValue(formData, "anchorTrouserInseam"),
    outseam: optionalNumberValue(formData, "anchorTrouserOutseam"),
    opening: optionalNumberValue(formData, "anchorTrouserOpening")
  };
  const hasEnteredAnchorTrouserMeasurements = Object.values(enteredAnchorTrouserMeasurements).some(
    (value) => value !== null
  );
  const resolvedAnchorTrouserMeasurements = hasEnteredAnchorTrouserMeasurements
    ? {
        ...(enteredAnchorTrouserMeasurements.waist !== null
          ? { waist: enteredAnchorTrouserMeasurements.waist, waistAllowance: 0 }
          : {}),
        ...(enteredAnchorTrouserMeasurements.hips !== null ? { hips: enteredAnchorTrouserMeasurements.hips } : {}),
        ...(enteredAnchorTrouserMeasurements.inseam !== null
          ? { inseam: enteredAnchorTrouserMeasurements.inseam, inseamOutseamAllowance: 0 }
          : {}),
        ...(enteredAnchorTrouserMeasurements.outseam !== null ? { outseam: enteredAnchorTrouserMeasurements.outseam } : {}),
        ...(enteredAnchorTrouserMeasurements.opening !== null ? { opening: enteredAnchorTrouserMeasurements.opening } : {})
      }
    : null;
  const profileHasAnchor = Boolean(user.buyerProfile.jacketMeasurements);
  const effectiveProfile = profileHasAnchor
    ? user.buyerProfile
    : {
        ...user.buyerProfile,
        jacketMeasurements: enteredAnchorMeasurements ?? user.buyerProfile.jacketMeasurements
      };

  if (!profileHasAnchor && !enteredAnchorMeasurements) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Enter+your+jacket+measurements+to+use+them+as+the+fit+anchor"));
  }

  const suggestions = generateBuyerMeasurementSuggestionsFromAnchor(effectiveProfile, "jacket");

  const mergedSuggestions = mergeBuyerGeneratedMeasurements(
    effectiveProfile,
    {
      jacketMeasurements: effectiveProfile.jacketMeasurements,
      shirtMeasurements: suggestions.shirtMeasurements,
      waistcoatMeasurements: suggestions.waistcoatMeasurements,
      trouserMeasurements: resolvedAnchorTrouserMeasurements ?? effectiveProfile.trouserMeasurements,
      coatMeasurements: suggestions.coatMeasurements,
      sweaterMeasurements: suggestions.sweaterMeasurements,
      suggestedMeasurementRanges: suggestions.suggestedMeasurementRanges
        ? {
            ...suggestions.suggestedMeasurementRanges,
            trousers: effectiveProfile.suggestedMeasurementRanges?.trousers ?? null
          }
        : effectiveProfile.suggestedMeasurementRanges
    },
    fillMissingOnly,
    ["jacketMeasurements", "trouserMeasurements"]
  );

  await updateUser(user.id, {
    zipCode: user.buyerProfile.zipCode,
    location: user.buyerProfile.location,
    address: user.buyerProfile.address,
    addresses: user.buyerProfile.addresses,
    height: user.buyerProfile.height,
    weight: user.buyerProfile.weight,
    chest: user.buyerProfile.chest,
    shoulder: user.buyerProfile.shoulder,
    waist: user.buyerProfile.waist,
    sleeve: user.buyerProfile.sleeve,
    neck: user.buyerProfile.neck,
      inseam: user.buyerProfile.inseam,
        fitPreference: user.buyerProfile.fitPreference,
        maxAlterationBudget: user.buyerProfile.maxAlterationBudget,
        searchRadius: user.buyerProfile.searchRadius,
        jacketMeasurements: mergedSuggestions.jacketMeasurements,
        shirtMeasurements: mergedSuggestions.shirtMeasurements,
        waistcoatMeasurements: mergedSuggestions.waistcoatMeasurements,
        trouserMeasurements: mergedSuggestions.trouserMeasurements,
        coatMeasurements: mergedSuggestions.coatMeasurements,
        sweaterMeasurements: mergedSuggestions.sweaterMeasurements,
        suggestedMeasurementRanges: mergedSuggestions.suggestedMeasurementRanges
      });

    revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
  redirect(withUpdatedQueryParam(returnTo, "saved", "user generated measurements"));
}

export async function buildBuyerMeasurementCategoryFromAnchorAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+save+profiles");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+measurements");
  }

  const returnTo = stringValue(formData, "returnTo") || "/buyer/measurements?mode=dashboard&edit=1";
  const targetCategory = stringValue(formData, "quickBuildTarget");
  const anchorCategory = stringValue(formData, `quickBuildSource_${targetCategory}`) || "jacket";

  if (anchorCategory !== "jacket") {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Choose+a+jacket+anchor+profile"));
  }

  if (!["jacket", "shirt", "waistcoat", "coat", "sweater"].includes(targetCategory)) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Choose+a+valid+upper-body+measurement+category"));
  }

  const profileHasAnchor = Boolean(user.buyerProfile.jacketMeasurements);

  if (!profileHasAnchor) {
    redirect(withUpdatedQueryParam(returnTo, "authError", "Save+a+jacket+profile+first+to+build+from+it"));
  }

  const suggestions = generateBuyerMeasurementSuggestionsFromAnchor(user.buyerProfile, "jacket");

  const nextSuggestedRanges = {
    ...(user.buyerProfile.suggestedMeasurementRanges ?? {
      fitPreference: user.buyerProfile.fitPreference,
      jacket: null,
      shirt: null,
      waistcoat: null,
      trousers: null,
      coat: null,
      sweater: null
    }),
    fitPreference: suggestions.suggestedMeasurementRanges.fitPreference
  };

  const nextProfile: BuyerProfile = {
    ...user.buyerProfile,
    suggestedMeasurementRanges: nextSuggestedRanges
  };

  if (targetCategory === "jacket") {
    nextProfile.jacketMeasurements = suggestions.jacketMeasurements;
    nextProfile.suggestedMeasurementRanges = {
      ...nextSuggestedRanges,
      jacket: suggestions.suggestedMeasurementRanges.jacket
    };
  } else if (targetCategory === "shirt") {
    nextProfile.shirtMeasurements = suggestions.shirtMeasurements;
    nextProfile.suggestedMeasurementRanges = {
      ...nextSuggestedRanges,
      shirt: suggestions.suggestedMeasurementRanges.shirt
    };
  } else if (targetCategory === "waistcoat") {
    nextProfile.waistcoatMeasurements = suggestions.waistcoatMeasurements;
    nextProfile.suggestedMeasurementRanges = {
      ...nextSuggestedRanges,
      waistcoat: suggestions.suggestedMeasurementRanges.waistcoat
    };
  } else if (targetCategory === "coat") {
    nextProfile.coatMeasurements = suggestions.coatMeasurements;
    nextProfile.suggestedMeasurementRanges = {
      ...nextSuggestedRanges,
      coat: suggestions.suggestedMeasurementRanges.coat
    };
  } else if (targetCategory === "sweater") {
    nextProfile.sweaterMeasurements = suggestions.sweaterMeasurements;
    nextProfile.suggestedMeasurementRanges = {
      ...nextSuggestedRanges,
      sweater: suggestions.suggestedMeasurementRanges.sweater
    };
  }

  await updateUser(user.id, nextProfile);

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/buyer/measurements");
  redirect(withUpdatedQueryParam(returnTo, "saved", "user generated measurements"));
}

export async function saveBuyerAccountAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/account/personal?authError=Add+DATABASE_URL+to+save+account");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+account");
  }

  const name = stringValue(formData, "name");
  const email = stringValue(formData, "email").toLowerCase();
  const phoneNumber = stringValue(formData, "phoneNumber");
  const normalizedPhoneNumber = normalizeUsPhoneNumber(phoneNumber);
  const buyerZipCode = stringValue(formData, "buyerZipCode");
  const businessName = stringValue(formData, "businessName");
  const publicLocationModeValue = stringValue(formData, "publicLocationMode");
  const publicLocationMode = isValidPublicLocationMode(publicLocationModeValue)
    ? publicLocationModeValue
    : "country";
  const zipResult = buyerZipCode ? await resolveUsZipCode(buyerZipCode) : null;

  if (!name || !email || !buyerZipCode) {
    redirect("/account/personal?edit=1&authError=Complete+all+required+personal+fields");
  }

  if (!zipResult) {
    redirect("/account/personal?edit=1&authError=Enter+a+valid+US+ZIP+code");
  }

  if (!normalizedPhoneNumber) {
    redirect("/account/personal?edit=1&authError=Enter+a+valid+US+phone+number");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser && existingUser.id !== user.id) {
    redirect("/account/personal?edit=1&authError=Email+address+is+already+in+use");
  }

  const addressCount = Math.max(1, Number(stringValue(formData, "addressCount") || "1"));
  const addresses: ShippingAddress[] = [];

  for (let index = 0; index < addressCount; index += 1) {
    const address = {
      fullName: name,
      line1: stringValue(formData, `addressLine1_${index}`),
      line2: stringValue(formData, `addressLine2_${index}`),
      city: stringValue(formData, `addressCity_${index}`),
      state: stringValue(formData, `addressState_${index}`),
      postalCode: stringValue(formData, `addressZipCode_${index}`),
      country: stringValue(formData, `addressCountry_${index}`) || "US"
    } satisfies ShippingAddress;

    const hasAnyAddressValue = Boolean(
      address.line1 || address.line2 || address.city || address.state || address.postalCode
    );

    if (!hasAnyAddressValue) {
      continue;
    }

    if (!address.line1 || !address.city || !address.state || !address.postalCode || !address.country) {
      redirect("/account/personal?edit=1&authError=Complete+each+saved+address+before+saving");
    }

    if (address.country !== "US") {
      redirect("/account/personal?edit=1&authError=Select+United+States+as+the+country");
    }

    addresses.push(address);
  }

  if (!addresses.length) {
    redirect("/account/personal?edit=1&authError=Add+at+least+one+saved+address");
  }

  const primaryAddress = addresses[0];

  if (primaryAddress.country !== "US") {
    redirect("/account/personal?edit=1&authError=Select+United+States+as+the+country");
  }

  await updateBuyerAccount(user.id, {
    name,
    email,
    phoneNumber: normalizedPhoneNumber,
    zipCode: zipResult.zipCode,
    location: zipResult.location,
    address: primaryAddress,
    addresses,
    businessName,
    profileDescription: user.profileDescription,
    showPersonalNameOnProfile: false,
    showBusinessNameOnProfile: false,
    publicLocationMode
  });

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/account");
  revalidatePath("/account/personal");
  redirect("/account/personal?saved=account");
}

export async function saveAccountPersonalFieldAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/account/personal?authError=Add+DATABASE_URL+to+save+account");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+save+your+account");
  }

  const field = stringValue(formData, "field");
  const settingsBasePath =
    field === "publicProfile" || field === "profileDescription" ? "/account/profile" : "/account/personal";
  const currentAddresses =
    user.buyerProfile.addresses.length > 0 ? [...user.buyerProfile.addresses] : [user.buyerProfile.address];

  let name = user.name;
  const email = user.email;
  let phoneNumber = user.phoneNumber;
  let zipCode = user.buyerProfile.zipCode;
  let location = user.buyerProfile.location;
  let addresses = currentAddresses;
  let businessName = user.businessName;
  let profileDescription = user.profileDescription;
  let showPersonalNameOnProfile = user.showPersonalNameOnProfile;
  let showBusinessNameOnProfile = user.showBusinessNameOnProfile;
  let publicLocationMode = user.publicLocationMode;
  const emptyAddress: ShippingAddress = {
    fullName: name,
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US"
  };

  if (field === "name") {
    name = stringValue(formData, "name");
    if (!name) {
      redirect("/account/personal?field=name&authError=Enter+your+name");
    }
  } else if (field === "phone") {
    const rawPhoneNumber = stringValue(formData, "phoneNumber");
    const normalizedPhoneNumber = normalizeUsPhoneNumber(rawPhoneNumber);

    if (!normalizedPhoneNumber) {
      redirect("/account/personal?field=phone&authError=Enter+a+valid+US+phone+number");
    }

    phoneNumber = normalizedPhoneNumber;
  } else if (field === "location") {
    const buyerZipCode = stringValue(formData, "buyerZipCode");
    const zipResult = buyerZipCode ? await resolveUsZipCode(buyerZipCode) : null;

    if (!buyerZipCode) {
      redirect("/account/personal?field=location&authError=Enter+a+ZIP+code");
    }

    if (!zipResult) {
      redirect("/account/personal?field=location&authError=Enter+a+valid+US+ZIP+code");
    }

    zipCode = zipResult.zipCode;
    location = zipResult.location;
  } else if (field === "businessName") {
    businessName = stringValue(formData, "businessName");
  } else if (field === "profileDescription") {
    profileDescription = stringValue(formData, "profileDescription");

    if (profileDescription.length > 1000) {
      redirect("/account/profile?field=profileDescription&authError=Description+must+be+1000+characters+or+fewer");
    }
  } else if (field === "publicProfile") {
    const submittedPublicLocationMode = stringValue(formData, "publicLocationMode");

    if (!isValidPublicLocationMode(submittedPublicLocationMode)) {
      redirect("/account/profile?field=publicProfile&authError=Choose+a+valid+public+location+setting");
    }

    showPersonalNameOnProfile = formData.get("showPersonalNameOnProfile") === "on";
    showBusinessNameOnProfile = formData.get("showBusinessNameOnProfile") === "on";

    if (showBusinessNameOnProfile && !businessName) {
      redirect("/account/profile?field=publicProfile&authError=Add+a+business+name+before+showing+it+on+your+profile");
    }

    publicLocationMode = submittedPublicLocationMode;
  } else if (field === "address") {
    const addressIndex = Number(stringValue(formData, "addressIndex"));
    const addressIntent = stringValue(formData, "addressIntent") || "save";

    if (Number.isNaN(addressIndex) || addressIndex < 0) {
      redirect("/account/personal?authError=Choose+a+valid+address");
    }

    if (addressIntent === "delete") {
      addresses = currentAddresses.filter((_, index) => index !== addressIndex);
    } else {
      const address = {
        fullName: name,
        line1: stringValue(formData, "addressLine1"),
        line2: stringValue(formData, "addressLine2"),
        city: stringValue(formData, "addressCity"),
        state: stringValue(formData, "addressState"),
        postalCode: stringValue(formData, "addressZipCode"),
        country: stringValue(formData, "addressCountry") || "US"
      } satisfies ShippingAddress;

      if (!address.line1 || !address.city || !address.state || !address.postalCode || !address.country) {
        redirect(`/account/personal?field=address&index=${addressIndex}&authError=Complete+the+saved+address+before+saving`);
      }

      if (address.country !== "US") {
        redirect(`/account/personal?field=address&index=${addressIndex}&authError=Select+United+States+as+the+country`);
      }

      addresses = [...currentAddresses];

      if (addressIndex >= addresses.length) {
        addresses.push(address);
      } else {
        addresses[addressIndex] = address;
      }
    }
  } else {
    redirect("/account/personal?authError=Choose+a+field+to+edit");
  }

  await updateBuyerAccount(user.id, {
    name,
    email,
    phoneNumber,
    zipCode,
    location,
    address: addresses[0] || emptyAddress,
    addresses,
    businessName,
    profileDescription,
    showPersonalNameOnProfile,
    showBusinessNameOnProfile,
    publicLocationMode
  });

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath("/account");
  revalidatePath("/account/personal");
  revalidatePath("/account/profile");
  revalidatePath("/users");
  revalidatePath(`/users/${user.username}`);
  redirect(`${settingsBasePath}?saved=${encodeURIComponent(field)}`);
}

export async function createListingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller/listings/new?authError=Add+DATABASE_URL+to+create+listings");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+publish+listings");
  }

  const listingStatus = listingStatusFromIntent(stringValue(formData, "listingIntent"));
  const mediaFiles = formData
    .getAll("media")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const orderedMediaFiles = reorderFilesFromManifest(formData, mediaFiles);
  let media = [] as Awaited<ReturnType<typeof saveListingMediaFiles>>;

  try {
    media = await saveListingMediaFiles(user.id || randomUUID(), orderedMediaFiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload listing media";
    redirect(`/seller/listings/new?authError=${encodeURIComponent(message)}`);
  }

  const sellerLocation = user.sellerLocation.trim();

  if (!sellerLocation) {
    redirect("/seller/listings/new?authError=Add+your+seller+location+before+publishing+listings");
  }

  const category = stringValue(formData, "category") as
    | "jacket"
    | "two_piece_suit"
    | "three_piece_suit"
    | "waistcoat"
    | "trousers"
    | "coat"
    | "shirt"
    | "sweater";

  if (listingStatus === "active") {
    const validationError = validatePublishedListing(formData, category, orderedMediaFiles.length);
    if (validationError) {
      redirect(`/seller/listings/new?authError=${encodeURIComponent(validationError)}`);
    }
  }

  const jacketMeasurements: JacketMeasurements | null = hasJacket(category)
    ? {
        neck: optionalNumberValue(formData, "jacketNeck") ?? undefined,
        chest: numberValue(formData, "jacketChest"),
        waist: numberValue(formData, "jacketWaist"),
        shoulders: numberValue(formData, "jacketShoulders"),
        bodyLength: numberValue(formData, "jacketBodyLength"),
        sleeveLength: numberValue(formData, "jacketArmLength"),
        sleeveLengthAllowance: hasShirt(category) || hasSweater(category) ? 0 : numberValue(formData, "jacketArmLengthAllowance")
      }
    : null;

  const jacketSpecs: JacketSpecs | null = hasJacket(category) && !hasShirt(category) && !hasSweater(category)
    ? {
        cut: stringValue(formData, "jacketCut") as JacketSpecs["cut"],
        lapel: stringValue(formData, "jacketLapel") as JacketSpecs["lapel"],
        buttonStyle: stringValue(formData, "jacketButtonStyle") as JacketSpecs["buttonStyle"],
        ventStyle: stringValue(formData, "jacketVentStyle") as JacketSpecs["ventStyle"],
        canvas: stringValue(formData, "jacketCanvas") as JacketSpecs["canvas"],
        lining: stringValue(formData, "jacketLining") as JacketSpecs["lining"],
        formal: stringValue(formData, "jacketFormal") as JacketSpecs["formal"]
      }
    : null;
  const shirtSpecs: ShirtSpecs | null = hasShirt(category)
    ? {
        collarStyle: stringValue(formData, "shirtCollarStyle") as ShirtSpecs["collarStyle"],
        cuffStyle: stringValue(formData, "shirtCuffStyle") as ShirtSpecs["cuffStyle"],
        placket: stringValue(formData, "shirtPlacket") as ShirtSpecs["placket"]
      }
    : null;
  const sweaterSpecs: SweaterSpecs | null = hasSweater(category)
    ? {
        neckline: stringValue(formData, "sweaterNeckline") as SweaterSpecs["neckline"],
        closure: stringValue(formData, "sweaterClosure") as SweaterSpecs["closure"]
      }
    : null;

  const waistcoatMeasurements: WaistcoatMeasurements | null = hasWaistcoat(category)
    ? {
        chest: numberValue(formData, "waistcoatChest"),
        waist: numberValue(formData, "waistcoatWaist"),
        shoulders: numberValue(formData, "waistcoatShoulders"),
        bodyLength: numberValue(formData, "waistcoatBodyLength")
      }
    : null;

  const waistcoatSpecs: WaistcoatSpecs | null = hasWaistcoat(category)
    ? {
        cut: stringValue(formData, "waistcoatCut") as WaistcoatSpecs["cut"],
        lapel: stringValue(formData, "waistcoatLapel") as WaistcoatSpecs["lapel"],
        formal: stringValue(formData, "waistcoatFormal") as WaistcoatSpecs["formal"]
      }
    : null;

  const trouserMeasurements: TrouserMeasurements | null = hasTrousers(category)
    ? {
        waist: numberValue(formData, "trouserWaist"),
        waistAllowance: numberValue(formData, "trouserWaistAllowance"),
        hips: numberValue(formData, "trouserHips"),
        inseam: numberValue(formData, "trouserInseam"),
        inseamOutseamAllowance: numberValue(formData, "trouserInseamOutseamAllowance"),
        outseam: numberValue(formData, "trouserOutseam"),
        opening: numberValue(formData, "trouserOpening")
      }
    : null;

  const trouserSpecs: TrouserSpecs | null = hasTrousers(category)
    ? {
        cut: stringValue(formData, "trouserCut") as TrouserSpecs["cut"],
        front: stringValue(formData, "trouserFront") as TrouserSpecs["front"],
        formal: stringValue(formData, "trouserFormal") as TrouserSpecs["formal"]
      }
    : null;

  const garmentSanityCheck = runBuyerGarmentMeasurementSanityCheck(
    buildSellerGarmentMeasurementInputs(category, jacketMeasurements, waistcoatMeasurements, trouserMeasurements)
  );

  if (garmentSanityCheck.status !== "ok") {
    redirectWithSellerMeasurementWarnings(
      "/seller/listings/new",
      garmentSanityCheck,
      serializeSellerListingDraft(formData),
      JSON.stringify(media)
    );
  }

  const primaryChest = jacketMeasurements?.chest ?? waistcoatMeasurements?.chest ?? 0;
  const primaryShoulder = jacketMeasurements?.shoulders ?? waistcoatMeasurements?.shoulders ?? 0;
  const primaryWaist = trouserMeasurements?.waist ?? jacketMeasurements?.waist ?? waistcoatMeasurements?.waist ?? 0;
  const primarySleeve = jacketMeasurements?.sleeveLength ?? 0;
  const primaryInseam = trouserMeasurements?.inseam ?? 0;
  const primaryOutseam = trouserMeasurements?.outseam ?? 0;
  const sizeLabel = combineSplitSize(stringValue(formData, "sizeLabelPartOne"), stringValue(formData, "sizeLabelPartTwo")) || stringValue(formData, "sizeLabel");
  const trouserSizeLabel =
    combineSplitSize(stringValue(formData, "trouserSizeLabelPartOne"), stringValue(formData, "trouserSizeLabelPartTwo")) ||
    stringValue(formData, "trouserSizeLabel");

  const createdListing = await createListing(user, {
    title: stringValue(formData, "title"),
    brand: resolvedSubmittedListingBrand(formData),
    category,
    sizeLabel,
    trouserSizeLabel,
    chest: primaryChest,
    shoulder: primaryShoulder,
    waist: primaryWaist,
    sleeve: primarySleeve,
    inseam: primaryInseam,
    outseam: primaryOutseam,
    material: stringValue(formData, "material") as Listing["material"],
    pattern: stringValue(formData, "pattern") as Listing["pattern"],
    primaryColor: stringValue(formData, "primaryColor") as
      | "beige_tan"
      | "black"
      | "blue"
      | "brown"
      | "gray_charcoal"
      | "green"
      | "navy"
      | "orange"
      | "purple_violet"
      | "white_cream"
      | "yellow",
    countryOfOrigin: resolvedSubmittedListingCountry(formData) as Listing["countryOfOrigin"],
    lapel: (jacketSpecs?.lapel === "shawl" || jacketSpecs?.lapel === "peak" || jacketSpecs?.lapel === "notch"
      ? jacketSpecs.lapel
      : waistcoatSpecs?.lapel === "shawl" || waistcoatSpecs?.lapel === "peak" || waistcoatSpecs?.lapel === "notch"
        ? waistcoatSpecs.lapel
        : "notch") as "notch" | "peak" | "shawl",
    fabricWeight: (stringValue(formData, "fabricWeight") || "medium") as Listing["fabricWeight"],
    fabricType: stringValue(formData, "fabricType") as Listing["fabricType"],
    fabricWeave: (stringValue(formData, "fabricWeave") || "na") as Listing["fabricWeave"],
    condition: stringValue(formData, "condition") as
      | "new_with_tags"
      | "new_without_tags"
      | "used_excellent"
      | "used_very_good"
      | "used_good"
      | "used_fair"
      | "used_poor",
    vintage: (stringValue(formData, "vintage") || "modern") as Listing["vintage"],
    returnsAccepted: stringValue(formData, "returnsAccepted") === "yes",
    allowOffers: stringValue(formData, "allowOffers") === "yes",
    price: numberValue(formData, "price"),
    shippingPrice: estimateShippingCost(category, sizeLabel),
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 3,
    location: sellerLocation,
    distanceMiles: estimateTailoringDistanceFromSellerLocation(sellerLocation),
    description: stringValue(formData, "description"),
    media,
    jacketMeasurements,
    jacketSpecs,
    shirtSpecs,
    sweaterSpecs,
    waistcoatMeasurements,
    waistcoatSpecs,
    trouserMeasurements,
    trouserSpecs,
    status: listingStatus
  });

  if (listingStatus === "active") {
    const followers = await listFollowerUsersForSeller(user.id);
    await Promise.all(
      followers.map((recipient) =>
        sendNewListingFollowerNotification({
          listing: createdListing,
          seller: user,
          recipient
        })
      )
    );
  }

  revalidatePath("/");
  revalidatePath("/seller");
  redirect(`/seller?saved=${listingStatus === "draft" ? "draft" : "listing"}`);
}

export async function saveSellerProfileAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+save+seller+profile");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const sellerZipCode = stringValue(formData, "sellerZipCode");

  const sellerZipResult = await resolveUsZipCode(sellerZipCode);

  if (!sellerZipResult) {
    redirect("/seller?authError=Enter+a+valid+US+ZIP+code");
  }

  await updateSellerLocation(user.id, sellerZipResult.zipCode, sellerZipResult.location);
  revalidatePath("/seller");
  revalidatePath("/buyer");
  revalidatePath("/");
  redirect("/seller?saved=seller-profile");
}

export async function updateListingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+listings");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+edit+listings");
  }

  const listingId = stringValue(formData, "listingId");
  const existingListing = await findListingById(listingId);

  if (!existingListing || existingListing.sellerId !== user.id) {
    redirect("/seller?authError=Listing+not+found");
  }

  const mediaFiles = formData
    .getAll("media")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const orderedMediaFiles = reorderFilesFromManifest(formData, mediaFiles);
  let media = existingListing.media;

  if (orderedMediaFiles.length) {
    try {
      media = await saveListingMediaFiles(user.id, orderedMediaFiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload listing media";
      redirect(`/seller/listings/${listingId}/edit?authError=${encodeURIComponent(message)}`);
    }
  }

  const sellerLocation = user.sellerLocation.trim();
  if (!sellerLocation) {
    redirect(`/seller/listings/${listingId}/edit?authError=Add+your+seller+location+before+saving`);
  }

  const category = stringValue(formData, "category") as
    | "jacket"
    | "two_piece_suit"
    | "three_piece_suit"
    | "waistcoat"
    | "trousers"
    | "coat"
    | "shirt"
    | "sweater";

  const validationError = validatePublishedListing(formData, category, media.length);
  if (validationError) {
    redirect(`/seller/listings/${listingId}/edit?authError=${encodeURIComponent(validationError)}`);
  }

  const jacketMeasurements: JacketMeasurements | null = hasJacket(category)
    ? {
        neck: optionalNumberValue(formData, "jacketNeck") ?? undefined,
        chest: numberValue(formData, "jacketChest"),
        waist: numberValue(formData, "jacketWaist"),
        shoulders: numberValue(formData, "jacketShoulders"),
        bodyLength: numberValue(formData, "jacketBodyLength"),
        sleeveLength: numberValue(formData, "jacketArmLength"),
        sleeveLengthAllowance: hasShirt(category) || hasSweater(category) ? 0 : numberValue(formData, "jacketArmLengthAllowance")
      }
    : null;

  const jacketSpecs: JacketSpecs | null = hasJacket(category) && !hasShirt(category) && !hasSweater(category)
    ? {
        cut: stringValue(formData, "jacketCut") as JacketSpecs["cut"],
        lapel: stringValue(formData, "jacketLapel") as JacketSpecs["lapel"],
        buttonStyle: stringValue(formData, "jacketButtonStyle") as JacketSpecs["buttonStyle"],
        ventStyle: stringValue(formData, "jacketVentStyle") as JacketSpecs["ventStyle"],
        canvas: stringValue(formData, "jacketCanvas") as JacketSpecs["canvas"],
        lining: stringValue(formData, "jacketLining") as JacketSpecs["lining"],
        formal: stringValue(formData, "jacketFormal") as JacketSpecs["formal"]
      }
    : null;
  const shirtSpecs: ShirtSpecs | null = hasShirt(category)
    ? {
        collarStyle: stringValue(formData, "shirtCollarStyle") as ShirtSpecs["collarStyle"],
        cuffStyle: stringValue(formData, "shirtCuffStyle") as ShirtSpecs["cuffStyle"],
        placket: stringValue(formData, "shirtPlacket") as ShirtSpecs["placket"]
      }
    : null;
  const sweaterSpecs: SweaterSpecs | null = hasSweater(category)
    ? {
        neckline: stringValue(formData, "sweaterNeckline") as SweaterSpecs["neckline"],
        closure: stringValue(formData, "sweaterClosure") as SweaterSpecs["closure"]
      }
    : null;

  const waistcoatMeasurements: WaistcoatMeasurements | null = hasWaistcoat(category)
    ? {
        chest: numberValue(formData, "waistcoatChest"),
        waist: numberValue(formData, "waistcoatWaist"),
        shoulders: numberValue(formData, "waistcoatShoulders"),
        bodyLength: numberValue(formData, "waistcoatBodyLength")
      }
    : null;

  const waistcoatSpecs: WaistcoatSpecs | null = hasWaistcoat(category)
    ? {
        cut: stringValue(formData, "waistcoatCut") as WaistcoatSpecs["cut"],
        lapel: stringValue(formData, "waistcoatLapel") as WaistcoatSpecs["lapel"],
        formal: stringValue(formData, "waistcoatFormal") as WaistcoatSpecs["formal"]
      }
    : null;

  const trouserMeasurements: TrouserMeasurements | null = hasTrousers(category)
    ? {
        waist: numberValue(formData, "trouserWaist"),
        waistAllowance: numberValue(formData, "trouserWaistAllowance"),
        hips: numberValue(formData, "trouserHips"),
        inseam: numberValue(formData, "trouserInseam"),
        inseamOutseamAllowance: numberValue(formData, "trouserInseamOutseamAllowance"),
        outseam: numberValue(formData, "trouserOutseam"),
        opening: numberValue(formData, "trouserOpening")
      }
    : null;

  const trouserSpecs: TrouserSpecs | null = hasTrousers(category)
    ? {
        cut: stringValue(formData, "trouserCut") as TrouserSpecs["cut"],
        front: stringValue(formData, "trouserFront") as TrouserSpecs["front"],
        formal: stringValue(formData, "trouserFormal") as TrouserSpecs["formal"]
      }
    : null;

  const garmentSanityCheck = runBuyerGarmentMeasurementSanityCheck(
    buildSellerGarmentMeasurementInputs(category, jacketMeasurements, waistcoatMeasurements, trouserMeasurements)
  );

  if (garmentSanityCheck.status !== "ok") {
    redirectWithSellerMeasurementWarnings(
      `/seller/listings/${listingId}/edit`,
      garmentSanityCheck,
      serializeSellerListingDraft(formData),
      JSON.stringify(media)
    );
  }

  const primaryChest = jacketMeasurements?.chest ?? waistcoatMeasurements?.chest ?? 0;
  const primaryShoulder = jacketMeasurements?.shoulders ?? waistcoatMeasurements?.shoulders ?? 0;
  const primaryWaist = trouserMeasurements?.waist ?? jacketMeasurements?.waist ?? waistcoatMeasurements?.waist ?? 0;
  const primarySleeve = jacketMeasurements?.sleeveLength ?? 0;
  const primaryInseam = trouserMeasurements?.inseam ?? 0;
  const primaryOutseam = trouserMeasurements?.outseam ?? 0;
  const sizeLabel = combineSplitSize(stringValue(formData, "sizeLabelPartOne"), stringValue(formData, "sizeLabelPartTwo")) || stringValue(formData, "sizeLabel");
  const trouserSizeLabel =
    combineSplitSize(stringValue(formData, "trouserSizeLabelPartOne"), stringValue(formData, "trouserSizeLabelPartTwo")) ||
    stringValue(formData, "trouserSizeLabel");

  await updateListing(listingId, {
    title: stringValue(formData, "title"),
    brand: resolvedSubmittedListingBrand(formData),
    category,
    sizeLabel,
    trouserSizeLabel,
    chest: primaryChest,
    shoulder: primaryShoulder,
    waist: primaryWaist,
    sleeve: primarySleeve,
    inseam: primaryInseam,
    outseam: primaryOutseam,
    material: stringValue(formData, "material") as Listing["material"],
    pattern: stringValue(formData, "pattern") as Listing["pattern"],
    primaryColor: stringValue(formData, "primaryColor") as
      | "beige_tan"
      | "black"
      | "blue"
      | "brown"
      | "gray_charcoal"
      | "green"
      | "navy"
      | "orange"
      | "purple_violet"
      | "white_cream"
      | "yellow",
    countryOfOrigin: resolvedSubmittedListingCountry(formData) as Listing["countryOfOrigin"],
    lapel: (jacketSpecs?.lapel === "shawl" || jacketSpecs?.lapel === "peak" || jacketSpecs?.lapel === "notch"
      ? jacketSpecs.lapel
      : waistcoatSpecs?.lapel === "shawl" || waistcoatSpecs?.lapel === "peak" || waistcoatSpecs?.lapel === "notch"
        ? waistcoatSpecs.lapel
        : "notch") as "notch" | "peak" | "shawl",
    fabricWeight: (stringValue(formData, "fabricWeight") || "medium") as Listing["fabricWeight"],
    fabricType: stringValue(formData, "fabricType") as Listing["fabricType"],
    fabricWeave: (stringValue(formData, "fabricWeave") || "na") as Listing["fabricWeave"],
    condition: stringValue(formData, "condition") as
      | "new_with_tags"
      | "new_without_tags"
      | "used_excellent"
      | "used_very_good"
      | "used_good"
      | "used_fair"
      | "used_poor",
    vintage: (stringValue(formData, "vintage") || "modern") as Listing["vintage"],
    returnsAccepted: stringValue(formData, "returnsAccepted") === "yes",
    allowOffers: stringValue(formData, "allowOffers") === "yes",
    price: numberValue(formData, "price"),
    shippingPrice: estimateShippingCost(category, sizeLabel),
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: existingListing.processingDays,
    location: sellerLocation,
    distanceMiles: estimateTailoringDistanceFromSellerLocation(sellerLocation),
    description: stringValue(formData, "description"),
    media,
    jacketMeasurements,
    jacketSpecs,
    shirtSpecs,
    sweaterSpecs,
    waistcoatMeasurements,
    waistcoatSpecs,
    trouserMeasurements,
    trouserSpecs,
    status: existingListing.status
  });

  revalidatePath("/seller");
  revalidatePath(`/seller/listings/${listingId}`);
  revalidatePath(`/seller/listings/${listingId}/edit`);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
  redirect(`/seller/listings/${listingId}?saved=listing`);
}

export async function updateListingStatusAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+listings");
  const user = await getCurrentUser();
  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const listingId = stringValue(formData, "listingId");
  const nextStatus = stringValue(formData, "status") as ListingStatus;
  const existingListing = await findListingById(listingId);
  await updateListingStatus(listingId, nextStatus);

  if (existingListing && nextStatus === "active" && existingListing.status !== "active") {
    const followers = await listFollowerUsersForSeller(user.id);
    await Promise.all(
      followers.map((recipient) =>
        sendNewListingFollowerNotification({
          listing: {
            ...existingListing,
            status: "active"
          },
          seller: user,
          recipient
        })
      )
    );
  }

  revalidatePath("/seller");
  revalidatePath("/seller/listings");
  revalidatePath(`/seller/listings/${listingId}`);
  revalidatePath("/");

  if (nextStatus === "active") {
    redirect(`/seller/listings/${listingId}`);
  }

  if (nextStatus === "archived") {
    redirect("/seller/listings");
  }
}

export async function forceCreateListingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller/listings/new?authError=Add+DATABASE_URL+to+create+listings");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+publish+listings");
  }

  const sellerLocation = user.sellerLocation.trim();
  if (!sellerLocation) {
    redirect("/seller/listings/new?authError=Add+your+seller+location+before+publishing+listings");
  }

  const draft = parseSellerListingDraft(stringValue(formData, "sellerListingDraft"));
  const media = parseSellerListingMedia(stringValue(formData, "sellerListingMedia"));
  const listingStatus = listingStatusFromIntent(sellerDraftStringValue(draft, "listingIntent"));
  const { input } = buildListingPayloadFromDraft(draft, media, sellerLocation, listingStatus);

  const createdListing = await createListing(user, input);

  if (listingStatus === "active") {
    const followers = await listFollowerUsersForSeller(user.id);
    await Promise.all(
      followers.map((recipient) =>
        sendNewListingFollowerNotification({
          listing: createdListing,
          seller: user,
          recipient
        })
      )
    );
  }

  revalidatePath("/");
  revalidatePath("/seller");
  redirect(`/seller?saved=${listingStatus === "draft" ? "draft" : "listing"}`);
}

export async function forceUpdateListingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+listings");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+edit+listings");
  }

  const listingId = stringValue(formData, "listingId");
  const existingListing = await findListingById(listingId);

  if (!existingListing || existingListing.sellerId !== user.id) {
    redirect("/seller?authError=Listing+not+found");
  }

  const sellerLocation = user.sellerLocation.trim();
  if (!sellerLocation) {
    redirect(`/seller/listings/${listingId}/edit?authError=Add+your+seller+location+before+saving`);
  }

  const draft = parseSellerListingDraft(stringValue(formData, "sellerListingDraft"));
  const media = parseSellerListingMedia(stringValue(formData, "sellerListingMedia"));
  const { input } = buildListingPayloadFromDraft(draft, media, sellerLocation, existingListing.status);

  await updateListing(listingId, {
    ...input,
    processingDays: existingListing.processingDays,
    status: existingListing.status
  });

  revalidatePath("/seller");
  revalidatePath(`/seller/listings/${listingId}`);
  revalidatePath(`/seller/listings/${listingId}/edit`);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
  redirect(`/seller/listings/${listingId}?saved=listing`);
}

export async function addToCartAction(formData: FormData) {
  const listingId = stringValue(formData, "listingId");
  const user = await getCurrentUser();
  const listing = await findListingById(listingId);
  const returnTo = stringValue(formData, "returnTo");

  if (!listing) {
    redirect(returnTo || "/");
  }

  if (user?.id && listing.sellerId === user.id) {
    const destination = returnTo || `/listings/${listing.id}`;
    redirect(withUpdatedQueryParam(destination, "authError", "You may not add your own item to your cart."));
  }

  const existingCartIds = await getCartIds();
  const existingCartListings = (
    await Promise.all(existingCartIds.filter((id) => id !== listingId).map((id) => findListingById(id)))
  ).filter((cartListing): cartListing is NonNullable<typeof cartListing> => Boolean(cartListing));

  if (existingCartListings.some((cartListing) => cartListing.status === "active" && cartListing.sellerId !== listing.sellerId)) {
    const destination = returnTo || `/listings/${listing.id}`;
    redirect(
      withUpdatedQueryParam(
        destination,
        "authError",
        "For now, checkout supports one seller at a time. Please check out or clear your current cart before adding this item."
      )
    );
  }

  const alreadyInCart = await addToCart(listingId);
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/cart");
  revalidatePath("/buyer");
  const cartState = alreadyInCart ? "existing" : "added";
  if (returnTo) {
    redirect(withUpdatedQueryParam(returnTo, "cartAdded", cartState));
  }
  redirect(withUpdatedQueryParam("/cart", "cartAdded", cartState));
}

export async function removeFromCartAction(formData: FormData) {
  await removeFromCart(stringValue(formData, "listingId"));
  revalidatePath("/", "layout");
  revalidatePath("/cart");
}

export async function checkoutAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/cart?checkoutError=Add+DATABASE_URL+to+enable+checkout");
  redirect("/cart?checkoutError=Payment+must+be+completed+through+Stripe+Checkout");
}

export async function startStripeCheckoutAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/cart?checkoutError=Add+DATABASE_URL+to+enable+checkout");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/?authError=Buyer+account+required+to+checkout");
  }

  if (!isStripeConfigured()) {
    redirect("/cart?checkoutError=Stripe+is+not+configured+yet.+Add+STRIPE_SECRET_KEY+first");
  }

  const listingId = stringValue(formData, "listingId");
  const listing = await findListingById(listingId);

  if (!listing || listing.status !== "active") {
    redirect("/cart?checkoutError=Listing+is+no+longer+available");
  }

  if (listing.sellerId === user.id) {
    redirect(`/cart?checkoutError=${encodeURIComponent("You may not purchase your own item.")}`);
  }

  const shippingAddress = await resolveCheckoutShippingAddress(formData, user);

  const stripe = getStripe();
  const seller = await findUserById(listing.sellerId);
  const destinationAccount = seller?.stripeOnboardingComplete ? seller.stripeAccountId : null;
  const applicationFeeAmount = destinationAccount ? Math.round(listing.price * 100 * 0.1) : undefined;
  const shippingAmount = listing.shippingPrice;

  const order = await createOrder({
    buyerId: user.id,
    buyerName: user.name,
    sellerId: listing.sellerId,
    sellerName: listing.sellerDisplayName,
    listingId: listing.id,
    listingTitle: listing.title,
    amount: listing.price + shippingAmount,
    subtotal: listing.price,
    shippingAmount,
    paymentMethod: "stripe_checkout",
    status: "pending_payment",
    listingStatus: listing.status,
    returnsAccepted: listing.returnsAccepted,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    shippingAddress,
    shippingMethod: listing.shippingMethod,
    carrier: null,
    trackingNumber: null,
    issueReason: null,
    sellerNotes: null,
    shippedAt: null,
    deliveredAt: null
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${getAppUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/cart?checkoutError=Checkout+was+canceled`,
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(listing.price * 100),
          product_data: {
            name: listing.title,
            description: `${listing.brand} - ${listing.material} - ${listing.pattern}`
          }
        }
      },
      ...(shippingAmount > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(shippingAmount * 100),
                product_data: {
                  name: "Shipping"
                }
              }
            }
          ]
        : [])
    ],
    shipping_address_collection: {
      allowed_countries: ["US", "CA"]
    },
    metadata: {
      orderId: order.id,
      listingId: listing.id
    },
    payment_intent_data:
      destinationAccount && applicationFeeAmount
        ? {
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
              destination: destinationAccount
            }
          }
        : undefined
  });

  await attachStripeSessionToOrder(order.id, session.id);

  if (!session.url) {
    redirect("/cart?checkoutError=Stripe+did+not+return+a+checkout+URL");
  }

  redirect(session.url);
}

export async function startCartStripeCheckoutAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/cart?checkoutError=Add+DATABASE_URL+to+enable+checkout");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/?authError=Buyer+account+required+to+checkout");
  }

  if (!isStripeConfigured()) {
    redirect("/cart?checkoutError=Stripe+is+not+configured+yet.+Add+STRIPE_SECRET_KEY+first");
  }

  const listingIds = formData
    .getAll("listingIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (!listingIds.length) {
    redirect("/cart?checkoutError=Your+cart+is+empty");
  }

  const listings = (await Promise.all(listingIds.map((listingId) => findListingById(listingId)))).filter(
    (listing): listing is NonNullable<typeof listing> => Boolean(listing)
  );

  if (!listings.length) {
    redirect("/cart?checkoutError=Your+cart+is+empty");
  }

  if (listings.some((listing) => listing.status !== "active")) {
    redirect("/cart?checkoutError=One+or+more+items+in+your+cart+are+no+longer+available");
  }

  if (listings.some((listing) => listing.sellerId === user.id)) {
    redirect(`/cart?checkoutError=${encodeURIComponent("You may not purchase your own item.")}`);
  }

  const sellerIds = new Set(listings.map((listing) => listing.sellerId));
  if (sellerIds.size > 1) {
    redirect(
      `/cart?checkoutError=${encodeURIComponent(
        "For now, checkout supports one seller at a time. Please remove items from other sellers and check out separately."
      )}`
    );
  }

  const shippingAddress = await resolveCheckoutShippingAddress(formData, user);
  const stripe = getStripe();
  const seller = await findUserById(listings[0].sellerId);
  const destinationAccount = seller?.stripeOnboardingComplete ? seller.stripeAccountId : null;
  const applicationFeeAmount = destinationAccount
    ? Math.round(listings.reduce((sum, listing) => sum + listing.price, 0) * 100 * 0.1)
    : undefined;

  const orders = await Promise.all(
    listings.map(async (listing) => {
      return createOrder({
        buyerId: user.id,
        buyerName: user.name,
        sellerId: listing.sellerId,
        sellerName: listing.sellerDisplayName,
        listingId: listing.id,
        listingTitle: listing.title,
        amount: listing.price + listing.shippingPrice,
        subtotal: listing.price,
        shippingAmount: listing.shippingPrice,
        paymentMethod: "stripe_checkout",
        status: "pending_payment",
        listingStatus: listing.status,
        returnsAccepted: listing.returnsAccepted,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        shippingAddress,
        shippingMethod: listing.shippingMethod,
        carrier: null,
        trackingNumber: null,
        issueReason: null,
        sellerNotes: null,
        shippedAt: null,
        deliveredAt: null
      });
    })
  );

  const lineItems = listings.flatMap((listing) => [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(listing.price * 100),
        product_data: {
          name: listing.title,
          description: `${listing.brand} - ${listing.material} - ${listing.pattern}`
        }
      }
    },
    ...(listing.shippingPrice > 0
      ? [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(listing.shippingPrice * 100),
              product_data: {
                name: `Shipping - ${listing.title}`
              }
            }
          }
        ]
      : [])
  ]);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${getAppUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/cart?checkoutError=Checkout+was+canceled`,
    customer_email: user.email,
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: ["US", "CA"]
    },
    metadata: {
      cartOrderIds: orders.map((order) => order.id).join(",")
    },
    payment_intent_data:
      destinationAccount && applicationFeeAmount
        ? {
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
              destination: destinationAccount
            }
          }
        : undefined
  });

  await Promise.all(orders.map((order) => attachStripeSessionToOrder(order.id, session.id)));

  if (!session.url) {
    redirect("/cart?checkoutError=Stripe+did+not+return+a+checkout+URL");
  }

  redirect(session.url);
}

export async function shipOrderAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const order = await findOrderById(orderId);
  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const carrier = stringValue(formData, "carrier");
  const trackingNumber = stringValue(formData, "trackingNumber");
  const sellerNotes = stringValue(formData, "sellerNotes") || null;

  if (!carrier || !trackingNumber) {
    redirect("/seller?authError=Carrier+and+tracking+are+required+to+ship");
  }

  await updateOrderShipping(orderId, carrier, trackingNumber, sellerNotes);
  const [buyer, listing] = await Promise.all([findUserById(order.buyerId), findListingById(order.listingId)]);

  if (buyer) {
    await sendOrderShippedNotifications({
      order: {
        ...order,
        status: "shipped",
        carrier,
        trackingNumber,
        sellerNotes,
        shippedAt: new Date().toISOString()
      },
      listing,
      buyer,
      seller: user
    });
  }

  revalidatePath("/seller");
  revalidatePath("/buyer");
  redirect("/seller?saved=shipment");
}

export async function buyShippoLabelAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const sellerNotes = stringValue(formData, "sellerNotes") || null;
  const order = await findOrderById(orderId);

  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const listing = await findListingById(order.listingId);
  if (!listing) {
    redirect("/seller?authError=Listing+not+found+for+this+order");
  }

  let purchasedLabel;

  try {
    purchasedLabel = await purchaseShippoLabel({
      order,
      listing,
      seller: user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shippo could not create a label for this order.";
    redirect(`/seller?authError=${encodeURIComponent(message)}`);
  }

  await updateOrderShippingWithProvider(orderId, {
    carrier: purchasedLabel.carrier,
    trackingNumber: purchasedLabel.trackingNumber,
    trackingUrl: purchasedLabel.trackingUrl,
    trackingStatus: purchasedLabel.trackingStatus,
    shippingEta: purchasedLabel.shippingEta,
    shippingLabelUrl: purchasedLabel.shippingLabelUrl,
    shippingProvider: purchasedLabel.shippingProvider,
    shippingProviderShipmentId: purchasedLabel.shippingProviderShipmentId,
    shippingProviderRateId: purchasedLabel.shippingProviderRateId,
    shippingProviderTransactionId: purchasedLabel.shippingProviderTransactionId,
    sellerNotes
  });

  const buyer = await findUserById(order.buyerId);
  if (buyer) {
    await sendOrderShippedNotifications({
      order: {
        ...order,
        status: "shipped",
        carrier: purchasedLabel.carrier,
        trackingNumber: purchasedLabel.trackingNumber,
        trackingUrl: purchasedLabel.trackingUrl,
        trackingStatus: purchasedLabel.trackingStatus,
        shippingEta: purchasedLabel.shippingEta,
        shippingLabelUrl: purchasedLabel.shippingLabelUrl,
        shippingProvider: purchasedLabel.shippingProvider,
        shippingProviderShipmentId: purchasedLabel.shippingProviderShipmentId,
        shippingProviderRateId: purchasedLabel.shippingProviderRateId,
        shippingProviderTransactionId: purchasedLabel.shippingProviderTransactionId,
        sellerNotes,
        shippedAt: new Date().toISOString()
      },
      listing,
      buyer,
      seller: user
    });
  }

  revalidatePath("/seller");
  revalidatePath("/buyer");
  redirect("/seller?saved=shippo-label");
}

export async function buySelectedShippoRateAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const shipmentId = stringValue(formData, "shipmentId");
  const rateId = stringValue(formData, "rateId");
  const sellerNotes = stringValue(formData, "sellerNotes") || null;
  const provider = stringValue(formData, "provider");
  const currency = stringValue(formData, "currency");
  const serviceLevel = stringValue(formData, "serviceLevel");
  const rateAmountRaw = stringValue(formData, "rateAmount");

  const order = await findOrderById(orderId);
  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const listing = await findListingById(order.listingId);
  if (!listing) {
    redirect("/seller?authError=Listing+not+found+for+this+order");
  }

  let purchasedLabel;

  try {
    purchasedLabel = await purchaseShippoLabelForRate({
      orderId,
      shipmentId,
      rateId,
      rate: {
        rateId,
        provider: provider || "Shippo",
        serviceLevel: serviceLevel || "Standard",
        amount: rateAmountRaw ? Number(rateAmountRaw) : null,
        currency: currency || null,
        estimatedDays: null,
        durationTerms: null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shippo could not create a label for this order.";
    redirect(`/seller?authError=${encodeURIComponent(message)}`);
  }

  await updateOrderShippingWithProvider(orderId, {
    carrier: purchasedLabel.carrier,
    trackingNumber: purchasedLabel.trackingNumber,
    trackingUrl: purchasedLabel.trackingUrl,
    trackingStatus: purchasedLabel.trackingStatus,
    shippingEta: purchasedLabel.shippingEta,
    shippingLabelUrl: purchasedLabel.shippingLabelUrl,
    shippingProvider: purchasedLabel.shippingProvider,
    shippingProviderShipmentId: purchasedLabel.shippingProviderShipmentId,
    shippingProviderRateId: purchasedLabel.shippingProviderRateId,
    shippingProviderTransactionId: purchasedLabel.shippingProviderTransactionId,
    sellerNotes
  });

  const buyer = await findUserById(order.buyerId);
  if (buyer) {
    await sendOrderShippedNotifications({
      order: {
        ...order,
        status: "shipped",
        carrier: purchasedLabel.carrier,
        trackingNumber: purchasedLabel.trackingNumber,
        trackingUrl: purchasedLabel.trackingUrl,
        trackingStatus: purchasedLabel.trackingStatus,
        shippingEta: purchasedLabel.shippingEta,
        shippingLabelUrl: purchasedLabel.shippingLabelUrl,
        shippingProvider: purchasedLabel.shippingProvider,
        shippingProviderShipmentId: purchasedLabel.shippingProviderShipmentId,
        shippingProviderRateId: purchasedLabel.shippingProviderRateId,
        shippingProviderTransactionId: purchasedLabel.shippingProviderTransactionId,
        sellerNotes,
        shippedAt: new Date().toISOString()
      },
      listing,
      buyer,
      seller: user
    });
  }

  revalidatePath("/seller");
  revalidatePath("/buyer");
  redirect("/seller?saved=shippo-rate");
}

export async function confirmDeliveryAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+update+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/?authError=Buyer+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const returnTo = stringValue(formData, "returnTo");
  const order = await findOrderById(orderId);
  if (!order || order.buyerId !== user.id) {
    redirect("/buyer?authError=Order+not+found");
  }

  if (["canceled", "refunded", "failed"].includes(order.status)) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}authError=Canceled+orders+cannot+be+rated`);
  }

  await markOrderDelivered(orderId);
  await markListingSold(order.listingId);
  revalidatePath("/buyer");
  revalidatePath("/seller");
  redirect(returnTo || "/buyer?saved=delivered");
}

export async function saveOrderRatingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer?authError=Add+DATABASE_URL+to+rate+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/?authError=Buyer+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const rating = Number(stringValue(formData, "rating"));
  const order = await findOrderById(orderId);

  if (!order || order.buyerId !== user.id) {
    redirect("/buyer?authError=Order+not+found");
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}authError=Choose+a+rating+from+1+to+5`);
  }

  const existingReview = await findOrderReviewByOrderId(orderId);
  if (existingReview) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}authError=Review+already+saved+and+cannot+be+edited`);
  }

  await saveOrderReview({
    orderId,
    buyerId: user.id,
    sellerId: order.sellerId,
    overallRating: rating,
    measurementRating: null,
    conditionRating: null,
    shippingRating: null,
    communicationRating: null,
    feedback: ""
  });

  revalidatePath("/buyer");
  revalidatePath("/buyer/orders");
  revalidatePath(`/buyer/orders/${orderId}/rate`);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=rating&ratedOrder=${orderId}`);
}

export async function saveOrderReviewAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/buyer/orders?authError=Add+DATABASE_URL+to+rate+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/?authError=Buyer+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const submittedOverallRating = Number(stringValue(formData, "overallRating"));
  const measurementRatingRaw = stringValue(formData, "measurementRating");
  const conditionRatingRaw = stringValue(formData, "conditionRating");
  const shippingRatingRaw = stringValue(formData, "shippingRating");
  const communicationRatingRaw = stringValue(formData, "communicationRating");
  const feedback = stringValue(formData, "feedback").slice(0, 1000);
  const order = await findOrderById(orderId);

  if (!order || order.buyerId !== user.id) {
    redirect("/buyer/orders?authError=Order+not+found");
  }

  if (["canceled", "refunded", "failed"].includes(order.status)) {
    redirect("/buyer?authError=Canceled+orders+cannot+be+rated");
  }

  const existingReview = await findOrderReviewByOrderId(orderId);
  if (existingReview && reviewHasDetailedContent(existingReview)) {
    redirect("/buyer?authError=Review+already+saved+and+cannot+be+edited");
  }

  const overallRating = existingReview?.overallRating ?? submittedOverallRating;
  if (!Number.isFinite(overallRating) || overallRating < 1 || overallRating > 5) {
    redirect(`/buyer/orders/${orderId}/rate?authError=Choose+an+overall+rating+from+1+to+5`);
  }

  const parseOptionalRating = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
  };

  await saveOrderReview({
    orderId,
    buyerId: user.id,
    sellerId: order.sellerId,
    overallRating,
    measurementRating: parseOptionalRating(measurementRatingRaw),
    conditionRating: parseOptionalRating(conditionRatingRaw),
    shippingRating: parseOptionalRating(shippingRatingRaw),
    communicationRating: parseOptionalRating(communicationRatingRaw),
    feedback
  });

  revalidatePath("/buyer");
  revalidatePath("/buyer/orders");
  revalidatePath(`/buyer/orders/${orderId}/rate`);
  redirect(`/buyer?saved=rating&ratedOrder=${orderId}`);
}

export async function openIssueAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/?authError=Add+DATABASE_URL+to+manage+orders");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/?authError=Please+log+in");
  }

  const orderId = stringValue(formData, "orderId");
  const reason = stringValue(formData, "issueReason");
  const returnTo = stringValue(formData, "returnTo");
  const order = await findOrderById(orderId);

  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id)) {
    redirect("/?authError=Order+not+found");
  }

  await updateOrderIssue(orderId, "issue_open", reason || "Issue reported", null);
  revalidatePath("/buyer");
  revalidatePath("/seller");
  redirect(returnTo || `/${order.buyerId === user.id ? "buyer" : "seller"}?saved=issue`);
}

export async function resolveIssueAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+manage+orders");
  const user = await getCurrentUser();
  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const orderId = stringValue(formData, "orderId");
  const resolution = stringValue(formData, "resolution");
  const sellerNotes = stringValue(formData, "sellerNotes") || null;
  const order = await findOrderById(orderId);

  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  if (resolution === "refund") {
    await updateOrderIssue(orderId, "refunded", order.issueReason, sellerNotes);
    await reopenListing(order.listingId);
  } else if (resolution === "cancel") {
    await updateOrderIssue(orderId, "canceled", order.issueReason, sellerNotes);
    await reopenListing(order.listingId);
  } else {
    await updateOrderIssue(orderId, "processing", null, sellerNotes);
  }

  revalidatePath("/seller");
  revalidatePath("/buyer");
  revalidatePath("/");
  redirect("/seller?saved=issue-resolution");
}

export async function createStripeConnectOnboardingAction() {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+enable+seller+payouts");
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+for+Stripe+Connect");
  }

  if (!isStripeConfigured()) {
    redirect("/?authError=Stripe+is+not+configured+yet");
  }

  const stripe = getStripe();
  let stripeAccountId = user.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      business_type: "individual",
      metadata: {
        platformUserId: user.id
      }
    });

    stripeAccountId = account.id;
    await updateUserStripeAccount(user.id, stripeAccountId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${getAppUrl()}/seller/connect/refresh`,
    return_url: `${getAppUrl()}/seller/connect/return`,
    type: "account_onboarding"
  });

  redirect(accountLink.url);
}

export async function finalizeStripeOnboardingAction() {
  redirectIfDatabaseUnavailable("/seller?authError=Add+DATABASE_URL+to+enable+seller+payouts");
  const user = await getCurrentUser();

  if (!user?.stripeAccountId || !isStripeConfigured()) {
    redirect("/?authError=Stripe+Connect+is+not+ready");
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  const completed = Boolean(account.details_submitted && account.charges_enabled);
  await markUserStripeOnboardingComplete(user.id, completed);
  revalidatePath("/");
  revalidatePath("/seller");
  redirect(completed ? "/seller?saved=stripe-connect" : "/seller?authError=Stripe+onboarding+is+not+complete+yet");
}

export async function buyNowAction(formData: FormData) {
  const listingId = stringValue(formData, "listingId");
  const returnTo = stringValue(formData, "returnTo");
  const user = await getCurrentUser();
  const listing = await findListingById(listingId);

  if (!listing) {
    redirect(returnTo || "/");
  }

  if (user?.id && listing.sellerId === user.id) {
    const destination = returnTo || `/listings/${listing.id}`;
    redirect(withUpdatedQueryParam(destination, "authError", "You may not purchase your own item."));
  }

  await addToCart(listingId);
  revalidatePath("/", "layout");
  revalidatePath("/cart");
  redirect("/cart");
}

export async function makeOfferAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/?authError=Add+DATABASE_URL+to+enable+offers");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+or+create+an+account+to+make+an+offer");
  }

  const listingId = stringValue(formData, "listingId");
  const amount = currencyNumberValue(formData, "amount");
  const message = stringValue(formData, "message");
  const listing = await findListingById(listingId);

  if (!listing || listing.status !== "active") {
    redirect("/?authError=Listing+is+no+longer+available");
  }

  if (!listing.allowOffers) {
    redirect(`/listings/${listing.id}?authError=Offers+are+not+enabled+for+this+item`);
  }

  if (listing.sellerId === user.id) {
    redirect(`/listings/${listing.id}?authError=${encodeURIComponent("You may not make an offer for your own item.")}`);
  }

  const amountError = validateOfferAmount(amount);
  if (amountError) {
    redirect(`/listings/${listing.id}?intent=offer&authError=${encodeURIComponent(amountError)}`);
  }

  const bodyError = message ? validateMessageBody(message) : null;
  if (bodyError) {
    redirect(`/listings/${listing.id}?intent=offer&authError=${encodeURIComponent(bodyError)}`);
  }

  await createOffer({
    buyerId: user.id,
    sellerId: listing.sellerId,
    listingId: listing.id,
    amount,
    message: message || null
  });

  revalidatePath("/buyer");
  revalidatePath(`/listings/${listing.id}`);
  redirect("/buyer?saved=offer");
}

export async function clearCartAction() {
  await clearCart();
  revalidatePath("/", "layout");
  revalidatePath("/cart");
}

export async function startListingMessageThreadAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/messages?authError=Add+DATABASE_URL+to+enable+messaging");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+message+a+seller");
  }

  const listingId = stringValue(formData, "listingId");
  const body = stringValue(formData, "messageBody");
  const listing = await findListingById(listingId);

  if (!listing) {
    redirect("/messages?authError=Listing+not+found");
  }

  if (listing.sellerId === user.id) {
    redirect(`/messages?authError=${encodeURIComponent("You can't message yourself about your own listing.")}`);
  }

  const bodyError = validateMessageBody(body);
  if (bodyError) {
    redirect(`/messages?listingId=${encodeURIComponent(listingId)}&authError=${encodeURIComponent(bodyError)}`);
  }

  const thread = await getOrCreateListingMessageThread({
    buyerId: user.id,
    sellerId: listing.sellerId,
    listingId: listing.id,
    subject: listing.title
  });

  const message = await sendMessageInThread({
    threadId: thread.id,
    senderId: user.id,
    body
  });

  const recipient = await findUserById(listing.sellerId);
  if (recipient) {
    await sendDirectMessageNotification({
      messageId: message.id,
      thread,
      sender: user,
      recipient,
      body
    });
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${thread.id}`);
  revalidatePath(`/listings/${listing.id}`);
  redirect(`/messages?thread=${thread.id}`);
}

export async function startDirectMessageThreadAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/messages?authError=Add+DATABASE_URL+to+enable+messaging");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+send+a+message");
  }

  const username = stringValue(formData, "recipientUsername").toLowerCase();
  const subject = stringValue(formData, "subject");
  const body = stringValue(formData, "messageBody");

  if (!username || !subject || !body) {
    redirect("/messages?compose=1&authError=Complete+the+recipient,+subject,+and+message");
  }

  const subjectError = validateMessageSubject(subject);
  if (subjectError) {
    redirect(`/messages?compose=1&authError=${encodeURIComponent(subjectError)}`);
  }

  const bodyError = validateMessageBody(body);
  if (bodyError) {
    redirect(`/messages?compose=1&authError=${encodeURIComponent(bodyError)}`);
  }

  const recipient = await findUserByUsername(username);

  if (!recipient) {
    redirect("/messages?compose=1&authError=That+username+was+not+found");
  }

  if (recipient.id === user.id) {
    redirect("/messages?compose=1&authError=You+cannot+start+a+conversation+with+yourself");
  }

  const thread = await createDirectMessageThread({
    senderId: user.id,
    recipientId: recipient.id,
    subject
  });

  const message = await sendMessageInThread({
    threadId: thread.id,
    senderId: user.id,
    body
  });

  if (recipient) {
    await sendDirectMessageNotification({
      messageId: message.id,
      thread,
      sender: user,
      recipient,
      body
    });
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${thread.id}`);
  redirect(`/messages?thread=${thread.id}`);
}

export async function sendMessageReplyAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/messages?authError=Add+DATABASE_URL+to+enable+messaging");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+send+a+message");
  }

  const threadId = stringValue(formData, "threadId");
  const body = stringValue(formData, "messageBody");

  const bodyError = validateMessageBody(body);
  if (bodyError) {
    redirect(`/messages?thread=${threadId}&authError=${encodeURIComponent(bodyError)}`);
  }

  const thread = await findMessageThreadByIdForUser(user.id, threadId);

  if (!thread) {
    redirect("/messages?authError=Conversation+not+found");
  }

  const message = await sendMessageInThread({
    threadId,
    senderId: user.id,
    body
  });

  const recipientUserId = thread.buyerId === user.id ? thread.sellerId : thread.buyerId;
  const recipient = await findUserById(recipientUserId);
  if (recipient) {
    await sendDirectMessageNotification({
      messageId: message.id,
      thread,
      sender: user,
      recipient,
      body
    });
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${threadId}`);
  redirect(`/messages?thread=${threadId}`);
}

export async function deleteMessageThreadAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/messages?authError=Add+DATABASE_URL+to+enable+messaging");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+manage+messages");
  }

  const threadId = stringValue(formData, "threadId");
  const deleted = await deleteMessageThreadForUser(user.id, threadId);

  if (!deleted) {
    redirect("/messages?authError=Conversation+not+found");
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/", "layout");
  redirect(`/messages?conversationDeleted=${encodeURIComponent(threadId)}`);
}

export async function restoreMessageThreadAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/messages?authError=Add+DATABASE_URL+to+enable+messaging");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+manage+messages");
  }

  const threadId = stringValue(formData, "threadId");
  const restored = await restoreMessageThreadForUser(user.id, threadId);

  if (!restored) {
    redirect("/messages?authError=Conversation+not+found");
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/", "layout");
  redirect(`/messages?thread=${encodeURIComponent(threadId)}`);
}

export async function toggleFollowUserAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+save+users");
  const viewer = await getCurrentUser();

  if (!viewer) {
    redirect("/login?authError=Please+log+in+to+save+users");
  }

  const username = stringValue(formData, "username");
  const returnTo = stringValue(formData, "returnTo") || `/users/${username}`;
  const targetUser = await findUserByUsername(username);

  if (!targetUser) {
    redirect("/users");
  }

  if (targetUser.id === viewer.id) {
    redirect(returnTo);
  }

  const alreadyFollowing = await isFollowingUser(viewer.id, targetUser.id);

  if (alreadyFollowing) {
    await unfollowUser(viewer.id, targetUser.id);
  } else {
    await followUser(viewer.id, targetUser.id);
  }

  revalidatePath("/users");
  revalidatePath(`/users/${targetUser.username}`);
  redirect(returnTo);
}

export async function toggleSaveListingAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+save+items");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+or+create+an+account+to+save+items");
  }

  const listingId = stringValue(formData, "listingId");
  const returnTo = stringValue(formData, "returnTo") || "/";
  const listing = await findListingById(listingId);

  if (!listing) {
    redirect("/");
  }

  const alreadySaved = await isListingSavedByUser(user.id, listingId);

  if (alreadySaved) {
    await unsaveListingForUser(user.id, listingId);
  } else {
    await saveListingForUser(user.id, listingId);
  }

  revalidatePath("/");
  revalidatePath("/buyer");
  revalidatePath(`/listings/${listingId}`);
  redirect(returnTo);
}

export async function saveMarketplaceSearchAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+save+searches");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+or+create+an+account+to+save+searches");
  }

  const serialized = serializeMarketplaceSearchForm(formData);
  const returnTo = serialized ? `/?${serialized}` : "/";

  const existing = await listSavedSearchesForUser(user.id);
  if (existing.some((savedSearch) => savedSearch.queryString === serialized)) {
    redirect(returnTo);
  }

  await createSavedSearch({
    userId: user.id,
    name: buildSavedSearchName(serialized, existing),
    queryString: serialized
  });

  revalidatePath("/");
  revalidatePath("/buyer");
  redirect(returnTo);
}

export async function deleteSavedSearchAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+manage+saved+searches");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+to+manage+saved+searches");
  }

  const savedSearchId = stringValue(formData, "savedSearchId");
  const returnTo = stringValue(formData, "returnTo") || "/";

  if (!savedSearchId) {
    redirect(returnTo);
  }

  await deleteSavedSearch(user.id, savedSearchId);
  revalidatePath("/");
  revalidatePath("/buyer");
  redirect(returnTo);
}

export async function renameSavedSearchAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+manage+saved+searches");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+to+manage+saved+searches");
  }

  const savedSearchId = stringValue(formData, "savedSearchId");
  const returnTo = stringValue(formData, "returnTo") || "/buyer";
  const name = stringValue(formData, "name").trim();

  if (!savedSearchId || !name) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}authError=Enter+a+name+for+the+saved+search`);
  }

  await updateSavedSearchName(user.id, savedSearchId, name.slice(0, 60));
  revalidatePath("/");
  revalidatePath("/buyer");
  redirect(returnTo);
}

export async function updateSavedSearchQueryAction(formData: FormData) {
  redirectIfDatabaseUnavailable("/login?authError=Add+DATABASE_URL+to+manage+saved+searches");
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+to+manage+saved+searches");
  }

  const savedSearchId = stringValue(formData, "savedSearchId");
  if (!savedSearchId) {
    redirect("/");
  }

  const serialized = serializeMarketplaceSearchForm(formData);
  const existing = await listSavedSearchesForUser(user.id);
  const duplicate = existing.find(
    (savedSearch) => savedSearch.queryString === serialized && savedSearch.id !== savedSearchId
  );

  if (duplicate) {
    const duplicateHref = duplicate.queryString ? `/?savedSearchId=${duplicate.id}&${duplicate.queryString}` : `/?savedSearchId=${duplicate.id}`;
    redirect(duplicateHref);
  }

  await updateSavedSearchQuery(user.id, savedSearchId, serialized);
  revalidatePath("/");
  revalidatePath("/buyer");
  const returnTo = serialized ? `/?savedSearchId=${savedSearchId}&${serialized}` : `/?savedSearchId=${savedSearchId}`;
  redirect(returnTo);
}
