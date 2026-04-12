import type {
  BuyerJacketMeasurements,
  BuyerSuggestedMeasurementRanges,
  BuyerTrouserMeasurements,
  BuyerWaistcoatMeasurements
} from "@/lib/types";

export type BuyerBodyMeasurementInputs = {
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  shoulders: number | null;
  sleeveLength: number | null;
  neck: number | null;
};

export type BodyMeasurementSanityStatus = "ok" | "review" | "unlikely";
export type MeasurementWarningSeverity = "low" | "medium" | "high";
export type MeasurementGuideConfidenceLevel = "high" | "medium" | "low";

export type BuyerMeasurementSanityWarning = {
  code: string;
  severity: MeasurementWarningSeverity;
  message: string;
  suggestion?: string;
};

export type BuyerBodyMeasurementSanityCheckResult = {
  status: BodyMeasurementSanityStatus;
  confidenceScore: number;
  warnings: BuyerMeasurementSanityWarning[];
  recheckSuggestions: string[];
};

export type BuyerGeneratedFieldConfidence = {
  confidenceLevel: MeasurementGuideConfidenceLevel;
  confidenceScore: number;
  reasons: string[];
};

export type BuyerGeneratedCategoryConfidence = {
  confidenceLevel: MeasurementGuideConfidenceLevel;
  confidenceScore: number;
  reasons: string[];
};

export type BuyerGeneratedMeasurementConfidenceReport = {
  overallConfidence: MeasurementGuideConfidenceLevel;
  overallConfidenceScore: number;
  byCategory: Record<string, BuyerGeneratedCategoryConfidence>;
  byField: Record<string, BuyerGeneratedFieldConfidence>;
};

export type BuyerGarmentMeasurementInputs = {
  jacketMeasurements: BuyerJacketMeasurements | null;
  shirtMeasurements: BuyerJacketMeasurements | null;
  coatMeasurements: BuyerJacketMeasurements | null;
  sweaterMeasurements: BuyerJacketMeasurements | null;
  waistcoatMeasurements: BuyerWaistcoatMeasurements | null;
  trouserMeasurements: BuyerTrouserMeasurements | null;
};

type SanityContext = {
  inputs: BuyerBodyMeasurementInputs;
  deductions: number;
  warnings: BuyerMeasurementSanityWarning[];
  recheckSuggestions: Set<string>;
  warnedRelativeFields: Set<keyof BuyerBodyMeasurementInputs>;
};

type FieldSignal = {
  score: number;
  reasons: string[];
};

type FieldDefinition = {
  key: string;
  category: keyof BuyerSuggestedMeasurementRanges;
  label: string;
  evaluate: (inputs: BuyerBodyMeasurementInputs) => FieldSignal;
};

type RelativeCheckBands = {
  green: {
    min: number;
    max: number;
  };
  review: {
    min: number;
    max: number;
  };
};

// Broad menswear-only sanity thresholds. These intentionally aim wide so that
// unusual vintage proportions do not get marked wrong too aggressively.
export const BODY_MEASUREMENT_SANITY_THRESHOLDS = {
  okMinimumScore: 80,
  reviewMinimumScore: 55,
  absolute: {
    height: { min: 54, max: 84 },
    weight: { min: 90, max: 400 },
    chest: { min: 28, max: 70 },
    waist: { min: 24, max: 70 },
    hips: { min: 28, max: 75 },
    shoulders: { min: 14, max: 24 },
    sleeveLength: { min: 20, max: 32 },
    neck: { min: 12, max: 24 }
  },
  ratios: {
    chestToShoulder: {
      green: { min: 2.1, max: 2.9 },
      review: { min: 1.95, max: 3.1 }
    },
    waistToChest: {
      green: { min: 0.72, max: 1.03 },
      review: { min: 0.65, max: 1.1 }
    },
    chestMinusWaist: {
      green: { min: -1, max: 12 },
      review: { min: -4, max: 16 }
    },
    hipsMinusWaist: {
      green: { min: -2, max: 10 },
      review: { min: -4, max: 14 }
    },
    hipsToWaist: {
      green: { min: 0.93, max: 1.3 },
      review: { min: 0.88, max: 1.36 }
    },
    armToHeight: {
      green: { min: 0.35, max: 0.4 },
      review: { min: 0.34, max: 0.42 }
    },
    shoulderToHeight: {
      green: { min: 0.22, max: 0.29 },
      review: { min: 0.2, max: 0.31 }
    },
    chestToHeight: {
      green: { min: 0.48, max: 0.72 },
      review: { min: 0.44, max: 0.78 }
    }
  },
  weightSoftSignal: {
    green: { min: 18, max: 34 },
    review: { min: 16, max: 40 }
  }
} as const;

export const BODY_MEASUREMENT_SANITY_WEIGHTS = {
  low: 6,
  medium: 14,
  high: 24
} as const;

export const GENERATED_CONFIDENCE_THRESHOLDS = {
  highMinimumScore: 80,
  mediumMinimumScore: 60
} as const;

