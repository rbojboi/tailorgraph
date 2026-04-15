import type {
  BuyerFitPreference,
  BuyerProfile,
  BuyerSuggestedMeasurementRanges,
  JacketMeasurements,
  TrouserMeasurements,
  WaistcoatMeasurements
} from "@/lib/types";
import {
  rateGeneratedBuyerMeasurementOutputs,
  runBuyerBodyMeasurementSanityCheck,
  type BuyerBodyMeasurementInputs,
  type BuyerBodyMeasurementSanityCheckResult,
  type BuyerGeneratedCategoryConfidence,
  type BuyerGeneratedMeasurementConfidenceReport,
  type BuyerGeneratedFieldConfidence
} from "@/lib/measurement-guide-support";

type BodyInputs = BuyerBodyMeasurementInputs & {
  fitPreference: BuyerFitPreference;
};

type Confidence = "low" | "medium" | "high";
type AnchorCategory = "jacket" | "shirt" | "waistcoat" | "trousers" | "coat" | "sweater";
type SourceQuality = "high" | "medium" | "low" | "none";
type InferredReferenceInputs = BodyInputs;
type CanonicalMeasurementOutputs = {
  suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges;
  jacketMeasurements: JacketMeasurements | null;
  shirtMeasurements: JacketMeasurements | null;
  sweaterMeasurements: JacketMeasurements | null;
  coatMeasurements: JacketMeasurements | null;
  waistcoatMeasurements: WaistcoatMeasurements | null;
  trouserMeasurements: TrouserMeasurements | null;
};

function clampQuarter(value: number) {
  return Number((Math.round(Math.max(0, value) * 4) / 4).toFixed(2));
}

function clampToRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function midpoint(min: number, max: number) {
  return clampQuarter((min + max) / 2);
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveConfidence(inputs: BodyInputs): Confidence {
  const provided = [
    inputs.height,
    inputs.weight,
    inputs.chest,
    inputs.waist,
    inputs.hips,
    inputs.shoulders,
    inputs.sleeveLength,
    inputs.neck
  ].filter((value) => value !== null).length;

  if (provided >= 6) {
    return "high";
  }

  if (provided >= 4) {
    return "medium";
  }

  return "low";
}

function fitEase(fitPreference: BuyerFitPreference) {
  switch (fitPreference) {
    case "trim":
      return { jacket: 3, shirt: 2.5, coat: 5, sweater: 2.5, waistcoat: 2.5 };
    case "relaxed":
      return { jacket: 5, shirt: 4, coat: 7.5, sweater: 4.5, waistcoat: 4 };
    case "classic":
    default:
      return { jacket: 4, shirt: 3.25, coat: 6.5, sweater: 3.5, waistcoat: 3.25 };
  }
}

function rangeFromCenter(center: number, width: number, confidence: Confidence) {
  const anchoredHalfSpread = Math.max(width / 2, 0.25);
  const min = clampQuarter(center - anchoredHalfSpread);
  const max = clampQuarter(center + anchoredHalfSpread);
  return { min, max, confidence };
}

function verticalRange(base: number, fitPreference: BuyerFitPreference, confidence: Confidence, extra = 0) {
  const fitOffset = fitPreference === "trim" ? -0.25 : fitPreference === "relaxed" ? 0.5 : 0;
  return rangeFromCenter(base + fitOffset + extra, 0.5, confidence);
}

function directRange(base: number, extra: number, confidence: Confidence, width = 0.5) {
  return rangeFromCenter(base + extra, width, confidence);
}

function multiplierByFit(
  fitPreference: BuyerFitPreference,
  values: { trim: number; classic: number; relaxed: number }
) {
  if (fitPreference === "trim") {
    return values.trim;
  }

  if (fitPreference === "relaxed") {
    return values.relaxed;
  }

  return values.classic;
}

function jacketLikeTargets(
  chest: number,
  waist: number,
  shoulders: number,
  sleeveLength: number,
  bodyLength: number,
  ease: number,
  fitPreference: BuyerFitPreference,
  confidence: Confidence,
  neck?: number
) {
  return {
    ...(neck ? { neck: directRange(neck, 0.5, confidence) } : {}),
    chest: rangeFromCenter(chest / 2 + ease / 2, 0.5, confidence),
    waist: rangeFromCenter(waist / 2 + Math.max(ease - 1, 2) / 2, 0.5, confidence),
    shoulders: rangeFromCenter(shoulders, 0.5, confidence),
    bodyLength: verticalRange(bodyLength, fitPreference, confidence),
    sleeveLength: directRange(sleeveLength, -0.25, confidence)
  };
}

function buildProfileFromSuggested(suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges) {
  const { jacket, shirt, sweater, coat, waistcoat, trousers } = suggestedMeasurementRanges;

  return {
    jacketMeasurements: jacket
      ? {
          chest: midpoint(jacket.chest.min, jacket.chest.max),
          waist: midpoint(jacket.waist.min, jacket.waist.max),
          shoulders: midpoint(jacket.shoulders.min, jacket.shoulders.max),
          bodyLength: midpoint(jacket.bodyLength.min, jacket.bodyLength.max),
          sleeveLength: midpoint(jacket.sleeveLength.min, jacket.sleeveLength.max),
          sleeveLengthAllowance: 0
        }
      : null,
    shirtMeasurements: shirt
      ? {
          neck: shirt.neck ? midpoint(shirt.neck.min, shirt.neck.max) : undefined,
          chest: midpoint(shirt.chest.min, shirt.chest.max),
          waist: midpoint(shirt.waist.min, shirt.waist.max),
          shoulders: midpoint(shirt.shoulders.min, shirt.shoulders.max),
          bodyLength: midpoint(shirt.bodyLength.min, shirt.bodyLength.max),
          sleeveLength: midpoint(shirt.sleeveLength.min, shirt.sleeveLength.max),
          sleeveLengthAllowance: 0
        }
      : null,
    sweaterMeasurements: sweater
      ? {
          chest: midpoint(sweater.chest.min, sweater.chest.max),
          waist: midpoint(sweater.waist.min, sweater.waist.max),
          shoulders: midpoint(sweater.shoulders.min, sweater.shoulders.max),
          bodyLength: midpoint(sweater.bodyLength.min, sweater.bodyLength.max),
          sleeveLength: midpoint(sweater.sleeveLength.min, sweater.sleeveLength.max),
          sleeveLengthAllowance: 0
        }
      : null,
    coatMeasurements: coat
      ? {
          chest: midpoint(coat.chest.min, coat.chest.max),
          waist: midpoint(coat.waist.min, coat.waist.max),
          shoulders: midpoint(coat.shoulders.min, coat.shoulders.max),
          bodyLength: midpoint(coat.bodyLength.min, coat.bodyLength.max),
          sleeveLength: midpoint(coat.sleeveLength.min, coat.sleeveLength.max),
          sleeveLengthAllowance: 0
        }
      : null,
    waistcoatMeasurements: waistcoat
      ? {
          chest: midpoint(waistcoat.chest.min, waistcoat.chest.max),
          waist: midpoint(waistcoat.waist.min, waistcoat.waist.max),
          shoulders: midpoint(waistcoat.shoulders.min, waistcoat.shoulders.max),
          bodyLength: midpoint(waistcoat.bodyLength.min, waistcoat.bodyLength.max)
        }
      : null,
    trouserMeasurements: trousers
      ? {
          waist: midpoint(trousers.waist.min, trousers.waist.max),
          waistAllowance: 0,
          hips: midpoint(trousers.hips.min, trousers.hips.max),
          inseam: midpoint(trousers.inseam.min, trousers.inseam.max),
          inseamOutseamAllowance: 0,
          outseam: midpoint(trousers.outseam.min, trousers.outseam.max),
          opening: midpoint(trousers.opening.min, trousers.opening.max)
        }
      : null
  };
}

function canonicalizeBodyInputs(inputs: BodyInputs) {
  const chest = inputs.chest ?? 40;
  const waist = inputs.waist ?? 34;
  const hips = inputs.hips ?? waist + 6.5;
  const shoulders = inputs.shoulders ?? 18;
  const sleeveLength = inputs.sleeveLength ?? 34;
  const height = inputs.height ?? 71;
  const neck = inputs.neck ?? 15.5;

  return { chest, waist, hips, shoulders, sleeveLength, height, neck };
}

function bodyInputsFromProfile(profile: BuyerProfile): BodyInputs {
  return {
    height: profile.height || null,
    weight: profile.weight || null,
    chest: profile.chest || null,
    waist: profile.waist || null,
    hips: profile.trouserMeasurements?.hips ? profile.trouserMeasurements.hips * 2 - 2.25 : null,
    shoulders: profile.shoulder || null,
    sleeveLength: profile.sleeve || null,
    neck: profile.neck || null,
    fitPreference: profile.fitPreference
  };
}

function openingDefault(height: number, fitPreference: BuyerFitPreference) {
  const shorterOpeningDefaults =
    fitPreference === "trim" ? 7.5 : fitPreference === "relaxed" ? 9.5 : 8.5;
  const tallerOpeningDefaults =
    fitPreference === "trim" ? 8 : fitPreference === "relaxed" ? 10 : 9;

  return height < 69 ? shorterOpeningDefaults : tallerOpeningDefaults;
}

function generateCanonicalMeasurementOutputs(
  inputs: BodyInputs,
  confidence: Confidence
): CanonicalMeasurementOutputs {
  const ease = fitEase(inputs.fitPreference);
  const { chest, waist, hips, shoulders, sleeveLength, height, neck } = canonicalizeBodyInputs(inputs);

  const jacketBodyLength = height * multiplierByFit(inputs.fitPreference, { trim: 0.42, classic: 0.43, relaxed: 0.44 });
  const shirtBodyLength = height * 0.42;
  const coatBodyLength = height * multiplierByFit(inputs.fitPreference, { trim: 0.54, classic: 0.56, relaxed: 0.58 });
  const sweaterBodyLength = height * multiplierByFit(inputs.fitPreference, { trim: 0.39, classic: 0.4, relaxed: 0.41 });
  const waistcoatBodyLength = height * 0.32;

  const jacket = jacketLikeTargets(
    chest,
    waist,
    shoulders,
    sleeveLength,
    jacketBodyLength,
    ease.jacket,
    inputs.fitPreference,
    confidence
  );
  jacket.bodyLength = directRange(jacketBodyLength, 0, confidence, 0.5);

  const shirt = jacketLikeTargets(
    chest,
    waist,
    shoulders,
    sleeveLength,
    shirtBodyLength,
    ease.shirt,
    inputs.fitPreference,
    confidence,
    neck
  );
  shirt.sleeveLength = directRange(sleeveLength, 0, confidence);
  shirt.bodyLength = directRange(shirtBodyLength, 0, confidence, 2);

  const coat = jacketLikeTargets(
    chest,
    waist,
    shoulders,
    sleeveLength,
    coatBodyLength,
    ease.coat,
    inputs.fitPreference,
    confidence
  );
  coat.shoulders = rangeFromCenter(shoulders + 0.5, 0.5, confidence);
  coat.sleeveLength = directRange(sleeveLength, 0.25, confidence);
  coat.bodyLength = directRange(coatBodyLength, 0, confidence, 4);

  const sweater = {
    chest: rangeFromCenter(chest / 2 + ease.sweater / 2, 0.5, confidence),
    waist: rangeFromCenter(waist / 2 + Math.max(ease.sweater - 0.5, 2) / 2, 0.5, confidence),
    shoulders: rangeFromCenter(shoulders, 0.5, confidence),
    bodyLength: directRange(sweaterBodyLength, 0, confidence, 1),
    sleeveLength: directRange(sleeveLength, 0, confidence, 1)
  };

  const waistcoat = {
    chest: rangeFromCenter(chest / 2 + ease.waistcoat / 2, 0.5, confidence),
    waist: rangeFromCenter(waist / 2 + Math.max(ease.waistcoat - 0.5, 2) / 2, 0.5, confidence),
    shoulders: rangeFromCenter(shoulders * 0.72, 1.5, confidence),
    bodyLength: directRange(waistcoatBodyLength, 0, confidence, 1)
  };

  const trousers = {
    waist: rangeFromCenter((waist + (inputs.fitPreference === "trim" ? 0.5 : inputs.fitPreference === "relaxed" ? 1.5 : 1)) / 2, 0.5, confidence),
    hips: rangeFromCenter((hips + (inputs.fitPreference === "trim" ? 1.5 : inputs.fitPreference === "relaxed" ? 3 : 2.25)) / 2, 1, confidence),
    inseam: directRange(height * 0.43, 0, confidence, 1),
    outseam: directRange(height * 0.59, 0, confidence, 1),
    opening: rangeFromCenter(openingDefault(height, inputs.fitPreference), 0.5, confidence)
  };

  const suggestedMeasurementRanges = {
    fitPreference: inputs.fitPreference,
    jacket,
    shirt,
    coat,
    sweater,
    trousers,
    waistcoat
  };

  return {
    suggestedMeasurementRanges,
    ...buildProfileFromSuggested(suggestedMeasurementRanges)
  };
}

function sourceQualityScore(quality: SourceQuality) {
  switch (quality) {
    case "high":
      return 92;
    case "medium":
      return 74;
    case "low":
      return 56;
    case "none":
    default:
      return 38;
  }
}

function sourceQualityReason(label: string, quality: SourceQuality, anchorCategory: AnchorCategory) {
  switch (quality) {
    case "high":
      return `${label} was inferred cleanly from the ${anchorCategory} anchor using the canonical measurement formulas.`;
    case "medium":
      return `${label} was inferred from the ${anchorCategory} anchor with a moderate amount of back-solving.`;
    case "low":
      return `${label} relies on a noisier heuristic from the ${anchorCategory} anchor and should be treated more cautiously.`;
    case "none":
    default:
      return `${label} could not be inferred cleanly from the ${anchorCategory} anchor and therefore remains a weak estimate.`;
  }
}

function inferChestFromGarmentHalfWidth(width: number, ease: number) {
  return 2 * (width - ease / 2);
}

function inferWaistFromGarmentHalfWidth(width: number, waistAllowance: number) {
  return 2 * (width - waistAllowance / 2);
}

function inferHeightFromBodyLength(length: number, fitPreference: BuyerFitPreference, category: Exclude<AnchorCategory, "trousers">) {
  switch (category) {
    case "shirt":
      return length / 0.42;
    case "coat":
      return length / multiplierByFit(fitPreference, { trim: 0.54, classic: 0.56, relaxed: 0.58 });
    case "sweater":
      return length / multiplierByFit(fitPreference, { trim: 0.39, classic: 0.4, relaxed: 0.41 });
    case "waistcoat":
      return length / 0.32;
    case "jacket":
    default:
      return length / multiplierByFit(fitPreference, { trim: 0.42, classic: 0.43, relaxed: 0.44 });
  }
}

function buildAnchorFieldConfidence(
  anchorCategory: AnchorCategory,
  label: string,
  qualities: SourceQuality[],
  penalties: string[] = []
): BuyerGeneratedFieldConfidence {
  const baseScore = Math.round(average(qualities.map(sourceQualityScore)));
  let score = baseScore - penalties.length * 8;

  if (qualities.includes("none")) {
    score = Math.min(score, 48);
  }

  const confidenceScore = roundScore(score);
  const reasons = [
    ...qualities.map((quality) => sourceQualityReason(label, quality, anchorCategory)),
    ...penalties
  ];

  return {
    confidenceLevel: confidenceScore >= 80 ? "high" : confidenceScore >= 60 ? "medium" : "low",
    confidenceScore,
    reasons
  };
}

function buildCategoryConfidenceFromFields(fields: BuyerGeneratedFieldConfidence[]): BuyerGeneratedCategoryConfidence {
  const confidenceScore = roundScore(average(fields.map((field) => field.confidenceScore)));
  return {
    confidenceLevel: confidenceScore >= 80 ? "high" : confidenceScore >= 60 ? "medium" : "low",
    confidenceScore,
    reasons: fields.flatMap((field) => field.reasons).slice(0, 3)
  };
}

function getAnchorSleeveLength(
  anchorCategory: AnchorCategory,
  anchor:
    | Partial<JacketMeasurements>
    | Partial<WaistcoatMeasurements>
    | null
    | undefined,
  profile: BuyerProfile
) {
  if (!anchor) {
    return profile.sleeve || null;
  }

  if (anchorCategory === "waistcoat") {
    return profile.sleeve || null;
  }

  return "sleeveLength" in anchor ? anchor.sleeveLength ?? null : null;
}

function inferUpperBodyReferenceInputsFromAnchor(
  profile: BuyerProfile,
  anchorCategory: Exclude<AnchorCategory, "trousers">,
  confidence: Confidence
): {
  inferredInputs: InferredReferenceInputs;
  outputConfidence: BuyerGeneratedMeasurementConfidenceReport;
} {
  const fitPreference = profile.fitPreference;
  const ease = fitEase(fitPreference);
  const anchor =
    anchorCategory === "shirt"
      ? profile.shirtMeasurements
      : anchorCategory === "coat"
        ? profile.coatMeasurements
        : anchorCategory === "sweater"
          ? profile.sweaterMeasurements
          : anchorCategory === "waistcoat"
            ? profile.waistcoatMeasurements
            : profile.jacketMeasurements;

  if (!anchor) {
    const fallbackInputs: InferredReferenceInputs = {
      height: profile.height || 71,
      weight: profile.weight || null,
      chest: profile.chest || 40,
      waist: profile.waist || 34,
      hips: profile.trouserMeasurements?.hips ?? null,
      shoulders: profile.shoulder || 18,
      sleeveLength: profile.sleeve || 34,
      neck: profile.neck || null,
      fitPreference
    };

    return {
      inferredInputs: fallbackInputs,
      outputConfidence: rateGeneratedBuyerMeasurementOutputs(fallbackInputs)
    };
  }

  const sourceQualities: Record<string, SourceQuality> = {
    chest: "none",
    waist: "none",
    hips: profile.trouserMeasurements?.hips ? "medium" : "low",
    shoulders: "none",
    sleeveLength: "none",
    neck:
      anchorCategory === "shirt" && "neck" in anchor && anchor.neck
        ? "high"
        : profile.neck
          ? "low"
          : "none",
    height: "none"
  };

  const anchorChest = anchor.chest ?? ((profile.chest || 40) / 2 + ease.jacket / 2);
  const anchorWaist = anchor.waist ?? ((profile.waist || 34) / 2 + Math.max(ease.jacket - 1, 2) / 2);
  const anchorShoulders = anchor.shoulders ?? (profile.shoulder || 18);
  const anchorBodyLength =
    anchor.bodyLength ??
    (() => {
      const referenceHeight = profile.height || 71;
      switch (anchorCategory) {
        case "coat":
          return referenceHeight * multiplierByFit(fitPreference, { trim: 0.54, classic: 0.56, relaxed: 0.58 });
        case "sweater":
          return referenceHeight * multiplierByFit(fitPreference, { trim: 0.39, classic: 0.4, relaxed: 0.41 });
        case "waistcoat":
          return referenceHeight * 0.32;
        case "shirt":
          return referenceHeight * 0.42;
        default:
          return referenceHeight * multiplierByFit(fitPreference, { trim: 0.42, classic: 0.43, relaxed: 0.44 });
      }
    })();
  const anchorSleeveLength = getAnchorSleeveLength(anchorCategory, anchor, profile);

  const inferredChest =
    anchorCategory === "shirt"
      ? inferChestFromGarmentHalfWidth(anchorChest, ease.shirt)
      : anchorCategory === "coat"
        ? inferChestFromGarmentHalfWidth(anchorChest, ease.coat)
        : anchorCategory === "sweater"
          ? inferChestFromGarmentHalfWidth(anchorChest, ease.sweater)
          : anchorCategory === "waistcoat"
            ? inferChestFromGarmentHalfWidth(anchorChest, ease.waistcoat)
            : inferChestFromGarmentHalfWidth(anchorChest, ease.jacket);
  sourceQualities.chest = anchorCategory === "waistcoat" ? "medium" : "high";

  const inferredWaist =
    anchorCategory === "shirt"
      ? inferWaistFromGarmentHalfWidth(anchorWaist, Math.max(ease.shirt - 1, 2))
      : anchorCategory === "coat"
        ? inferWaistFromGarmentHalfWidth(anchorWaist, Math.max(ease.coat - 1, 2))
        : anchorCategory === "sweater"
          ? inferWaistFromGarmentHalfWidth(anchorWaist, Math.max(ease.sweater - 0.5, 2))
          : anchorCategory === "waistcoat"
            ? inferWaistFromGarmentHalfWidth(anchorWaist, Math.max(ease.waistcoat - 0.5, 2))
            : inferWaistFromGarmentHalfWidth(anchorWaist, Math.max(ease.jacket - 1, 2));
  sourceQualities.waist = anchorCategory === "waistcoat" ? "medium" : "high";

  const inferredShoulders =
    anchorCategory === "coat"
      ? anchorShoulders - 0.5
      : anchorCategory === "waistcoat"
        ? anchorShoulders / 0.72
        : anchorShoulders;
  sourceQualities.shoulders = anchorCategory === "waistcoat" ? "low" : "high";

  const inferredArmLength =
    anchorCategory === "shirt"
      ? anchorSleeveLength
      : anchorCategory === "coat"
        ? anchorSleeveLength === null ? null : anchorSleeveLength - 0.25
        : anchorCategory === "sweater"
          ? anchorSleeveLength
          : anchorCategory === "jacket"
            ? anchorSleeveLength === null ? null : anchorSleeveLength + 0.25
            : profile.sleeve || null;
  sourceQualities.sleeveLength =
    anchorCategory === "waistcoat"
      ? profile.sleeve
        ? "low"
        : "none"
      : "high";

  const inferredHeight = inferHeightFromBodyLength(anchorBodyLength, fitPreference, anchorCategory);
  sourceQualities.height = anchorCategory === "waistcoat" ? "medium" : "high";
  const anchorNeck =
    anchorCategory === "shirt" && "neck" in anchor && typeof anchor.neck === "number" ? anchor.neck : null;

  const inferredInputs: InferredReferenceInputs = {
    height: clampQuarter(inferredHeight),
    weight: profile.weight || null,
    chest: clampQuarter(inferredChest),
    waist: clampQuarter(inferredWaist),
    hips: profile.trouserMeasurements?.hips
      ? clampQuarter(profile.trouserMeasurements.hips * 2 - 2.25)
      : clampQuarter(inferredWaist + 6.5),
    shoulders: clampQuarter(inferredShoulders),
    sleeveLength: inferredArmLength === null ? null : clampQuarter(clampToRange(inferredArmLength, 20, 32)),
    neck:
      anchorNeck !== null ? clampQuarter(anchorNeck - 0.5) : profile.neck || null,
    fitPreference
  };
  const byField: Record<string, BuyerGeneratedFieldConfidence> = {
    "jacket.chest": buildAnchorFieldConfidence(anchorCategory, "Body chest reference", [sourceQualities.chest]),
    "jacket.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist]),
    "jacket.shoulders": buildAnchorFieldConfidence(anchorCategory, "Shoulder reference", [sourceQualities.shoulders]),
    "jacket.bodyLength": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Vertical dimensions remain heuristic even after back-solving from the anchor."
    ]),
    "jacket.sleeveLength": buildAnchorFieldConfidence(anchorCategory, "Sleeve-length reference", [sourceQualities.sleeveLength]),
    "shirt.neck": buildAnchorFieldConfidence(anchorCategory, "Neck reference", [sourceQualities.neck], [
      "Shirt neck cannot be inferred cleanly from non-shirt anchors."
    ]),
    "shirt.chest": buildAnchorFieldConfidence(anchorCategory, "Body chest reference", [sourceQualities.chest]),
    "shirt.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist]),
    "shirt.shoulders": buildAnchorFieldConfidence(anchorCategory, "Shoulder reference", [sourceQualities.shoulders]),
    "shirt.bodyLength": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Shirt body length stays somewhat heuristic even after back-solving."
    ]),
    "shirt.sleeveLength": buildAnchorFieldConfidence(anchorCategory, "Sleeve-length reference", [sourceQualities.sleeveLength]),
    "coat.chest": buildAnchorFieldConfidence(anchorCategory, "Body chest reference", [sourceQualities.chest], [
      "Coat chest adds outerwear ease on top of the inferred reference profile."
    ]),
    "coat.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist], [
      "Coat waist adds outerwear ease on top of the inferred reference profile."
    ]),
    "coat.shoulders": buildAnchorFieldConfidence(anchorCategory, "Shoulder reference", [sourceQualities.shoulders], [
      "Coat shoulders include a small outerwear allowance."
    ]),
    "coat.bodyLength": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Coat length remains a broad vertical heuristic."
    ]),
    "coat.sleeveLength": buildAnchorFieldConfidence(anchorCategory, "Sleeve-length reference", [sourceQualities.sleeveLength], [
      "Coat sleeve length includes a small outerwear allowance."
    ]),
    "sweater.chest": buildAnchorFieldConfidence(anchorCategory, "Body chest reference", [sourceQualities.chest], [
      "Sweater chest includes knitwear ease."
    ]),
    "sweater.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist], [
      "Sweater waist includes knitwear ease."
    ]),
    "sweater.shoulders": buildAnchorFieldConfidence(anchorCategory, "Shoulder reference", [sourceQualities.shoulders]),
    "sweater.bodyLength": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Sweater body length remains a vertical heuristic."
    ]),
    "sweater.sleeveLength": buildAnchorFieldConfidence(anchorCategory, "Sleeve-length reference", [sourceQualities.sleeveLength]),
    "waistcoat.chest": buildAnchorFieldConfidence(anchorCategory, "Body chest reference", [sourceQualities.chest], [
      "Waistcoat chest remains somewhat noisier than jacket or shirt chest."
    ]),
    "waistcoat.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist], [
      "Waistcoat waist remains somewhat noisier than jacket or shirt waist."
    ]),
    "waistcoat.shoulders": buildAnchorFieldConfidence(anchorCategory, "Waistcoat shoulder reference", [sourceQualities.shoulders], [
      "Waistcoat shoulders remain lower-confidence because they require a noisier proportional transformation."
    ]),
    "waistcoat.bodyLength": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Waistcoat body length remains a vertical heuristic."
    ]),
    "trousers.waist": buildAnchorFieldConfidence(anchorCategory, "Body waist reference", [sourceQualities.waist], [
      "Trouser waist from an upper-body anchor is only as strong as the inferred waist reference."
    ]),
    "trousers.hips": buildAnchorFieldConfidence(anchorCategory, "Hip reference", [sourceQualities.hips], [
      "Trouser hips from an upper-body anchor generally rely on a heuristic hip estimate."
    ]),
    "trousers.inseam": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Trouser inseam remains height-derived."
    ]),
    "trousers.outseam": buildAnchorFieldConfidence(anchorCategory, "Height proxy", [sourceQualities.height], [
      "Trouser outseam remains height-derived."
    ]),
    "trousers.opening": buildAnchorFieldConfidence(anchorCategory, "Fit preference", ["medium"], [
      "Trouser opening is style-led rather than strongly body-led."
    ])
  };

  const byCategory = {
    jacket: buildCategoryConfidenceFromFields([
      byField["jacket.chest"],
      byField["jacket.waist"],
      byField["jacket.shoulders"],
      byField["jacket.bodyLength"],
      byField["jacket.sleeveLength"]
    ]),
    shirt: buildCategoryConfidenceFromFields([
      byField["shirt.neck"],
      byField["shirt.chest"],
      byField["shirt.waist"],
      byField["shirt.shoulders"],
      byField["shirt.bodyLength"],
      byField["shirt.sleeveLength"]
    ]),
    coat: buildCategoryConfidenceFromFields([
      byField["coat.chest"],
      byField["coat.waist"],
      byField["coat.shoulders"],
      byField["coat.bodyLength"],
      byField["coat.sleeveLength"]
    ]),
    sweater: buildCategoryConfidenceFromFields([
      byField["sweater.chest"],
      byField["sweater.waist"],
      byField["sweater.shoulders"],
      byField["sweater.bodyLength"],
      byField["sweater.sleeveLength"]
    ]),
    waistcoat: buildCategoryConfidenceFromFields([
      byField["waistcoat.chest"],
      byField["waistcoat.waist"],
      byField["waistcoat.shoulders"],
      byField["waistcoat.bodyLength"]
    ]),
    trousers: buildCategoryConfidenceFromFields([
      byField["trousers.waist"],
      byField["trousers.hips"],
      byField["trousers.inseam"],
      byField["trousers.outseam"],
      byField["trousers.opening"]
    ])
  };

  const overallConfidenceScore = roundScore(
    average(Object.values(byField).map((field) => field.confidenceScore))
  );

  return {
    inferredInputs,
    outputConfidence: {
      overallConfidence: overallConfidenceScore >= 80 ? "high" : overallConfidenceScore >= 60 ? "medium" : "low",
      overallConfidenceScore,
      byCategory,
      byField
    }
  };
}