export const GARMENT_MEASUREMENT_SANITY_THRESHOLDS = {
  okMinimumScore: 82,
  reviewMinimumScore: 58,
  top: {
    chest: { min: 15, max: 30 },
    waist: { min: 13, max: 28 },
    shoulders: { min: 14, max: 24 },
    bodyLength: { min: 20, max: 46 },
    sleeveLength: { min: 20, max: 30 },
    neck: { min: 12, max: 24 }
  },
  waistcoat: {
    chest: { min: 15, max: 28 },
    waist: { min: 13, max: 27 },
    shoulders: { min: 10, max: 22 },
    bodyLength: { min: 18, max: 30 }
  },
  trousers: {
    waist: { min: 12, max: 28 },
    hips: { min: 14, max: 32 },
    inseam: { min: 24, max: 40 },
    outseam: { min: 32, max: 50 },
    opening: { min: 5, max: 12 }
  },
  ratios: {
    upperChestToShoulder: {
      green: { min: 1.02, max: 1.5 },
      review: { min: 0.92, max: 1.65 }
    },
    upperWaistToChest: {
      green: { min: 0.72, max: 1.02 },
      review: { min: 0.64, max: 1.12 }
    },
    sleeveToBody: {
      green: { min: 0.68, max: 1.02 },
      review: { min: 0.62, max: 1.1 }
    },
    trouserHipsToWaist: {
      green: { min: 1.02, max: 1.2 },
      review: { min: 0.96, max: 1.28 }
    },
    outseamMinusInseam: {
      green: { min: 8, max: 13 },
      review: { min: 6, max: 15.5 }
    },
    openingToWaist: {
      green: { min: 0.2, max: 0.38 },
      review: { min: 0.16, max: 0.44 }
    }
  }
} as const;

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recheckSuggestion(label: string, plural = false, guidance?: string) {
  const base = `Please recheck your ${label} and confirm ${plural ? "they were" : "it was"} entered correctly.`;
  return guidance ? `${base} ${guidance}` : base;
}

function confidenceLevelFromScore(score: number): MeasurementGuideConfidenceLevel {
  if (score >= GENERATED_CONFIDENCE_THRESHOLDS.highMinimumScore) {
    return "high";
  }

  if (score >= GENERATED_CONFIDENCE_THRESHOLDS.mediumMinimumScore) {
    return "medium";
  }

  return "low";
}

function pushWarning(
  context: SanityContext,
  code: string,
  severity: MeasurementWarningSeverity,
  message: string,
  recheckSuggestion?: string
) {
  context.deductions += BODY_MEASUREMENT_SANITY_WEIGHTS[severity];
  context.warnings.push({ code, severity, message, suggestion: recheckSuggestion });

  if (recheckSuggestion) {
    context.recheckSuggestions.add(recheckSuggestion);
  }
}

function runRangeRatioCheck(
  context: SanityContext,
  code: string,
  ratio: number,
  bands: RelativeCheckBands,
  messages: { review: string; unlikely: string },
  suggestion: string,
  relatedFields: Array<keyof BuyerBodyMeasurementInputs>
) {
  const hasFieldOverlap = relatedFields.some((field) => context.warnedRelativeFields.has(field));

  if (ratio < bands.review.min || ratio > bands.review.max) {
    if (hasFieldOverlap) {
      return;
    }
    pushWarning(context, code, "high", messages.unlikely, suggestion);
    relatedFields.forEach((field) => context.warnedRelativeFields.add(field));
    return;
  }

  if (ratio < bands.green.min || ratio > bands.green.max) {
    if (hasFieldOverlap) {
      return;
    }
    pushWarning(context, code, "medium", messages.review, suggestion);
    relatedFields.forEach((field) => context.warnedRelativeFields.add(field));
  }
}

function runAbsoluteCheck(
  context: SanityContext,
  field: keyof BuyerBodyMeasurementInputs,
  label: string,
  value: number | null,
  min: number,
  max: number
) {
  if (value === null) {
    return;
  }

  if (value < min || value > max) {
    pushWarning(
      context,
      `${field}_absolute_unlikely`,
      "high",
      `${label} sits outside the system's input guardrails and may be a typo, the wrong unit, or the wrong measuring method.`,
      recheckSuggestion(label.toLowerCase())
    );
  }
}

function checkChestVsShoulders(context: SanityContext) {
  const { chest, shoulders } = context.inputs;
  if (chest === null || shoulders === null) {
    return;
  }

  const ratio = chest / shoulders;
  runRangeRatioCheck(
    context,
    "chest_vs_shoulders",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.chestToShoulder,
    {
      review: "Chest circumference and shoulder width appear somewhat out of proportion for a typical menswear body measurement profile.",
      unlikely:
        "Chest circumference and shoulder width appear significantly inconsistent. This can happen when a flat garment width is entered instead of a body circumference."
    },
    recheckSuggestion(
      "chest circumference and shoulder width",
      true,
      "Chest should be a full circumference; shoulders should be a straight-across width."
    ),
    ["chest", "shoulders"]
  );
}

function checkChestVsWaist(context: SanityContext) {
  const { chest, waist } = context.inputs;
  if (chest === null || waist === null) {
    return;
  }

  const ratio = waist / chest;
  runRangeRatioCheck(
    context,
    "waist_to_chest",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.waistToChest,
    {
      review: "Waist circumference appears somewhat unusual relative to chest circumference, so one of those measurements may be worth rechecking.",
      unlikely:
        "Waist circumference and chest circumference appear inconsistent enough that there may be a typo, a flat-vs-circumference mix-up, or the wrong measuring method."
    },
    recheckSuggestion(
      "chest circumference and waist circumference",
      true,
      "Both should be full body circumferences."
    ),
    ["chest", "waist"]
  );

  const delta = chest - waist;
  runRangeRatioCheck(
    context,
    "chest_vs_waist",
    delta,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.chestMinusWaist,
    {
      review: "Chest and waist appear either farther apart than expected or unusually close together, so one of those measurements may be worth rechecking.",
      unlikely:
        "Chest and waist appear contradictory enough that there may be a typo, a flat-vs-circumference mix-up, or the wrong measuring method."
    },
    recheckSuggestion(
      "chest circumference and waist circumference",
      true,
      "Both should be full body circumferences."
    ),
    ["chest", "waist"]
  );
}

function checkWaistVsHips(context: SanityContext) {
  const { waist, hips } = context.inputs;
  if (waist === null || hips === null) {
    return;
  }

  const delta = hips - waist;
  runRangeRatioCheck(
    context,
    "hips_minus_waist",
    delta,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.hipsMinusWaist,
    {
      review: "Waist and hip circumference appear somewhat unusual together for menswear sizing, so the tape placement may be worth checking.",
      unlikely:
        "Waist and hip circumference appear inconsistent enough that one measurement may have been taken at the wrong point or entered in the wrong form."
    },
    recheckSuggestion(
      "waist circumference and hips circumference",
      true,
      "Both should be full body circumferences measured around the body."
    ),
    ["waist", "hips"]
  );

  const ratio = hips / waist;
  runRangeRatioCheck(
    context,
    "hips_to_waist",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.hipsToWaist,
    {
      review: "Hip circumference appears somewhat unusual relative to waist circumference, so tape placement may be worth reviewing.",
      unlikely:
        "Hip circumference and waist circumference appear inconsistent enough that one of those measurements may have been taken in the wrong place."
    },
    recheckSuggestion(
      "waist circumference and hips circumference",
      true,
      "Both should be full body circumferences measured around the body."
    ),
    ["waist", "hips"]
  );
}

function checkHeightVsArmLength(context: SanityContext) {
  const { height, sleeveLength } = context.inputs;
  if (height === null || sleeveLength === null) {
    return;
  }

  const ratio = sleeveLength / height;
  runRangeRatioCheck(
    context,
    "height_vs_arm_length",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.armToHeight,
    {
      review: "Arm length appears somewhat unusual for the recorded height.",
      unlikely:
        "Arm length appears significantly unusual for the recorded height and may have been measured from the wrong starting point."
    },
    recheckSuggestion("height and arm length", true, "Arm length should run from the shoulder bone to the wrist bone."),
    ["height", "sleeveLength"]
  );
}

function checkHeightVsShoulders(context: SanityContext) {
  const { height, shoulders } = context.inputs;
  if (height === null || shoulders === null) {
    return;
  }

  const ratio = shoulders / height;
  runRangeRatioCheck(
    context,
    "height_vs_shoulders",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.shoulderToHeight,
    {
      review: "Shoulder width appears somewhat unusual for the recorded height.",
      unlikely:
        "Shoulder width appears significantly unusual for the recorded height and may reflect a flat garment measure or a body/garment mix-up."
    },
    recheckSuggestion(
      "height and shoulder width",
      true,
      "Shoulder width should be measured straight across from shoulder point to shoulder point."
    ),
    ["height", "shoulders"]
  );
}

function checkHeightVsChest(context: SanityContext) {
  const { height, chest } = context.inputs;
  if (height === null || chest === null) {
    return;
  }

  const ratio = chest / height;
  runRangeRatioCheck(
    context,
    "height_vs_chest",
    ratio,
    BODY_MEASUREMENT_SANITY_THRESHOLDS.ratios.chestToHeight,
    {
      review: "Chest circumference appears somewhat unusual for the recorded height.",
      unlikely:
        "Chest circumference appears significantly unusual for the recorded height and may reflect a typo or a flat-width entry instead of a full circumference."
    },
    recheckSuggestion("height and chest circumference", true, "Chest should be measured as a full circumference."),
    ["height", "chest"]
  );
}

function checkWeightSoftSignal(context: SanityContext) {
  const { height, weight } = context.inputs;
  if (height === null || weight === null || height <= 0) {
    return;
  }

  const bmi = (weight / (height * height)) * 703;
  const { green, review } = BODY_MEASUREMENT_SANITY_THRESHOLDS.weightSoftSignal;

  if (bmi < review.min || bmi > review.max) {
    pushWarning(
      context,
      "weight_soft_signal_unlikely",
      "low",
      "Height and weight together appear unusual enough that one of those measurements may be worth a quick recheck.",
      recheckSuggestion("height and weight", true)
    );
    return;
  }

  if (bmi < green.min || bmi > green.max) {
    pushWarning(
      context,
      "weight_soft_signal_review",
      "low",
      "Height and weight together appear somewhat unusual, so one of those measurements may be worth a quick recheck.",
      recheckSuggestion("height and weight", true)
    );
  }
}

export function runBuyerBodyMeasurementSanityCheck(
  inputs: BuyerBodyMeasurementInputs
): BuyerBodyMeasurementSanityCheckResult {
  const context: SanityContext = {
    inputs,
    deductions: 0,
    warnings: [],
    recheckSuggestions: new Set<string>(),
    warnedRelativeFields: new Set<keyof BuyerBodyMeasurementInputs>()
  };

  const { absolute } = BODY_MEASUREMENT_SANITY_THRESHOLDS;

  runAbsoluteCheck(context, "height", "Height", inputs.height, absolute.height.min, absolute.height.max);
  runAbsoluteCheck(context, "weight", "Weight", inputs.weight, absolute.weight.min, absolute.weight.max);
  runAbsoluteCheck(context, "chest", "Chest circumference", inputs.chest, absolute.chest.min, absolute.chest.max);
  runAbsoluteCheck(context, "waist", "Waist circumference", inputs.waist, absolute.waist.min, absolute.waist.max);
  runAbsoluteCheck(context, "hips", "Hips circumference", inputs.hips, absolute.hips.min, absolute.hips.max);
  runAbsoluteCheck(context, "shoulders", "Shoulder width", inputs.shoulders, absolute.shoulders.min, absolute.shoulders.max);
  runAbsoluteCheck(
    context,
    "sleeveLength",
    "Arm length",
    inputs.sleeveLength,
    absolute.sleeveLength.min,
    absolute.sleeveLength.max
  );
  runAbsoluteCheck(context, "neck", "Neck circumference", inputs.neck, absolute.neck.min, absolute.neck.max);

  checkChestVsShoulders(context);
  checkChestVsWaist(context);
  checkWaistVsHips(context);
  checkHeightVsArmLength(context);
  checkHeightVsShoulders(context);
  checkHeightVsChest(context);
  checkWeightSoftSignal(context);

  const confidenceScore = roundScore(100 - context.deductions);
  const hasHighSeverity = context.warnings.some((warning) => warning.severity === "high");
  const hasMediumSeverity = context.warnings.some((warning) => warning.severity === "medium");

  const status: BodyMeasurementSanityStatus = hasHighSeverity || confidenceScore < BODY_MEASUREMENT_SANITY_THRESHOLDS.reviewMinimumScore
    ? "unlikely"
    : hasMediumSeverity || confidenceScore < BODY_MEASUREMENT_SANITY_THRESHOLDS.okMinimumScore
      ? "review"
      : "ok";

  return {
    status,
    confidenceScore,
    warnings: context.warnings,
    recheckSuggestions: Array.from(context.recheckSuggestions)
  };
}