export function generateBuyerMeasurementSuggestions(inputs: BodyInputs): {
  suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges;
  jacketMeasurements: JacketMeasurements | null;
  shirtMeasurements: JacketMeasurements | null;
  sweaterMeasurements: JacketMeasurements | null;
  coatMeasurements: JacketMeasurements | null;
  waistcoatMeasurements: WaistcoatMeasurements | null;
  trouserMeasurements: TrouserMeasurements | null;
  sanityCheck: BuyerBodyMeasurementSanityCheckResult;
  outputConfidence: BuyerGeneratedMeasurementConfidenceReport;
} {
  const confidence = resolveConfidence(inputs);
  const canonicalOutputs = generateCanonicalMeasurementOutputs(inputs, confidence);

  return {
    sanityCheck: runBuyerBodyMeasurementSanityCheck(inputs),
    outputConfidence: rateGeneratedBuyerMeasurementOutputs(inputs),
    ...canonicalOutputs
  };
}

function confidenceFromAnchor(anchorCategory: AnchorCategory, profile: BuyerProfile): Confidence {
  const completeTop = (measurements: Partial<JacketMeasurements> | null | undefined, includeNeck = false) =>
    Boolean(
      measurements &&
        measurements.chest &&
        measurements.waist &&
        measurements.shoulders &&
        measurements.bodyLength &&
        measurements.sleeveLength &&
        (!includeNeck || measurements.neck)
    );
  const completeWaistcoat = Boolean(
    profile.waistcoatMeasurements?.chest &&
      profile.waistcoatMeasurements?.waist &&
      profile.waistcoatMeasurements?.shoulders &&
      profile.waistcoatMeasurements?.bodyLength
  );
  const completeTrouser = Boolean(
    profile.trouserMeasurements?.waist &&
      profile.trouserMeasurements?.hips &&
      profile.trouserMeasurements?.inseam &&
      profile.trouserMeasurements?.outseam &&
      profile.trouserMeasurements?.opening
  );

  if (
    (anchorCategory === "jacket" && completeTop(profile.jacketMeasurements)) ||
    (anchorCategory === "shirt" && completeTop(profile.shirtMeasurements, true)) ||
    (anchorCategory === "coat" && completeTop(profile.coatMeasurements)) ||
    (anchorCategory === "sweater" && completeTop(profile.sweaterMeasurements)) ||
    (anchorCategory === "waistcoat" && completeWaistcoat) ||
    (anchorCategory === "trousers" && completeTrouser)
  ) {
    return "high";
  }

  return "medium";
}