type GarmentSanityContext = {
  deductions: number;
  warnings: BuyerMeasurementSanityWarning[];
  recheckSuggestions: Set<string>;
  warnedCodes: Set<string>;
};

function pushGarmentWarning(
  context: GarmentSanityContext,
  code: string,
  severity: MeasurementWarningSeverity,
  message: string,
  suggestion?: string
) {
  if (context.warnedCodes.has(code)) {
    return;
  }

  context.warnedCodes.add(code);
  context.deductions += BODY_MEASUREMENT_SANITY_WEIGHTS[severity];
  context.warnings.push({ code, severity, message, suggestion });

  if (suggestion) {
    context.recheckSuggestions.add(suggestion);
  }
}

function runGarmentAbsoluteCheck(
  context: GarmentSanityContext,
  code: string,
  label: string,
  value: number | undefined,
  min: number,
  max: number,
  suggestion: string
) {
  if (value === undefined) {
    return;
  }

  if (value < min || value > max) {
    pushGarmentWarning(
      context,
      code,
      "high",
      `${label} sits outside the system's input guardrails and may be a typo, the wrong unit, or the wrong measuring method.`,
      suggestion
    );
  }
}

function runGarmentRatioCheck(
  context: GarmentSanityContext,
  code: string,
  ratio: number,
  bands: RelativeCheckBands,
  reviewMessage: string,
  unlikelyMessage: string,
  suggestion: string
) {
  if (ratio < bands.review.min || ratio > bands.review.max) {
    pushGarmentWarning(context, code, "high", unlikelyMessage, suggestion);
    return;
  }

  if (ratio < bands.green.min || ratio > bands.green.max) {
    pushGarmentWarning(context, code, "medium", reviewMessage, suggestion);
  }
}

function checkUpperBodyGarmentCategory(
  context: GarmentSanityContext,
  categoryLabel: string,
  measurements: BuyerJacketMeasurements | null,
  includeNeck = false
) {
  if (!measurements) {
    return;
  }

  const thresholds = GARMENT_MEASUREMENT_SANITY_THRESHOLDS.top;
  const prefix = categoryLabel.toLowerCase();

  runGarmentAbsoluteCheck(
    context,
    `${prefix}_chest_absolute`,
    `${categoryLabel} chest width`,
    measurements.chest,
    thresholds.chest.min,
    thresholds.chest.max,
    recheckSuggestion(`${prefix} chest width`, false, "This should be a flat garment width in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    `${prefix}_waist_absolute`,
    `${categoryLabel} waist width`,
    measurements.waist,
    thresholds.waist.min,
    thresholds.waist.max,
    recheckSuggestion(`${prefix} waist width`, false, "This should be a flat garment width in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    `${prefix}_shoulders_absolute`,
    `${categoryLabel} shoulders width`,
    measurements.shoulders,
    thresholds.shoulders.min,
    thresholds.shoulders.max,
    recheckSuggestion(`${prefix} shoulders width`, false, "This should be measured straight across the garment.")
  );
  runGarmentAbsoluteCheck(
    context,
    `${prefix}_body_length_absolute`,
    `${categoryLabel} body length`,
    measurements.bodyLength,
    thresholds.bodyLength.min,
    thresholds.bodyLength.max,
    recheckSuggestion(`${prefix} body length`, false, "This should be the garment length in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    `${prefix}_sleeve_length_absolute`,
    `${categoryLabel} sleeve length`,
    measurements.sleeveLength,
    thresholds.sleeveLength.min,
    thresholds.sleeveLength.max,
    recheckSuggestion(`${prefix} sleeve length`, false, "This should be the garment sleeve length in inches.")
  );

  if (includeNeck) {
    runGarmentAbsoluteCheck(
      context,
      `${prefix}_neck_absolute`,
      `${categoryLabel} neck circumference`,
      measurements.neck,
      thresholds.neck.min,
      thresholds.neck.max,
      recheckSuggestion(`${prefix} neck circumference`, false, "This should be the garment neck measurement in inches.")
    );
  }

  if (measurements.chest !== undefined && measurements.shoulders !== undefined && measurements.shoulders > 0) {
    runGarmentRatioCheck(
      context,
      `${prefix}_chest_shoulders`,
      measurements.chest / measurements.shoulders,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.upperChestToShoulder,
      `${categoryLabel} chest width and shoulders width appear somewhat inconsistent for a tailored upper-body garment.`,
      `${categoryLabel} chest width and shoulders width appear significantly inconsistent for a tailored upper-body garment.`,
      recheckSuggestion(
        `${prefix} chest width and ${prefix} shoulders width`,
        true,
        "Both should be taken from the same garment and recorded in inches."
      )
    );
  }

  if (measurements.chest !== undefined && measurements.waist !== undefined && measurements.chest > 0) {
    runGarmentRatioCheck(
      context,
      `${prefix}_waist_chest`,
      measurements.waist / measurements.chest,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.upperWaistToChest,
      `${categoryLabel} chest width and waist width appear somewhat inconsistent for a tailored upper-body garment.`,
      `${categoryLabel} chest width and waist width appear significantly inconsistent for a tailored upper-body garment.`,
      recheckSuggestion(
        `${prefix} chest width and ${prefix} waist width`,
        true,
        "Both should be flat garment widths taken in inches."
      )
    );
  }

  if (
    measurements.sleeveLength !== undefined &&
    measurements.bodyLength !== undefined &&
    measurements.bodyLength > 0
  ) {
    runGarmentRatioCheck(
      context,
      `${prefix}_sleeve_body`,
      measurements.sleeveLength / measurements.bodyLength,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.sleeveToBody,
      `${categoryLabel} sleeve length and body length appear somewhat inconsistent for the same garment.`,
      `${categoryLabel} sleeve length and body length appear significantly inconsistent for the same garment.`,
      recheckSuggestion(
        `${prefix} sleeve length and ${prefix} body length`,
        true,
        "Sleeve length should run from the shoulder seam point to the cuff, not from center back, and both should come from the same garment in inches."
      )
    );
  }
}

function checkWaistcoatCategory(context: GarmentSanityContext, measurements: BuyerWaistcoatMeasurements | null) {
  if (!measurements) {
    return;
  }

  const thresholds = GARMENT_MEASUREMENT_SANITY_THRESHOLDS.waistcoat;
  runGarmentAbsoluteCheck(
    context,
    "waistcoat_chest_absolute",
    "Waistcoat chest width",
    measurements.chest,
    thresholds.chest.min,
    thresholds.chest.max,
    recheckSuggestion("waistcoat chest width", false, "This should be a flat garment width in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "waistcoat_waist_absolute",
    "Waistcoat waist width",
    measurements.waist,
    thresholds.waist.min,
    thresholds.waist.max,
    recheckSuggestion("waistcoat waist width", false, "This should be a flat garment width in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "waistcoat_shoulders_absolute",
    "Waistcoat shoulders width",
    measurements.shoulders,
    thresholds.shoulders.min,
    thresholds.shoulders.max,
    recheckSuggestion("waistcoat shoulders width", false, "This should be measured straight across the garment.")
  );
  runGarmentAbsoluteCheck(
    context,
    "waistcoat_body_length_absolute",
    "Waistcoat body length",
    measurements.bodyLength,
    thresholds.bodyLength.min,
    thresholds.bodyLength.max,
    recheckSuggestion("waistcoat body length", false, "This should be the garment length in inches.")
  );

  if (measurements.chest !== undefined && measurements.waist !== undefined && measurements.chest > 0) {
    runGarmentRatioCheck(
      context,
      "waistcoat_waist_chest",
      measurements.waist / measurements.chest,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.upperWaistToChest,
      "Waistcoat chest width and waist width appear somewhat inconsistent for the same garment.",
      "Waistcoat chest width and waist width appear significantly inconsistent for the same garment.",
      recheckSuggestion(
        "waistcoat chest width and waistcoat waist width",
        true,
        "Both should be flat garment widths taken in inches."
      )
    );
  }
}

function checkTrouserCategory(context: GarmentSanityContext, measurements: BuyerTrouserMeasurements | null) {
  if (!measurements) {
    return;
  }

  const thresholds = GARMENT_MEASUREMENT_SANITY_THRESHOLDS.trousers;
  runGarmentAbsoluteCheck(
    context,
    "trousers_waist_absolute",
    "Trousers waist width",
    measurements.waist,
    thresholds.waist.min,
    thresholds.waist.max,
    recheckSuggestion("trousers waist width", false, "This should be a flat garment width in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "trousers_hips_absolute",
    "Trousers hips",
    measurements.hips,
    thresholds.hips.min,
    thresholds.hips.max,
    recheckSuggestion("trousers hips", false, "This should be the garment hip measurement in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "trousers_inseam_absolute",
    "Trousers inseam length",
    measurements.inseam,
    thresholds.inseam.min,
    thresholds.inseam.max,
    recheckSuggestion("trousers inseam length", false, "This should be the garment inseam in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "trousers_outseam_absolute",
    "Trousers outseam length",
    measurements.outseam,
    thresholds.outseam.min,
    thresholds.outseam.max,
    recheckSuggestion("trousers outseam length", false, "This should be the garment outseam in inches.")
  );
  runGarmentAbsoluteCheck(
    context,
    "trousers_opening_absolute",
    "Trousers opening width",
    measurements.opening,
    thresholds.opening.min,
    thresholds.opening.max,
    recheckSuggestion("trousers opening width", false, "This should be the trouser opening width in inches.")
  );

  if (measurements.waist !== undefined && measurements.hips !== undefined && measurements.waist > 0) {
    runGarmentRatioCheck(
      context,
      "trousers_hips_waist",
      measurements.hips / measurements.waist,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.trouserHipsToWaist,
      "Trousers hips and waist width appear somewhat inconsistent for the same garment.",
      "Trousers hips and waist width appear significantly inconsistent for the same garment.",
      recheckSuggestion(
        "trousers waist width and trousers hips",
        true,
        "Both should come from the same garment and be recorded in inches."
      )
    );
  }

  if (
    measurements.inseam !== undefined &&
    measurements.outseam !== undefined
  ) {
    runGarmentRatioCheck(
      context,
      "trousers_inseam_outseam",
      measurements.outseam - measurements.inseam,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.outseamMinusInseam,
      "Trousers inseam length and outseam length appear somewhat inconsistent for the same garment.",
      "Trousers inseam length and outseam length appear significantly inconsistent for the same garment.",
      recheckSuggestion(
        "trousers inseam length and trousers outseam length",
        true,
        "Both should come from the same garment and be recorded in inches."
      )
    );
  }

  if (measurements.waist !== undefined && measurements.opening !== undefined && measurements.waist > 0) {
    runGarmentRatioCheck(
      context,
      "trousers_opening_waist",
      measurements.opening / measurements.waist,
      GARMENT_MEASUREMENT_SANITY_THRESHOLDS.ratios.openingToWaist,
      "Trousers opening width appears somewhat unusual relative to waist width.",
      "Trousers opening width appears significantly unusual relative to waist width.",
      recheckSuggestion(
        "trousers waist width and trousers opening width",
        true,
        "Both should be measured from the same garment and recorded in inches."
      )
    );
  }
}

export function runBuyerGarmentMeasurementSanityCheck(
  inputs: BuyerGarmentMeasurementInputs
): BuyerBodyMeasurementSanityCheckResult {
  const context: GarmentSanityContext = {
    deductions: 0,
    warnings: [],
    recheckSuggestions: new Set<string>(),
    warnedCodes: new Set<string>()
  };

  checkUpperBodyGarmentCategory(context, "Jacket", inputs.jacketMeasurements);
  checkUpperBodyGarmentCategory(context, "Shirt", inputs.shirtMeasurements, true);
  checkUpperBodyGarmentCategory(context, "Coat", inputs.coatMeasurements);
  checkUpperBodyGarmentCategory(context, "Sweater", inputs.sweaterMeasurements);
  checkWaistcoatCategory(context, inputs.waistcoatMeasurements);
  checkTrouserCategory(context, inputs.trouserMeasurements);

  const confidenceScore = roundScore(100 - context.deductions);
  const hasHighSeverity = context.warnings.some((warning) => warning.severity === "high");
  const hasMediumSeverity = context.warnings.some((warning) => warning.severity === "medium");

  const status: BodyMeasurementSanityStatus =
    hasHighSeverity || confidenceScore < GARMENT_MEASUREMENT_SANITY_THRESHOLDS.reviewMinimumScore
      ? "unlikely"
      : hasMediumSeverity || confidenceScore < GARMENT_MEASUREMENT_SANITY_THRESHOLDS.okMinimumScore
        ? "review"
        : "ok";

  return {
    status,
    confidenceScore,
    warnings: context.warnings,
    recheckSuggestions: Array.from(context.recheckSuggestions)
  };
}

function scoreField(base: number, adjustments: Array<{ amount: number; reason: string }>): BuyerGeneratedFieldConfidence {
  const reasons: string[] = [];
  let score = base;

  for (const adjustment of adjustments) {
    score += adjustment.amount;
    reasons.push(adjustment.reason);
  }

  const confidenceScore = roundScore(score);

  return {
    confidenceLevel: confidenceLevelFromScore(confidenceScore),
    confidenceScore,
    reasons
  };
}

function present(value: number | null | undefined) {
  return value !== null && value !== undefined;
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: "jacket.chest",
    category: "jacket",
    label: "Jacket chest",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.chest)
          ? { amount: 40, reason: "Chest circumference was provided directly." }
          : { amount: -10, reason: "Chest circumference was missing, so the system fell back to a default chest." }
      ])
  },
  {
    key: "jacket.waist",
    category: "jacket",
    label: "Jacket waist",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.waist)
          ? { amount: 40, reason: "Waist circumference was provided directly." }
          : { amount: -10, reason: "Waist circumference was missing, so the system fell back to a default waist." }
      ])
  },
  {
    key: "jacket.shoulders",
    category: "jacket",
    label: "Jacket shoulders",
    evaluate: (inputs) =>
      scoreField(50, [
        present(inputs.shoulders)
          ? { amount: 38, reason: "Shoulder width was provided directly and maps cleanly to jacket shoulders." }
          : { amount: -12, reason: "Shoulder width was missing, so jacket shoulders rely on a default value." }
      ])
  },
  {
    key: "jacket.bodyLength",
    category: "jacket",
    label: "Jacket body length",
    evaluate: (inputs) =>
      scoreField(48, [
        present(inputs.height)
          ? { amount: 22, reason: "Height was provided directly, which supports jacket body length." }
          : { amount: -8, reason: "Height was missing, so jacket body length relies on a default height." },
        { amount: -2, reason: "Vertical garment length is still a category heuristic rather than a directly measured garment target." }
      ])
  },
  {
    key: "jacket.sleeveLength",
    category: "jacket",
    label: "Jacket sleeve length",
    evaluate: (inputs) =>
      scoreField(50, [
        present(inputs.sleeveLength)
          ? { amount: 35, reason: "Arm length was provided directly and jacket sleeve adjustment is modest." }
          : { amount: -14, reason: "Arm length was missing, so jacket sleeve length uses a fallback value." }
      ])
  },
  {
    key: "shirt.neck",
    category: "shirt",
    label: "Shirt neck",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.neck)
          ? { amount: 45, reason: "Neck circumference was provided directly, which strongly supports shirt neck sizing." }
          : { amount: -18, reason: "Neck circumference was missing, so shirt neck sizing uses a default neck." }
      ])
  },
  {
    key: "shirt.chest",
    category: "shirt",
    label: "Shirt chest",
    evaluate: (inputs) =>
      scoreField(46, [
        present(inputs.chest)
          ? { amount: 38, reason: "Chest circumference was provided directly." }
          : { amount: -10, reason: "Chest circumference was missing, so shirt chest uses a fallback chest." }
      ])
  },
  {
    key: "shirt.waist",
    category: "shirt",
    label: "Shirt waist",
    evaluate: (inputs) =>
      scoreField(46, [
        present(inputs.waist)
          ? { amount: 38, reason: "Waist circumference was provided directly." }
          : { amount: -10, reason: "Waist circumference was missing, so shirt waist uses a fallback waist." }
      ])
  },
  {
    key: "shirt.shoulders",
    category: "shirt",
    label: "Shirt shoulders",
    evaluate: (inputs) =>
      scoreField(50, [
        present(inputs.shoulders)
          ? { amount: 38, reason: "Shoulder width was provided directly and maps cleanly to shirt shoulders." }
          : { amount: -12, reason: "Shoulder width was missing, so shirt shoulders rely on a default value." }
      ])
  },
  {
    key: "shirt.bodyLength",
    category: "shirt",
    label: "Shirt body length",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.height)
          ? { amount: 18, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so shirt body length relies on a default height." },
        { amount: -6, reason: "Shirt body length uses a deliberately wider tolerance because height alone is a coarse signal." }
      ])
  },
  {
    key: "shirt.sleeveLength",
    category: "shirt",
    label: "Shirt sleeve length",
    evaluate: (inputs) =>
      scoreField(50, [
        present(inputs.sleeveLength)
          ? { amount: 38, reason: "Arm length was provided directly and maps closely to shirt sleeve length." }
          : { amount: -14, reason: "Arm length was missing, so shirt sleeve length uses a fallback value." }
      ])
  },
  {
    key: "coat.chest",
    category: "coat",
    label: "Coat chest",
    evaluate: (inputs) =>
      scoreField(42, [
        present(inputs.chest)
          ? { amount: 32, reason: "Chest circumference was provided directly." }
          : { amount: -10, reason: "Chest circumference was missing, so coat chest uses a fallback chest." },
        { amount: -8, reason: "Outerwear chest includes additional allowance and is therefore a noisier translation than jacket chest." }
      ])
  },
  {
    key: "coat.waist",
    category: "coat",
    label: "Coat waist",
    evaluate: (inputs) =>
      scoreField(42, [
        present(inputs.waist)
          ? { amount: 32, reason: "Waist circumference was provided directly." }
          : { amount: -10, reason: "Waist circumference was missing, so coat waist uses a fallback waist." },
        { amount: -8, reason: "Outerwear waist includes layering allowance and is therefore a noisier translation than jacket waist." }
      ])
  },
  {
    key: "coat.shoulders",
    category: "coat",
    label: "Coat shoulders",
    evaluate: (inputs) =>
      scoreField(48, [
        present(inputs.shoulders)
          ? { amount: 30, reason: "Shoulder width was provided directly." }
          : { amount: -12, reason: "Shoulder width was missing, so coat shoulders rely on a default value." },
        { amount: -6, reason: "Coat shoulders include a small outerwear allowance and are slightly noisier than jacket shoulders." }
      ])
  },
  {
    key: "coat.bodyLength",
    category: "coat",
    label: "Coat body length",
    evaluate: (inputs) =>
      scoreField(42, [
        present(inputs.height)
          ? { amount: 16, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so coat length relies on a default height." },
        { amount: -8, reason: "Coat length uses a broad height-based heuristic and intentionally wider tolerance." }
      ])
  },
  {
    key: "coat.sleeveLength",
    category: "coat",
    label: "Coat sleeve length",
    evaluate: (inputs) =>
      scoreField(48, [
        present(inputs.sleeveLength)
          ? { amount: 28, reason: "Arm length was provided directly." }
          : { amount: -14, reason: "Arm length was missing, so coat sleeve length uses a fallback value." },
        { amount: -6, reason: "Coat sleeve length includes an outerwear adjustment and is slightly noisier than shirt sleeve length." }
      ])
  },
  {
    key: "sweater.chest",
    category: "sweater",
    label: "Sweater chest",
    evaluate: (inputs) =>
      scoreField(44, [
        present(inputs.chest)
          ? { amount: 34, reason: "Chest circumference was provided directly." }
          : { amount: -10, reason: "Chest circumference was missing, so sweater chest uses a fallback chest." },
        { amount: -4, reason: "Sweater ease still uses a category heuristic rather than a fully direct garment measurement." }
      ])
  },
  {
    key: "sweater.waist",
    category: "sweater",
    label: "Sweater waist",
    evaluate: (inputs) =>
      scoreField(44, [
        present(inputs.waist)
          ? { amount: 34, reason: "Waist circumference was provided directly." }
          : { amount: -10, reason: "Waist circumference was missing, so sweater waist uses a fallback waist." },
        { amount: -4, reason: "Sweater ease still uses a category heuristic rather than a fully direct garment measurement." }
      ])
  },
  {
    key: "sweater.shoulders",
    category: "sweater",
    label: "Sweater shoulders",
    evaluate: (inputs) =>
      scoreField(50, [
        present(inputs.shoulders)
          ? { amount: 36, reason: "Shoulder width was provided directly and maps cleanly to sweater shoulders." }
          : { amount: -12, reason: "Shoulder width was missing, so sweater shoulders rely on a default value." }
      ])
  },
  {
    key: "sweater.bodyLength",
    category: "sweater",
    label: "Sweater body length",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.height)
          ? { amount: 18, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so sweater body length relies on a default height." },
        { amount: -4, reason: "Sweater body length is height-driven rather than directly measured from a known garment." }
      ])
  },
  {
    key: "sweater.sleeveLength",
    category: "sweater",
    label: "Sweater sleeve length",
    evaluate: (inputs) =>
      scoreField(48, [
        present(inputs.sleeveLength)
          ? { amount: 34, reason: "Arm length was provided directly." }
          : { amount: -14, reason: "Arm length was missing, so sweater sleeve length uses a fallback value." }
      ])
  },
  {
    key: "waistcoat.chest",
    category: "waistcoat",
    label: "Waistcoat chest",
    evaluate: (inputs) =>
      scoreField(44, [
        present(inputs.chest)
          ? { amount: 30, reason: "Chest circumference was provided directly." }
          : { amount: -10, reason: "Chest circumference was missing, so waistcoat chest uses a fallback chest." },
        { amount: -6, reason: "Waistcoat chest is inferred from upper-body tailoring proportions rather than a direct garment anchor." }
      ])
  },
  {
    key: "waistcoat.waist",
    category: "waistcoat",
    label: "Waistcoat waist",
    evaluate: (inputs) =>
      scoreField(44, [
        present(inputs.waist)
          ? { amount: 30, reason: "Waist circumference was provided directly." }
          : { amount: -10, reason: "Waist circumference was missing, so waistcoat waist uses a fallback waist." },
        { amount: -6, reason: "Waistcoat waist is inferred from upper-body tailoring proportions rather than a direct garment anchor." }
      ])
  },
  {
    key: "waistcoat.shoulders",
    category: "waistcoat",
    label: "Waistcoat shoulders",
    evaluate: (inputs) =>
      scoreField(42, [
        present(inputs.shoulders)
          ? { amount: 18, reason: "Shoulder width was provided directly." }
          : { amount: -14, reason: "Shoulder width was missing, so waistcoat shoulders rely on a fallback value." },
        { amount: -20, reason: "Waistcoat shoulder width is a noisier proportional heuristic even when shoulder width is known." }
      ])
  },
  {
    key: "waistcoat.bodyLength",
    category: "waistcoat",
    label: "Waistcoat body length",
    evaluate: (inputs) =>
      scoreField(45, [
        present(inputs.height)
          ? { amount: 20, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so waistcoat body length relies on a default height." },
        { amount: -4, reason: "Waistcoat body length is a height-based heuristic rather than a direct body measure." }
      ])
  },
  {
    key: "trousers.waist",
    category: "trousers",
    label: "Trouser waist",
    evaluate: (inputs) =>
      scoreField(48, [
        present(inputs.waist)
          ? { amount: 36, reason: "Waist circumference was provided directly." }
          : { amount: -12, reason: "Waist circumference was missing, so trouser waist uses a fallback waist." }
      ])
  },
  {
    key: "trousers.hips",
    category: "trousers",
    label: "Trouser hips",
    evaluate: (inputs) =>
      scoreField(46, [
        present(inputs.hips)
          ? { amount: 30, reason: "Hip circumference was provided directly." }
          : { amount: -10, reason: "Hip circumference was missing, so trouser hips were inferred from waist plus a heuristic allowance." },
        present(inputs.hips)
          ? { amount: 0, reason: "Trouser hip translation still uses some ease, but the direct hip input keeps confidence reasonably strong." }
          : { amount: -12, reason: "Trouser hip output is noisier because it had to infer hips from waist rather than using a direct hip circumference." }
      ])
  },
  {
    key: "trousers.inseam",
    category: "trousers",
    label: "Trouser inseam",
    evaluate: (inputs) =>
      scoreField(46, [
        present(inputs.height)
          ? { amount: 20, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so inseam uses a default height." },
        { amount: -4, reason: "Inseam is height-derived rather than measured directly from the body." }
      ])
  },
  {
    key: "trousers.outseam",
    category: "trousers",
    label: "Trouser outseam",
    evaluate: (inputs) =>
      scoreField(44, [
        present(inputs.height)
          ? { amount: 18, reason: "Height was provided directly." }
          : { amount: -8, reason: "Height was missing, so outseam uses a default height." },
        { amount: -6, reason: "Outseam is height-derived and generally noisier than waist-driven trouser fields." }
      ])
  },
  {
    key: "trousers.opening",
    category: "trousers",
    label: "Trouser opening",
    evaluate: () =>
      scoreField(42, [
        { amount: -6, reason: "Trouser opening is a style-oriented heuristic rather than something strongly supported by the buyer's body inputs." }
      ])
  }
];

export function rateGeneratedBuyerMeasurementOutputs(
  inputs: BuyerBodyMeasurementInputs
): BuyerGeneratedMeasurementConfidenceReport {
  const byField = Object.fromEntries(
    FIELD_DEFINITIONS.map((definition) => [definition.key, definition.evaluate(inputs)])
  );

  const categoryEntries = new Map<string, BuyerGeneratedFieldConfidence[]>();

  for (const definition of FIELD_DEFINITIONS) {
    const existing = categoryEntries.get(definition.category) ?? [];
    existing.push(byField[definition.key]);
    categoryEntries.set(definition.category, existing);
  }

  const byCategory = Object.fromEntries(
    Array.from(categoryEntries.entries()).map(([category, fields]) => {
      const confidenceScore = roundScore(
        fields.reduce((sum, field) => sum + field.confidenceScore, 0) / Math.max(fields.length, 1)
      );

      return [
        category,
        {
          confidenceLevel: confidenceLevelFromScore(confidenceScore),
          confidenceScore,
          reasons: fields
            .flatMap((field) => field.reasons)
            .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
            .slice(0, 3)
        }
      ] satisfies [string, BuyerGeneratedCategoryConfidence]
    })
  );

  const overallConfidenceScore = roundScore(
    Object.values(byField).reduce((sum, field) => sum + field.confidenceScore, 0) /
      Math.max(Object.values(byField).length, 1)
  );

  return {
    overallConfidence: confidenceLevelFromScore(overallConfidenceScore),
    overallConfidenceScore,
    byCategory,
    byField
  };
}