export function generateBuyerMeasurementSuggestionsFromAnchor(
  profile: BuyerProfile,
  anchorCategory: AnchorCategory
): {
  suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges;
  jacketMeasurements: JacketMeasurements | null;
  shirtMeasurements: JacketMeasurements | null;
  sweaterMeasurements: JacketMeasurements | null;
  coatMeasurements: JacketMeasurements | null;
  waistcoatMeasurements: WaistcoatMeasurements | null;
  trouserMeasurements: TrouserMeasurements | null;
  outputConfidence: BuyerGeneratedMeasurementConfidenceReport;
} {
  const confidence = confidenceFromAnchor(anchorCategory, profile);
  if (anchorCategory === "trousers") {
    const canonicalOutputs = generateCanonicalMeasurementOutputs(bodyInputsFromProfile(profile), confidence);
    return {
      ...canonicalOutputs,
      outputConfidence: rateGeneratedBuyerMeasurementOutputs(bodyInputsFromProfile(profile))
    };
  }

  const { inferredInputs, outputConfidence } = inferUpperBodyReferenceInputsFromAnchor(
    profile,
    anchorCategory,
    confidence
  );
  const canonicalOutputs = generateCanonicalMeasurementOutputs(inferredInputs, confidence);

  return {
    ...canonicalOutputs,
    outputConfidence
  };
}
