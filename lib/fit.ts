import type {
  BuyerJacketMeasurements,
  BuyerProfile,
  BuyerTrouserMeasurements,
  BuyerWaistcoatMeasurements,
  Listing
} from "./types.ts";

export type FitRecommendationStatus =
  | "strong_match"
  | "workable_with_tailoring"
  | "risky_but_possible"
  | "not_recommended";

export type FitConfidence = "high" | "medium" | "low";
export type TargetSource = "category_direct" | "jacket_fallback_adjusted" | "unavailable";

export type MeasurementDirection = "too_small" | "too_large" | "close" | "unknown";
export type MeasurementSeverity = "good" | "minor_issue" | "moderate_issue" | "major_issue" | "unknown";
export type TailoringRisk = "easy" | "moderate" | "risky" | "not_realistic" | "unknown";
export type RangePosition = "ideal" | "acceptable" | "outside_acceptable" | "unknown";
export type TailoringFeasibility = "easy" | "possible" | "risky" | "not_realistic";

export type MeasurementRange = {
  idealMin: number;
  idealMax: number;
  acceptableMin: number;
  acceptableMax: number;
};

export type TailoringAction = {
  type:
    | "shorten_sleeves"
    | "lengthen_sleeves"
    | "take_in_waist"
    | "let_out_waist"
    | "adjust_chest"
    | "adjust_shoulders"
    | "take_in_hips"
    | "let_out_hips"
    | "hem_trousers"
    | "lengthen_trousers"
    | "shorten_body"
    | "fit_issue"
    | "structural_shoulder_work"
    | "structural_chest_issue";
  garment:
    | "jacket"
    | "shirt"
    | "sweater"
    | "coat"
    | "waistcoat"
    | "trousers";
  measurement: string;
  amount: number | null;
  estimatedCost: number | null;
  feasibility: TailoringFeasibility;
  note?: string;
};

export type AlterationEstimate = {
  totalEstimatedCost: number | null;
  feasibility: TailoringFeasibility;
  actions: TailoringAction[];
  notes: string[];
};

export type MeasurementAssessment = {
  garment:
    | "jacket"
    | "shirt"
    | "sweater"
    | "coat"
    | "waistcoat"
    | "trousers";
  measurement:
    | "chest"
    | "shoulders"
    | "body_length"
    | "waist"
    | "sleeve_length"
    | "hips"
    | "inseam"
    | "outseam"
    | "opening";
  target: number | null;
  actual: number | null;
  difference: number | null;
  direction: MeasurementDirection;
  severity: MeasurementSeverity;
  tailoringRisk: TailoringRisk;
  rangePosition: RangePosition;
  tailoringBand?: "ideal" | "easy" | "complex" | "untailorable" | null;
  preferredRange: MeasurementRange | null;
  alterationNote?: string | null;
};

export type FitRecommendation = {
  status: FitRecommendationStatus;
  confidence: FitConfidence;
  score: number;
  available: boolean;
  targetSource: TargetSource;
  targetSourceNote: string;
  assessments: MeasurementAssessment[];
  hardStopReasons: string[];
  summary: string;
  alterationEstimate: AlterationEstimate | null;
  estimatedAlterationCost: number | null;
};

export type FitStatus = FitRecommendationStatus;

type ListingFitKind = "upper" | "waistcoat" | "trousers";
type MeasurementKey = MeasurementAssessment["measurement"];
type GarmentScope = MeasurementAssessment["garment"];

type RangeOffsets = {
  idealBelow: number;
  idealAbove: number;
  acceptableBelow: number;
  acceptableAbove: number;
};

type MeasurementRule = {
  key: MeasurementKey;
  weight: number;
  minorTolerance: number;
  moderateTolerance: number;
  tooSmallMultiplier: number;
  tooLargeMultiplier: number;
  hardStopTooSmall?: number;
  hardStopTooLarge?: number;
};

type MeasurementTarget = {
  target: number | null;
  range: MeasurementRange | null;
};

type FitTargets = {
  source: TargetSource;
  confidence: FitConfidence;
  note: string;
  measurements: Record<MeasurementKey, MeasurementTarget>;
};

type MeasurementInput = {
  garment: GarmentScope;
  key: MeasurementKey;
  target: number | null;
  range: MeasurementRange | null;
  actual: number | null;
  allowance?: number;
  pleated?: boolean;
  rule: MeasurementRule;
  category: Listing["category"];
};

type MeasurementScoreResult = {
  assessment: MeasurementAssessment;
  deduction: number;
  weightUsed: number;
  hardStopReason: string | null;
};

type MatrixBand = "ideal" | "easy" | "complex" | "untailorable";

type MatrixSideConfig = {
  idealMax: number;
  easyMax?: number | null;
  complexMax?: number | null;
  easyCost?: number | null;
  complexCost?: number | null;
  requiresAllowance?: boolean;
  untailorableNote?: string;
};

type MatrixMeasurementConfig = {
  tooSmall: MatrixSideConfig;
  tooLarge: MatrixSideConfig;
  tooLargeAction?: TailoringAction["type"] | null;
  tooSmallAction?: TailoringAction["type"] | null;
};

type UpperTargetMeasurements = BuyerJacketMeasurements | BuyerWaistcoatMeasurements;
type ListingMeasurementTargets = {
  chest: number | null;
  shoulders: number | null;
  bodyLength: number | null;
  waist: number | null;
  sleeveLength: number | null;
  sleeveAllowance: number;
  hips: number | null;
  inseam: number | null;
  outseam: number | null;
  inseamOutseamAllowance: number;
  waistAllowance: number;
  opening: number | null;
  pleated: boolean;
};

type FitBlock = {
  targets: FitTargets;
  scoredMeasurements: MeasurementScoreResult[];
  actuals: ListingMeasurementTargets;
  kind: ListingFitKind;
  category: Listing["category"];
  garment: GarmentScope;
};

const STATUS_SCORE_BANDS = {
  strongMatchMinimum: 85,
  workableMinimum: 65,
  riskyMinimum: 45
} as const;

const ASSESSMENT_PENALTY_FACTORS: Record<Exclude<MeasurementSeverity, "unknown">, number> = {
  good: 0,
  minor_issue: 0.2,
  moderate_issue: 0.6,
  major_issue: 1.15
};

const UPPER_BODY_RULES: Record<"shoulders" | "chest" | "body_length" | "waist" | "sleeve_length", MeasurementRule> = {
  shoulders: {
    key: "shoulders",
    weight: 28,
    minorTolerance: 0.5,
    moderateTolerance: 1,
    tooSmallMultiplier: 1.45,
    tooLargeMultiplier: 0.65,
    hardStopTooSmall: 1.45
  },
  chest: {
    key: "chest",
    weight: 24,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.35,
    tooLargeMultiplier: 0.8,
    hardStopTooSmall: 2.75
  },
  body_length: {
    key: "body_length",
    weight: 14,
    minorTolerance: 1,
    moderateTolerance: 2,
    tooSmallMultiplier: 1.15,
    tooLargeMultiplier: 0.9
  },
  waist: {
    key: "waist",
    weight: 14,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.2,
    tooLargeMultiplier: 0.8
  },
  sleeve_length: {
    key: "sleeve_length",
    weight: 12,
    minorTolerance: 0.5,
    moderateTolerance: 1.25,
    tooSmallMultiplier: 1.2,
    tooLargeMultiplier: 0.8
  }
};

const LIGHT_VERTICAL_UPPER_BODY_RULES = {
  ...UPPER_BODY_RULES,
  body_length: {
    ...UPPER_BODY_RULES.body_length,
    weight: 8
  }
} satisfies Record<"shoulders" | "chest" | "body_length" | "waist" | "sleeve_length", MeasurementRule>;

const WAISTCOAT_RULES: Record<"shoulders" | "chest" | "body_length" | "waist", MeasurementRule> = {
  shoulders: {
    key: "shoulders",
    weight: 30,
    minorTolerance: 0.45,
    moderateTolerance: 0.9,
    tooSmallMultiplier: 1.45,
    tooLargeMultiplier: 0.65,
    hardStopTooSmall: 1.35
  },
  chest: {
    key: "chest",
    weight: 26,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.3,
    tooLargeMultiplier: 0.8,
    hardStopTooSmall: 2.5
  },
  body_length: {
    key: "body_length",
    weight: 14,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.15,
    tooLargeMultiplier: 0.9
  },
  waist: {
    key: "waist",
    weight: 22,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.2,
    tooLargeMultiplier: 0.85
  }
};

const LIGHT_VERTICAL_WAISTCOAT_RULES = {
  ...WAISTCOAT_RULES,
  body_length: {
    ...WAISTCOAT_RULES.body_length,
    weight: 14
  }
} satisfies Record<"shoulders" | "chest" | "body_length" | "waist", MeasurementRule>;

const TROUSER_RULES: Record<"waist" | "hips" | "inseam" | "outseam" | "opening", MeasurementRule> = {
  waist: {
    key: "waist",
    weight: 34,
    minorTolerance: 1.5,
    moderateTolerance: 3,
    tooSmallMultiplier: 1.35,
    tooLargeMultiplier: 0.8,
    hardStopTooSmall: 1.5,
    hardStopTooLarge: 1.5
  },
  hips: {
    key: "hips",
    weight: 28,
    minorTolerance: 1,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.35,
    tooLargeMultiplier: 0.9,
    hardStopTooSmall: 1,
    hardStopTooLarge: 1
  },
  inseam: {
    key: "inseam",
    weight: 18,
    minorTolerance: 0.5,
    moderateTolerance: 1.25,
    tooSmallMultiplier: 1.35,
    tooLargeMultiplier: 0.75,
    hardStopTooSmall: 1.75
  },
  outseam: {
    key: "outseam",
    weight: 12,
    minorTolerance: 0.75,
    moderateTolerance: 1.5,
    tooSmallMultiplier: 1.1,
    tooLargeMultiplier: 0.85
  },
  opening: {
    key: "opening",
    weight: 8,
    minorTolerance: 0.5,
    moderateTolerance: 1,
    tooSmallMultiplier: 1,
    tooLargeMultiplier: 0.9
  }
};

const CATEGORY_RANGE_OFFSETS: Record<
  "jacket" | "shirt" | "sweater" | "coat" | "waistcoat" | "trousers",
  Partial<Record<MeasurementKey, RangeOffsets>>
> = {
  jacket: {
    shoulders: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 1, acceptableAbove: 0.9 },
    chest: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 0.75, acceptableAbove: 1 },
    body_length: { idealBelow: 1.5, idealAbove: 1.5, acceptableBelow: 1.5, acceptableAbove: 1.5 },
    waist: { idealBelow: 0.5, idealAbove: 0.75, acceptableBelow: 1, acceptableAbove: 1.5 },
    sleeve_length: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 4, acceptableAbove: 4 }
  },
  shirt: {
    shoulders: { idealBelow: 0.45, idealAbove: 0.45, acceptableBelow: 0.9, acceptableAbove: 0.8 },
    chest: { idealBelow: 0.5, idealAbove: 0.6, acceptableBelow: 1.25, acceptableAbove: 1.5 },
    body_length: { idealBelow: 1, idealAbove: 1, acceptableBelow: 2.25, acceptableAbove: 2.25 },
    waist: { idealBelow: 0.5, idealAbove: 0.6, acceptableBelow: 1.25, acceptableAbove: 1.5 },
    sleeve_length: { idealBelow: 0.5, idealAbove: 0.75, acceptableBelow: 1.25, acceptableAbove: 1.5 }
  },
  sweater: {
    shoulders: { idealBelow: 0.5, idealAbove: 0.6, acceptableBelow: 1, acceptableAbove: 1.1 },
    chest: { idealBelow: 0.5, idealAbove: 1, acceptableBelow: 1.5, acceptableAbove: 2.5 },
    body_length: { idealBelow: 0.75, idealAbove: 0.75, acceptableBelow: 2, acceptableAbove: 2 },
    waist: { idealBelow: 0.5, idealAbove: 1, acceptableBelow: 1.5, acceptableAbove: 2.5 },
    sleeve_length: { idealBelow: 0.5, idealAbove: 0.9, acceptableBelow: 1.25, acceptableAbove: 1.75 }
  },
  coat: {
    shoulders: { idealBelow: 0.75, idealAbove: 0.75, acceptableBelow: 0.75, acceptableAbove: 1.25 },
    chest: { idealBelow: 0.5, idealAbove: 0.75, acceptableBelow: 0.75, acceptableAbove: 1.25 },
    body_length: { idealBelow: 2.5, idealAbove: 5, acceptableBelow: 2.5, acceptableAbove: 5 },
    waist: { idealBelow: 0.5, idealAbove: 1, acceptableBelow: 1, acceptableAbove: 2 },
    sleeve_length: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 2.5, acceptableAbove: 2.5 }
  },
  waistcoat: {
    shoulders: { idealBelow: 0.45, idealAbove: 0.45, acceptableBelow: 0.9, acceptableAbove: 0.8 },
    chest: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 0.75, acceptableAbove: 1 },
    body_length: { idealBelow: 1.5, idealAbove: 2, acceptableBelow: 1.5, acceptableAbove: 2 },
    waist: { idealBelow: 0.5, idealAbove: 0.75, acceptableBelow: 1, acceptableAbove: 1.5 }
  },
  trousers: {
    waist: { idealBelow: 0.25, idealAbove: 0.25, acceptableBelow: 1.5, acceptableAbove: 1.5 },
    hips: { idealBelow: 0.5, idealAbove: 1.5, acceptableBelow: 0.5, acceptableAbove: 2.25 },
    inseam: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 8, acceptableAbove: 8 },
    outseam: { idealBelow: 0.5, idealAbove: 0.5, acceptableBelow: 8, acceptableAbove: 8 },
    opening: { idealBelow: 0.4, idealAbove: 0.5, acceptableBelow: 1, acceptableAbove: 1 }
  }
};

const MATRIX_SUPPORTED_CATEGORIES = new Set<Listing["category"]>([
  "jacket",
  "coat",
  "waistcoat",
  "trousers",
  "two_piece_suit",
  "three_piece_suit"
]);

const MATRIX_CONFIG: Record<
  "jacket" | "coat" | "waistcoat" | "trousers",
  Partial<Record<MeasurementKey, MatrixMeasurementConfig>>
> = {
  trousers: {
    waist: {
      tooSmall: { idealMax: 0.25, easyMax: 1.5, complexMax: 2.5, easyCost: 35, complexCost: 70, requiresAllowance: true, untailorableNote: "The trouser waist is too small to alter unless there is enough extra allowance." },
      tooLarge: { idealMax: 0.25, easyMax: 1.5, complexMax: 2.5, easyCost: 35, complexCost: 70, untailorableNote: "The trouser waist is too large to alter realistically." },
      tooSmallAction: "let_out_waist",
      tooLargeAction: "take_in_waist"
    },
    hips: {
      tooSmall: { idealMax: 0.5, untailorableNote: "The hips are too small to alter unless the garment has unusual extra fabric in the side seams." },
      tooLarge: { idealMax: 1.5, easyMax: 2.25, complexMax: 3, easyCost: 35, complexCost: 70, untailorableNote: "The hips are too large to alter realistically." },
      tooLargeAction: "take_in_hips"
    },
    inseam: {
      tooSmall: { idealMax: 0.5, easyMax: 8, complexMax: Number.POSITIVE_INFINITY, easyCost: 20, complexCost: 40, requiresAllowance: true, untailorableNote: "The inseam is too short to alter unless there is enough hem allowance." },
      tooLarge: { idealMax: 0.5, easyMax: 8, complexMax: Number.POSITIVE_INFINITY, easyCost: 20, complexCost: 40 },
      tooSmallAction: "lengthen_trousers",
      tooLargeAction: "hem_trousers"
    },
    outseam: {
      tooSmall: { idealMax: 0.5, easyMax: 8, complexMax: Number.POSITIVE_INFINITY, easyCost: 20, complexCost: 40, requiresAllowance: true, untailorableNote: "The outseam is too short to alter unless there is enough hem allowance." },
      tooLarge: { idealMax: 0.5, easyMax: 8, complexMax: Number.POSITIVE_INFINITY, easyCost: 20, complexCost: 40 },
      tooSmallAction: "lengthen_trousers",
      tooLargeAction: "hem_trousers"
    }
  },
  jacket: {
    chest: {
      tooSmall: { idealMax: 0.5, easyMax: 0.75, complexMax: 1, easyCost: 50, complexCost: 100, untailorableNote: "The chest is too small to alter realistically." },
      tooLarge: { idealMax: 0.5, easyMax: 1, complexMax: 1.5, easyCost: 50, complexCost: 100, untailorableNote: "The chest is too large to alter realistically." },
      tooSmallAction: "adjust_chest",
      tooLargeAction: "adjust_chest"
    },
    waist: {
      tooSmall: { idealMax: 0.5, easyMax: 1, easyCost: 40, untailorableNote: "The jacket waist is too small to alter realistically." },
      tooLarge: { idealMax: 0.75, easyMax: 1.5, complexMax: 2.5, easyCost: 40, complexCost: 80, untailorableNote: "The jacket waist is too large to alter realistically." },
      tooSmallAction: "let_out_waist",
      tooLargeAction: "take_in_waist"
    },
    shoulders: {
      tooSmall: { idealMax: 0.5, untailorableNote: "The shoulders are too small to alter realistically." },
      tooLarge: { idealMax: 0.5, easyMax: 0.75, complexMax: 1.5, easyCost: 60, complexCost: 120, untailorableNote: "The shoulders are too large to alter realistically." },
      tooLargeAction: "adjust_shoulders"
    },
    body_length: {
      tooSmall: { idealMax: 1.5, untailorableNote: "The body is too short to alter realistically." },
      tooLarge: { idealMax: 1.5, untailorableNote: "The body is too long to alter realistically." }
    },
    sleeve_length: {
      tooSmall: { idealMax: 0.5, easyMax: 4, requiresAllowance: true, easyCost: 45, untailorableNote: "The sleeves are too short to alter unless there is enough allowance." },
      tooLarge: { idealMax: 0.5, easyMax: 4, easyCost: 45, untailorableNote: "The sleeves are too long to alter realistically." },
      tooSmallAction: "lengthen_sleeves",
      tooLargeAction: "shorten_sleeves"
    }
  },
  waistcoat: {
    chest: {
      tooSmall: { idealMax: 0.5, easyMax: 0.75, complexMax: 1, easyCost: 40, complexCost: 80, untailorableNote: "The waistcoat chest is too small to alter realistically." },
      tooLarge: { idealMax: 0.5, easyMax: 1, complexMax: 2, easyCost: 40, complexCost: 80, untailorableNote: "The waistcoat chest is too large to alter realistically." },
      tooSmallAction: "adjust_chest",
      tooLargeAction: "adjust_chest"
    },
    waist: {
      tooSmall: { idealMax: 0.5, easyMax: 1, easyCost: 40, untailorableNote: "The waistcoat waist is too small to alter realistically." },
      tooLarge: { idealMax: 0.75, easyMax: 1.5, complexMax: 3, easyCost: 40, complexCost: 80, untailorableNote: "The waistcoat waist is too large to alter realistically." },
      tooSmallAction: "let_out_waist",
      tooLargeAction: "take_in_waist"
    },
    body_length: {
      tooSmall: { idealMax: 1.5, untailorableNote: "The waistcoat body is too short to alter realistically." },
      tooLarge: { idealMax: 2, untailorableNote: "The waistcoat body is too long to alter realistically." }
    }
  },
  coat: {
    chest: {
      tooSmall: { idealMax: 0.5, easyMax: 0.75, complexMax: 1, easyCost: 75, complexCost: 150, untailorableNote: "The coat chest is too small to alter realistically." },
      tooLarge: { idealMax: 0.75, easyMax: 1.25, complexMax: 2, easyCost: 75, complexCost: 150, untailorableNote: "The coat chest is too large to alter realistically." },
      tooSmallAction: "adjust_chest",
      tooLargeAction: "adjust_chest"
    },
    waist: {
      tooSmall: { idealMax: 0.5, easyMax: 1, easyCost: 50, untailorableNote: "The coat waist is too small to alter realistically." },
      tooLarge: { idealMax: 1, easyMax: 2, complexMax: 3, easyCost: 50, complexCost: 100, untailorableNote: "The coat waist is too large to alter realistically." },
      tooSmallAction: "let_out_waist",
      tooLargeAction: "take_in_waist"
    },
    shoulders: {
      tooSmall: { idealMax: 0.75, untailorableNote: "The shoulders are too small to alter realistically." },
      tooLarge: { idealMax: 0.75, easyMax: 1.25, complexMax: 1.75, easyCost: 90, complexCost: 180, untailorableNote: "The shoulders are too large to alter realistically." },
      tooLargeAction: "adjust_shoulders"
    },
    body_length: {
      tooSmall: { idealMax: 2.5, untailorableNote: "The coat body is too short to alter realistically." },
      tooLarge: { idealMax: 5, untailorableNote: "The coat body is too long to alter realistically." }
    },
    sleeve_length: {
      tooSmall: { idealMax: 0.5, easyMax: 2.5, requiresAllowance: true, easyCost: 65, untailorableNote: "The sleeves are too short to alter unless there is enough allowance." },
      tooLarge: { idealMax: 0.5, easyMax: 2.5, easyCost: 65, untailorableNote: "The sleeves are too long to alter realistically." },
      tooSmallAction: "lengthen_sleeves",
      tooLargeAction: "shorten_sleeves"
    }
  }
};

const JACKET_FALLBACK_ADJUSTMENTS: Record<
  "shirt" | "sweater" | "coat",
  Partial<Record<"chest" | "shoulders" | "bodyLength" | "waist" | "sleeveLength", number>>
> = {
  shirt: {
    chest: -0.75,
    waist: -0.5,
    shoulders: -0.25,
    bodyLength: 0.75,
    sleeveLength: -0.25
  },
  sweater: {
    chest: 0.5,
    waist: 0.5,
    shoulders: 0,
    bodyLength: -0.5,
    sleeveLength: -0.25
  },
  coat: {
    chest: 1.25,
    waist: 1,
    shoulders: 0.25,
    bodyLength: 2.25,
    sleeveLength: 0.25
  }
};

const FIT_EASE_BY_PREFERENCE = {
  trim: { jacket: 3, waistcoat: 2.5 },
  classic: { jacket: 4, waistcoat: 3.25 },
  relaxed: { jacket: 5, waistcoat: 4 }
} as const;

const JACKET_BODY_LENGTH_MULTIPLIER = {
  trim: 0.42,
  classic: 0.43,
  relaxed: 0.44
} as const;

function roundMoney(value: number) {
  return Math.round(value * 10) / 10;
}

function roundMeasurement(value: number) {
  return Math.round(value * 4) / 4;
}

function hasMeaningfulValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function comparableFieldCount(assessments: MeasurementAssessment[]) {
  return assessments.filter((assessment) => assessment.target !== null && assessment.actual !== null).length;
}

function getListingKind(category: Listing["category"]): ListingFitKind {
  if (category === "trousers") {
    return "trousers";
  }

  if (category === "waistcoat") {
    return "waistcoat";
  }

  return "upper";
}

function measurementDifference(target: number, actual: number) {
  return roundMeasurement(actual - target);
}

function buildRange(target: number, offsets: RangeOffsets): MeasurementRange {
  return {
    idealMin: roundMeasurement(target - offsets.idealBelow),
    idealMax: roundMeasurement(target + offsets.idealAbove),
    acceptableMin: roundMeasurement(target - offsets.acceptableBelow),
    acceptableMax: roundMeasurement(target + offsets.acceptableAbove)
  };
}

function normalizeMatrixCategory(category: Listing["category"]) {
  if (category === "two_piece_suit" || category === "three_piece_suit") {
    return "jacket" as const;
  }

  if (category === "jacket" || category === "coat" || category === "waistcoat" || category === "trousers") {
    return category;
  }

  return null;
}

function getMatrixConfig(category: Listing["category"], key: MeasurementKey) {
  const normalized = normalizeMatrixCategory(category);
  if (!normalized) {
    return null;
  }

  return MATRIX_CONFIG[normalized]?.[key] ?? null;
}

function getRangeOffsets(category: Listing["category"], key: MeasurementKey): RangeOffsets | null {
  if (category === "two_piece_suit" || category === "three_piece_suit") {
    return CATEGORY_RANGE_OFFSETS.jacket[key] ?? null;
  }

  return CATEGORY_RANGE_OFFSETS[category]?.[key] ?? null;
}

function widenRangeForPleats(range: MeasurementRange | null, key: MeasurementKey, pleated?: boolean) {
  if (!range || !pleated || key !== "hips") {
    return range;
  }

  return {
    idealMin: roundMeasurement(range.idealMin - 0.5),
    idealMax: roundMeasurement(range.idealMax + 0.5),
    acceptableMin: roundMeasurement(range.acceptableMin - 0.5),
    acceptableMax: roundMeasurement(range.acceptableMax + 0.5)
  };
}

function adjustDeltaForPleats(delta: number, key: MeasurementKey, pleated?: boolean) {
  if (!pleated || key !== "hips") {
    return delta;
  }

  return Math.max(0, roundMeasurement(delta - 0.5));
}

function emptyListingMeasurements(): ListingMeasurementTargets {
  return {
    chest: null,
    shoulders: null,
    bodyLength: null,
    waist: null,
    sleeveLength: null,
    sleeveAllowance: 0,
    hips: null,
    inseam: null,
    outseam: null,
    inseamOutseamAllowance: 0,
    waistAllowance: 0,
    opening: null,
    pleated: false
  };
}

function getUpperListingMeasurements(listing: Listing): ListingMeasurementTargets {
  return {
    chest: listing.jacketMeasurements?.chest ?? (hasMeaningfulValue(listing.chest) ? listing.chest : null),
    shoulders: listing.jacketMeasurements?.shoulders ?? (hasMeaningfulValue(listing.shoulder) ? listing.shoulder : null),
    bodyLength: listing.jacketMeasurements?.bodyLength ?? null,
    waist: listing.jacketMeasurements?.waist ?? (hasMeaningfulValue(listing.waist) ? listing.waist : null),
    sleeveLength:
      listing.jacketMeasurements?.sleeveLength ?? (hasMeaningfulValue(listing.sleeve) ? listing.sleeve : null),
    sleeveAllowance: listing.jacketMeasurements?.sleeveLengthAllowance ?? 0,
    hips: null,
    inseam: null,
    outseam: null,
    inseamOutseamAllowance: 0,
    waistAllowance: 0,
    opening: null,
    pleated: false
  };
}

function getWaistcoatListingMeasurements(listing: Listing): ListingMeasurementTargets {
  return {
    chest: listing.waistcoatMeasurements?.chest ?? (hasMeaningfulValue(listing.chest) ? listing.chest : null),
    shoulders:
      listing.waistcoatMeasurements?.shoulders ?? (hasMeaningfulValue(listing.shoulder) ? listing.shoulder : null),
    bodyLength: listing.waistcoatMeasurements?.bodyLength ?? null,
    waist: listing.waistcoatMeasurements?.waist ?? (hasMeaningfulValue(listing.waist) ? listing.waist : null),
    sleeveLength: null,
    sleeveAllowance: 0,
    hips: null,
    inseam: null,
    outseam: null,
    inseamOutseamAllowance: 0,
    waistAllowance: 0,
    opening: null,
    pleated: false
  };
}

function getTrouserListingMeasurements(listing: Listing): ListingMeasurementTargets {
  return {
    chest: null,
    shoulders: null,
    bodyLength: null,
    waist: listing.trouserMeasurements?.waist ?? null,
    sleeveLength: null,
    sleeveAllowance: 0,
    hips: listing.trouserMeasurements?.hips ?? null,
    inseam: listing.trouserMeasurements?.inseam ?? null,
    outseam: listing.trouserMeasurements?.outseam ?? null,
    inseamOutseamAllowance: listing.trouserMeasurements?.inseamOutseamAllowance ?? 0,
    waistAllowance: listing.trouserMeasurements?.waistAllowance ?? 0,
    opening: listing.trouserMeasurements?.opening ?? null,
    pleated: listing.trouserSpecs?.front === "pleated"
  };
}

function getListingMeasurements(listing: Listing): ListingMeasurementTargets {
  if (listing.category === "trousers") {
    return getTrouserListingMeasurements(listing);
  }

  if (listing.category === "waistcoat") {
    return getWaistcoatListingMeasurements(listing);
  }

  return getUpperListingMeasurements(listing);
}

function deriveUpperBodyFallbackFromJacket(
  category: Listing["category"],
  jacketMeasurements: BuyerJacketMeasurements
): BuyerJacketMeasurements {
  const adjustments =
    category === "shirt" || category === "sweater" || category === "coat"
      ? JACKET_FALLBACK_ADJUSTMENTS[category]
      : {};

  return {
    chest: roundMoney(jacketMeasurements.chest + (adjustments.chest ?? 0)),
    waist: roundMoney(jacketMeasurements.waist + (adjustments.waist ?? 0)),
    shoulders: roundMoney(jacketMeasurements.shoulders + (adjustments.shoulders ?? 0)),
    bodyLength: roundMoney(jacketMeasurements.bodyLength + (adjustments.bodyLength ?? 0)),
    sleeveLength: roundMoney(jacketMeasurements.sleeveLength + (adjustments.sleeveLength ?? 0)),
    sleeveLengthAllowance: 0
  };
}

function deriveWaistcoatFallbackFromJacket(profile: BuyerProfile): BuyerWaistcoatMeasurements | null {
  if (!profile.jacketMeasurements) {
    return null;
  }

  const fitPreference = profile.fitPreference ?? "classic";
  const ease = FIT_EASE_BY_PREFERENCE[fitPreference];
  const jacket = profile.jacketMeasurements;
  const jacketWaistAllowance = Math.max(ease.jacket - 1, 2) / 2;
  const waistcoatWaistAllowance = Math.max(ease.waistcoat - 0.5, 2) / 2;
  const inferredHeight = jacket.bodyLength / JACKET_BODY_LENGTH_MULTIPLIER[fitPreference];

  return {
    chest: roundMeasurement(jacket.chest - ease.jacket / 2 + ease.waistcoat / 2),
    waist: roundMeasurement(jacket.waist - jacketWaistAllowance + waistcoatWaistAllowance),
    shoulders: roundMeasurement(jacket.shoulders * 0.72),
    bodyLength: roundMeasurement(inferredHeight * 0.32)
  };
}

function buildMeasurementTarget(
  category: Listing["category"],
  key: MeasurementKey,
  target: number | null
): MeasurementTarget {
  if (!hasMeaningfulValue(target)) {
    return { target: target ?? null, range: null };
  }

  const offsets = getRangeOffsets(category, key);
  return {
    target,
    range: offsets ? buildRange(target, offsets) : null
  };
}

function buildUpperBodyFitTargets(category: Listing["category"], measurements: UpperTargetMeasurements): Record<MeasurementKey, MeasurementTarget> {
  return {
    chest: buildMeasurementTarget(category, "chest", measurements.chest),
    shoulders: buildMeasurementTarget(category, "shoulders", measurements.shoulders),
    body_length: buildMeasurementTarget(category, "body_length", measurements.bodyLength),
    waist: buildMeasurementTarget(category, "waist", measurements.waist),
    sleeve_length: buildMeasurementTarget(
      category,
      "sleeve_length",
      "sleeveLength" in measurements ? measurements.sleeveLength ?? null : null
    ),
    hips: { target: null, range: null },
    inseam: { target: null, range: null },
    outseam: { target: null, range: null },
    opening: { target: null, range: null }
  };
}

function buildTrouserFitTargets(measurements: BuyerTrouserMeasurements): Record<MeasurementKey, MeasurementTarget> {
  return {
    chest: { target: null, range: null },
    shoulders: { target: null, range: null },
    body_length: { target: null, range: null },
    waist: buildMeasurementTarget("trousers", "waist", measurements.waist),
    sleeve_length: { target: null, range: null },
    hips: buildMeasurementTarget("trousers", "hips", measurements.hips),
    inseam: buildMeasurementTarget("trousers", "inseam", measurements.inseam),
    outseam: buildMeasurementTarget("trousers", "outseam", measurements.outseam),
    opening: buildMeasurementTarget("trousers", "opening", measurements.opening)
  };
}

function emptyTargets(note: string): FitTargets {
  return {
    source: "unavailable",
    confidence: "low",
    note,
    measurements: {
      chest: { target: null, range: null },
      shoulders: { target: null, range: null },
      body_length: { target: null, range: null },
      waist: { target: null, range: null },
      sleeve_length: { target: null, range: null },
      hips: { target: null, range: null },
      inseam: { target: null, range: null },
      outseam: { target: null, range: null },
      opening: { target: null, range: null }
    }
  };
}

function combineSourceNotes(notes: string[]) {
  const cleaned = Array.from(new Set(notes.map((note) => note.trim()).filter(Boolean)));

  if (cleaned.length <= 1) {
    return cleaned[0] ?? "";
  }

  const labels = cleaned
    .map((note) => {
      if (note.includes("saved jacket measurements")) return "jacket";
      if (note.includes("saved trouser measurements")) return "trouser";
      if (note.includes("saved waistcoat measurements")) return "waistcoat";
      if (note.includes("saved coat measurements")) return "coat";
      if (note.includes("saved shirt measurements")) return "shirt";
      if (note.includes("saved sweater measurements")) return "sweater";
      return null;
    })
    .filter((label): label is string => Boolean(label));

  if (labels.length === cleaned.length) {
    if (labels.length === 2) {
      return `Guidance is based on your saved ${labels[0]} and ${labels[1]} measurements.`;
    }

    return `Guidance is based on your saved ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]} measurements.`;
  }

  return cleaned.join(" ");
}

function getFitTargetsForListing(profile: BuyerProfile, listing: Listing): FitTargets {
  if (listing.category === "trousers") {
    if (!profile.trouserMeasurements) {
      return emptyTargets("Guidance is unavailable until you save trouser measurements on your profile.");
    }

    return {
      source: "category_direct",
      confidence: "high",
      note: combineSourceNotes(["Guidance is based on your saved trouser measurements."]),
      measurements: buildTrouserFitTargets(profile.trouserMeasurements)
    };
  }

  if (listing.category === "waistcoat") {
    if (profile.waistcoatMeasurements) {
      return {
        source: "category_direct",
        confidence: "high",
        note: combineSourceNotes(["Guidance is based on your saved waistcoat measurements."]),
        measurements: buildUpperBodyFitTargets(listing.category, profile.waistcoatMeasurements)
      };
    }

    const derivedWaistcoat = deriveWaistcoatFallbackFromJacket(profile);
    if (derivedWaistcoat) {
      return {
        source: "jacket_fallback_adjusted",
        confidence: "medium",
        note: combineSourceNotes([
          "Guidance is adapted from your saved jacket measurements using the same jacket-based profile expansion."
        ]),
        measurements: buildUpperBodyFitTargets(listing.category, derivedWaistcoat)
      };
    }

    return emptyTargets("Guidance is unavailable until you save jacket measurements on your profile.");
  }

  const directMeasurements =
    listing.category === "shirt"
      ? profile.shirtMeasurements
      : listing.category === "sweater"
        ? profile.sweaterMeasurements
        : listing.category === "coat"
          ? profile.coatMeasurements
          : profile.jacketMeasurements;

  if (directMeasurements) {
    const note =
      listing.category === "shirt"
        ? "Guidance is based on your saved shirt measurements."
        : listing.category === "sweater"
          ? "Guidance is based on your saved sweater measurements."
          : listing.category === "coat"
            ? "Guidance is based on your saved coat measurements."
            : "Guidance is based on your saved jacket measurements.";

    return {
      source: "category_direct",
      confidence: "high",
      note: combineSourceNotes([note]),
      measurements: buildUpperBodyFitTargets(listing.category, directMeasurements)
    };
  }

  if ((listing.category === "shirt" || listing.category === "sweater" || listing.category === "coat") && profile.jacketMeasurements) {
    return {
      source: "jacket_fallback_adjusted",
      confidence: "medium",
      note: combineSourceNotes(["Guidance is adapted from your saved jacket measurements using category-specific ease adjustments."]),
      measurements: buildUpperBodyFitTargets(
        listing.category,
        deriveUpperBodyFallbackFromJacket(listing.category, profile.jacketMeasurements)
      )
    };
  }

  return emptyTargets("Save garment measurements on your profile to unlock fit guidance for this listing.");
}

function buildFitBlock(
  kind: ListingFitKind,
  category: Listing["category"],
  garment: GarmentScope,
  targets: FitTargets,
  actuals: ListingMeasurementTargets
): FitBlock {
  return {
    targets,
    scoredMeasurements: buildMeasurementAssessments(kind, category, garment, targets.measurements, actuals),
    actuals,
    kind,
    category,
    garment
  };
}

function getSuitBlocks(profile: BuyerProfile, listing: Listing): { blocks: FitBlock[]; unavailableNote?: string } {
  const notes: string[] = [];
  const blocks: FitBlock[] = [];

  if (!profile.jacketMeasurements) {
    return { blocks: [], unavailableNote: "Guidance is unavailable until you save jacket measurements on your profile." };
  }

  if (!profile.trouserMeasurements) {
    return { blocks: [], unavailableNote: "Guidance is unavailable until you save trouser measurements on your profile." };
  }

  notes.push("Guidance is based on your saved jacket measurements.");
  notes.push("Guidance is based on your saved trouser measurements.");

  const combinedNote = combineSourceNotes(notes);

  blocks.push(
    buildFitBlock(
      "upper",
      "jacket",
      "jacket",
      {
        source: "category_direct",
        confidence: "high",
        note: combinedNote,
        measurements: buildUpperBodyFitTargets("jacket", profile.jacketMeasurements)
      },
      getUpperListingMeasurements(listing)
    )
  );

  if (listing.category === "three_piece_suit") {
    const waistcoatMeasurements = profile.waistcoatMeasurements ?? deriveWaistcoatFallbackFromJacket(profile);
    if (!waistcoatMeasurements) {
      return { blocks: [], unavailableNote: "Guidance is unavailable until you save jacket measurements on your profile." };
    }

    const usingWaistcoatFallback = !profile.waistcoatMeasurements;
    notes.push(
      usingWaistcoatFallback
        ? "Guidance is adapted from your saved jacket measurements using the same jacket-based profile expansion."
        : "Guidance is based on your saved waistcoat measurements."
    );
    const updatedCombinedNote = usingWaistcoatFallback
      ? "Guidance is based on your saved jacket and trouser measurements, with waistcoat guidance adapted from your saved jacket measurements."
      : combineSourceNotes(notes);

    blocks[0] = {
      ...blocks[0],
      targets: {
        ...blocks[0].targets,
        note: updatedCombinedNote,
        confidence: usingWaistcoatFallback ? "medium" : blocks[0].targets.confidence
      }
    };

    blocks.push(
      buildFitBlock(
        "waistcoat",
        "waistcoat",
        "waistcoat",
        {
          source: usingWaistcoatFallback ? "jacket_fallback_adjusted" : "category_direct",
          confidence: usingWaistcoatFallback ? "medium" : "high",
          note: updatedCombinedNote,
          measurements: buildUpperBodyFitTargets("waistcoat", waistcoatMeasurements)
        },
        getWaistcoatListingMeasurements(listing)
      )
    );

    blocks.push(
      buildFitBlock(
        "trousers",
        "trousers",
        "trousers",
        {
          source: "category_direct",
          confidence: usingWaistcoatFallback ? "medium" : "high",
          note: updatedCombinedNote,
          measurements: buildTrouserFitTargets(profile.trouserMeasurements)
        },
        getTrouserListingMeasurements(listing)
      )
    );

    return { blocks };
  }

  blocks.push(
    buildFitBlock(
      "trousers",
      "trousers",
      "trousers",
      {
        source: "category_direct",
        confidence: "high",
        note: combinedNote,
        measurements: buildTrouserFitTargets(profile.trouserMeasurements)
      },
      getTrouserListingMeasurements(listing)
    )
  );

  return { blocks };
}

function getRangePosition(
  actual: number,
  range: MeasurementRange,
  allowance = 0
): {
  direction: Exclude<MeasurementDirection, "unknown">;
  rangePosition: RangePosition;
  allowanceBridgesToIdeal: boolean;
  allowanceBridgesToAcceptable: boolean;
  overshoot: number;
} {
  if (actual >= range.idealMin && actual <= range.idealMax) {
    return {
      direction: "close",
      rangePosition: "ideal",
      allowanceBridgesToIdeal: false,
      allowanceBridgesToAcceptable: false,
      overshoot: 0
    };
  }

  if (actual < range.idealMin) {
    const effectiveActual = actual + Math.max(0, allowance);
    if (actual >= range.acceptableMin) {
      return {
        direction: "too_small",
        rangePosition: "acceptable",
        allowanceBridgesToIdeal: false,
        allowanceBridgesToAcceptable: false,
        overshoot: roundMoney(range.idealMin - actual)
      };
    }

    if (effectiveActual >= range.idealMin) {
      return {
        direction: "too_small",
        rangePosition: "acceptable",
        allowanceBridgesToIdeal: true,
        allowanceBridgesToAcceptable: true,
        overshoot: roundMoney(range.idealMin - effectiveActual)
      };
    }

    if (effectiveActual >= range.acceptableMin) {
      return {
        direction: "too_small",
        rangePosition: "outside_acceptable",
        allowanceBridgesToIdeal: false,
        allowanceBridgesToAcceptable: true,
        overshoot: roundMoney(range.acceptableMin - effectiveActual)
      };
    }

    return {
      direction: "too_small",
      rangePosition: "outside_acceptable",
      allowanceBridgesToIdeal: false,
      allowanceBridgesToAcceptable: false,
      overshoot: roundMoney(range.acceptableMin - effectiveActual)
    };
  }

  if (actual <= range.acceptableMax) {
    return {
      direction: "too_large",
      rangePosition: "acceptable",
      allowanceBridgesToIdeal: false,
      allowanceBridgesToAcceptable: false,
      overshoot: roundMoney(actual - range.idealMax)
    };
  }

  return {
    direction: "too_large",
    rangePosition: "outside_acceptable",
    allowanceBridgesToIdeal: false,
    allowanceBridgesToAcceptable: false,
    overshoot: roundMoney(actual - range.acceptableMax)
  };
}

function tailoringRiskForAssessment(
  key: MeasurementKey,
  direction: MeasurementDirection,
  severity: MeasurementSeverity,
  allowanceBridgesToIdeal: boolean,
  allowanceBridgesToAcceptable: boolean
): TailoringRisk {
  if (severity === "unknown") {
    return "unknown";
  }

  if (key === "shoulders") {
    return severity === "good" ? "easy" : severity === "minor_issue" ? "risky" : "not_realistic";
  }

  if (key === "chest") {
    if (direction === "too_small" && severity !== "minor_issue") {
      return "not_realistic";
    }

    return severity === "major_issue" ? "risky" : severity === "good" ? "easy" : "moderate";
  }

  if (allowanceBridgesToIdeal || allowanceBridgesToAcceptable) {
    return allowanceBridgesToIdeal ? "easy" : "possible";
  }

  if (key === "waist") {
    if (direction === "too_large") {
      return severity === "major_issue" ? "moderate" : "easy";
    }

    return severity === "major_issue" ? "risky" : "moderate";
  }

  if (key === "sleeve_length" || key === "inseam" || key === "outseam") {
    if (direction === "too_large") {
      return "easy";
    }

    return severity === "major_issue" ? "risky" : "possible";
  }

  if (key === "hips") {
    return direction === "too_small" && severity !== "minor_issue" ? "risky" : severity === "major_issue" ? "risky" : "moderate";
  }

  return severity === "good" ? "easy" : severity === "major_issue" ? "risky" : "moderate";
}

function hardStopReasonForAssessment(
  key: MeasurementKey,
  direction: MeasurementDirection,
  actual: number,
  allowance: number,
  range: MeasurementRange,
  rule: MeasurementRule
) {
  if (direction === "too_small" && rule.hardStopTooSmall) {
    const shortageAfterAllowance = range.acceptableMin - (actual + Math.max(0, allowance));
    if (shortageAfterAllowance < rule.hardStopTooSmall) {
      return null;
    }

    switch (key) {
      case "shoulders":
        return "The shoulders are materially too small to be a realistic tailoring candidate.";
      case "chest":
        return "The chest is materially too small, which makes this a risky structural fit.";
      case "inseam":
        return "The inseam is materially too short even after considering normal hem allowance.";
      case "waist":
        return "The trouser waist is too small to be a realistic tailoring candidate without unusual extra allowance.";
      case "hips":
        return "The hips are too small to be a realistic tailoring candidate.";
      default:
        return null;
    }
  }

  if (direction === "too_large" && rule.hardStopTooLarge) {
    const oversize = actual - range.acceptableMax;
    if (oversize < rule.hardStopTooLarge) {
      return null;
    }

    if (key === "waist") {
      return "The trouser waist is too large to be a realistic tailoring candidate.";
    }

    if (key === "hips") {
      return "The hips are too large to be a realistic tailoring candidate.";
    }
  }

  return null;
}

function classifyMatrixSide(
  difference: number,
  side: MatrixSideConfig,
  allowance: number
): { band: MatrixBand; allowanceSupported: boolean } {
  const idealMax = side.idealMax;
  const allowanceSupported = side.requiresAllowance && difference > 0 && Math.max(0, allowance) >= difference;

  if (difference <= idealMax) {
    return { band: "ideal", allowanceSupported };
  }

  if (side.requiresAllowance && !allowanceSupported) {
    return { band: "untailorable", allowanceSupported: false };
  }

  if (side.easyMax !== undefined && side.easyMax !== null && difference <= side.easyMax) {
    return { band: "easy", allowanceSupported };
  }

  if (side.complexMax !== undefined && side.complexMax !== null && difference <= side.complexMax) {
    return { band: "complex", allowanceSupported };
  }

  return { band: "untailorable", allowanceSupported };
}

function getAllowanceUnsupportedNote(key: MeasurementKey) {
  switch (key) {
    case "sleeve_length":
      return "The sleeves and any listed allowance are too short to alter realistically.";
    case "inseam":
      return "The inseam and any listed hem allowance are too short to alter realistically.";
    case "outseam":
      return "The outseam and any listed hem allowance are too short to alter realistically.";
    case "waist":
      return "The trouser waist and any listed allowance are too small to alter realistically.";
    default:
      return `${key.replace(/_/g, " ")} and any listed allowance are too small to alter realistically.`;
  }
}

function scoreMatrixMeasurement(input: MeasurementInput, config: MatrixMeasurementConfig): MeasurementScoreResult {
  const { key, target, range, actual, allowance = 0, rule } = input;
  const effectiveRange = widenRangeForPleats(range, key, input.pleated);

  if (!hasMeaningfulValue(target) || !hasMeaningfulValue(actual) || !effectiveRange) {
    return {
      assessment: {
        garment: input.garment,
        measurement: key,
        target: target ?? null,
        actual: actual ?? null,
        difference: target !== null && actual !== null ? measurementDifference(target, actual) : null,
        direction: "unknown",
        severity: "unknown",
        tailoringRisk: "unknown",
        rangePosition: "unknown",
        tailoringBand: null,
        preferredRange: effectiveRange ?? null,
        alterationNote: null
      },
      deduction: 0,
      weightUsed: 0,
      hardStopReason: null
    };
  }

  const difference = measurementDifference(target, actual);
  const rawDirection: MeasurementDirection =
    actual < target ? "too_small" : actual > target ? "too_large" : "close";
  const delta = adjustDeltaForPleats(Math.abs(difference), key, input.pleated);
  const side = rawDirection === "too_small" ? config.tooSmall : config.tooLarge;
  const classification =
    rawDirection === "close" ? { band: "ideal" as const, allowanceSupported: false } : classifyMatrixSide(delta, side, allowance);
  const band = classification.band;
  const direction: MeasurementDirection = band === "ideal" ? "close" : rawDirection;
  const severity: MeasurementSeverity =
    band === "ideal" ? "good" : band === "easy" ? "minor_issue" : band === "complex" ? "moderate_issue" : "major_issue";
  const rangePosition: RangePosition =
    band === "ideal" ? "ideal" : band === "easy" ? "acceptable" : "outside_acceptable";
  const tailoringRisk: TailoringRisk =
    band === "ideal"
      ? "easy"
      : band === "easy"
        ? "easy"
        : band === "complex"
          ? "risky"
          : "not_realistic";
  const penaltyFactor =
    band === "ideal" ? 0 : band === "easy" ? 0.35 : band === "complex" ? 0.75 : 1.25;
  const deduction = roundMoney(rule.weight * penaltyFactor);
  const allowanceRequiredButInsufficient = Boolean(side.requiresAllowance && !classification.allowanceSupported && rawDirection === "too_small" && band === "untailorable");
  const hardStopReason =
    band === "untailorable"
      ? allowanceRequiredButInsufficient
        ? getAllowanceUnsupportedNote(key)
        : side.untailorableNote ?? `${key.replace(/_/g, " ")} is outside the matrix's realistic tailoring range.`
      : null;
  const alterationNote =
    band === "ideal"
      ? null
      : classification.allowanceSupported
        ? "Listed alteration allowance should make this adjustment possible."
        : band === "easy"
          ? "This is relatively straightforward for a tailor to alter."
        : band === "complex"
          ? "This is relatively complex for a tailor to alter."
            : allowanceRequiredButInsufficient
              ? getAllowanceUnsupportedNote(key)
              : "This falls outside the matrix's realistic tailoring range.";

  return {
    assessment: {
      garment: input.garment,
      measurement: key,
      target,
      actual,
      difference,
      direction,
      severity,
      tailoringRisk,
      rangePosition,
      tailoringBand: band,
      preferredRange: effectiveRange,
      alterationNote
    },
    deduction,
    weightUsed: rule.weight,
    hardStopReason
  };
}

function scoreMeasurement(input: MeasurementInput): MeasurementScoreResult {
  const { key, target, range, actual, allowance = 0, rule } = input;
  const matrixConfig = getMatrixConfig(input.category, key);

  if (matrixConfig) {
    return scoreMatrixMeasurement(input, matrixConfig);
  }

  const effectiveRange = widenRangeForPleats(range, key, input.pleated);

  if (!hasMeaningfulValue(target) || !hasMeaningfulValue(actual) || !effectiveRange) {
    return {
      assessment: {
        garment: input.garment,
        measurement: key,
        target: target ?? null,
        actual: actual ?? null,
        difference: target !== null && actual !== null ? measurementDifference(target, actual) : null,
        direction: "unknown",
          severity: "unknown",
          tailoringRisk: "unknown",
          rangePosition: "unknown",
          tailoringBand: null,
          preferredRange: effectiveRange ?? null,
          alterationNote: null
        },
      deduction: 0,
      weightUsed: 0,
      hardStopReason: null
    };
  }

  const rangeState = getRangePosition(actual, effectiveRange, allowance);
  const difference = measurementDifference(target, actual);
  const severity: MeasurementSeverity =
    rangeState.rangePosition === "ideal"
      ? "good"
      : rangeState.rangePosition === "acceptable"
        ? "minor_issue"
        : rangeState.overshoot <= rule.minorTolerance
          ? "moderate_issue"
          : "major_issue";
  const multiplier =
    rangeState.direction === "too_small"
      ? rule.tooSmallMultiplier
      : rangeState.direction === "too_large"
        ? rule.tooLargeMultiplier
        : 0;
  const penaltyFactor =
    rangeState.allowanceBridgesToIdeal
      ? 0.12
      : rangeState.allowanceBridgesToAcceptable
        ? 0.28
        : ASSESSMENT_PENALTY_FACTORS[severity];
  const deduction = roundMoney(rule.weight * penaltyFactor * multiplier);
  const alterationNote =
    rangeState.allowanceBridgesToIdeal || rangeState.allowanceBridgesToAcceptable
      ? "Listed alteration allowance should make this a relatively straightforward adjustment."
      : rangeState.rangePosition === "acceptable"
        ? "This sits outside your ideal range but still inside a reasonable tailored tolerance."
        : null;

  return {
    assessment: {
      garment: input.garment,
      measurement: key,
      target,
      actual,
      difference,
      direction: rangeState.direction,
      severity,
      tailoringRisk: tailoringRiskForAssessment(
        key,
        rangeState.direction,
        severity,
        rangeState.allowanceBridgesToIdeal,
        rangeState.allowanceBridgesToAcceptable
      ),
      rangePosition: rangeState.rangePosition,
      tailoringBand: rangeState.rangePosition === "ideal" ? "ideal" : rangeState.rangePosition === "acceptable" ? "easy" : "complex",
      preferredRange: effectiveRange,
      alterationNote
    },
    deduction,
    weightUsed: rule.weight,
    hardStopReason: hardStopReasonForAssessment(key, rangeState.direction, actual, allowance, range, rule)
  };
}

function buildMeasurementAssessments(
  kind: ListingFitKind,
  category: Listing["category"],
  garment: GarmentScope,
  targets: FitTargets["measurements"],
  actuals: ListingMeasurementTargets
) {
  const upperRules =
    category === "shirt" || category === "coat" ? LIGHT_VERTICAL_UPPER_BODY_RULES : UPPER_BODY_RULES;
  const waistcoatRules = LIGHT_VERTICAL_WAISTCOAT_RULES;
  const inputs: MeasurementInput[] =
    kind === "trousers"
      ? [
          {
            garment,
            key: "waist",
            target: targets.waist.target,
            range: targets.waist.range,
            actual: actuals.waist,
            allowance: actuals.waistAllowance,
            rule: TROUSER_RULES.waist,
            category
          },
          {
            garment,
            key: "hips",
            target: targets.hips.target,
            range: targets.hips.range,
            actual: actuals.hips,
            pleated: actuals.pleated,
            rule: TROUSER_RULES.hips,
            category
          },
          {
            garment,
            key: "inseam",
            target: targets.inseam.target,
            range: targets.inseam.range,
            actual: actuals.inseam,
            allowance: actuals.inseamOutseamAllowance,
            rule: TROUSER_RULES.inseam,
            category
          },
          {
            garment,
            key: "opening",
            target: targets.opening.target,
            range: targets.opening.range,
            actual: actuals.opening,
            rule: TROUSER_RULES.opening,
            category
          }
        ]
      : kind === "waistcoat"
        ? [
            {
              garment,
              key: "shoulders",
              target: targets.shoulders.target,
              range: targets.shoulders.range,
              actual: actuals.shoulders,
              rule: waistcoatRules.shoulders,
              category
            },
            {
              garment,
              key: "chest",
              target: targets.chest.target,
              range: targets.chest.range,
              actual: actuals.chest,
              rule: waistcoatRules.chest,
              category
            },
            {
              garment,
              key: "body_length",
              target: targets.body_length.target,
              range: targets.body_length.range,
              actual: actuals.bodyLength,
              rule: waistcoatRules.body_length,
              category
            },
            {
              garment,
              key: "waist",
              target: targets.waist.target,
              range: targets.waist.range,
              actual: actuals.waist,
              rule: waistcoatRules.waist,
              category
            }
          ]
        : [
            {
              garment,
              key: "shoulders",
              target: targets.shoulders.target,
              range: targets.shoulders.range,
              actual: actuals.shoulders,
              rule: upperRules.shoulders,
              category
            },
            {
              garment,
              key: "chest",
              target: targets.chest.target,
              range: targets.chest.range,
              actual: actuals.chest,
              rule: upperRules.chest,
              category
            },
            {
              garment,
              key: "body_length",
              target: targets.body_length.target,
              range: targets.body_length.range,
              actual: actuals.bodyLength,
              rule: upperRules.body_length,
              category
            },
            {
              garment,
              key: "waist",
              target: targets.waist.target,
              range: targets.waist.range,
              actual: actuals.waist,
              rule: upperRules.waist,
              category
            },
            {
              garment,
              key: "sleeve_length",
              target: targets.sleeve_length.target,
              range: targets.sleeve_length.range,
              actual: actuals.sleeveLength,
              allowance: actuals.sleeveAllowance,
              rule: upperRules.sleeve_length,
              category
            }
          ];

  return inputs.map(scoreMeasurement);
}

function statusFromScore(score: number, hardStopReasons: string[]): FitRecommendationStatus {
  if (hardStopReasons.length > 0) {
    return "not_recommended";
  }

  if (score >= STATUS_SCORE_BANDS.strongMatchMinimum) {
    return "strong_match";
  }

  if (score >= STATUS_SCORE_BANDS.workableMinimum) {
    return "workable_with_tailoring";
  }

  if (score >= STATUS_SCORE_BANDS.riskyMinimum) {
    return "risky_but_possible";
  }

  return "not_recommended";
}

function scoreFromResults(scoredMeasurements: MeasurementScoreResult[]) {
  const deductionTotal = scoredMeasurements.reduce((sum, result) => sum + result.deduction, 0);
  const weightTotal = scoredMeasurements.reduce((sum, result) => sum + result.weightUsed, 0);
  const normalizedScore =
    weightTotal > 0 ? Math.max(0, Math.min(100, Math.round(100 - (deductionTotal / weightTotal) * 100))) : 0;

  return {
    deductionTotal,
    weightTotal,
    normalizedScore
  };
}

function getListingPieceCount(category: Listing["category"]) {
  if (category === "two_piece_suit") {
    return 2;
  }

  if (category === "three_piece_suit") {
    return 3;
  }

  return 1;
}

function applyTailoringBurdenAdjustment(
  score: number,
  alterationEstimate: AlterationEstimate | null,
  category: Listing["category"]
) {
  if (!alterationEstimate) {
    return score;
  }

  const actionCount = alterationEstimate.actions.length;
  if (actionCount === 0) {
    return score;
  }

  const pieceCount = getListingPieceCount(category);
  const actionDensityPenalty = Math.min(8, (actionCount / pieceCount - 1) * 2.5);
  const riskyActionPenalty = alterationEstimate.actions.reduce((sum, action) => {
    if (action.feasibility === "not_realistic") {
      return sum + 5;
    }

    if (action.feasibility === "risky") {
      return sum + 2.5;
    }

    return sum;
  }, 0);

  const riskyActionPenaltyPerPiece = Math.min(6, riskyActionPenalty / pieceCount);
  const costPerPiece =
    alterationEstimate.totalEstimatedCost && alterationEstimate.totalEstimatedCost > 0
      ? alterationEstimate.totalEstimatedCost / pieceCount
      : 0;
  const costPenalty =
    costPerPiece > 125
      ? Math.min(6, Math.floor((costPerPiece - 125) / 50) + 1)
      : 0;

  const totalPenalty = actionDensityPenalty + riskyActionPenaltyPerPiece + costPenalty;
  return Math.max(0, Math.min(100, Math.round(score - totalPenalty)));
}

function amountToIdeal(assessment: MeasurementAssessment) {
  if (assessment.target === null || assessment.actual === null) {
    return null;
  }

  return roundMeasurement(Math.abs(assessment.actual - assessment.target));
}

function findAssessment(assessments: MeasurementAssessment[], measurement: MeasurementKey, garment?: GarmentScope) {
  return assessments.find(
    (assessment) => assessment.measurement === measurement && (!garment || assessment.garment === garment)
  );
}

function addAction(actions: TailoringAction[], action: TailoringAction | null) {
  if (action) {
    actions.push(action);
  }
}

function matrixBandFeasibility(band: MatrixBand): TailoringFeasibility {
  switch (band) {
    case "ideal":
      return "easy";
    case "easy":
      return "easy";
    case "complex":
      return "risky";
    case "untailorable":
      return "not_realistic";
  }
}

function buildMatrixTailoringAction(
  category: Listing["category"],
  assessment: MeasurementAssessment
): TailoringAction | null {
  const config = getMatrixConfig(category, assessment.measurement);
  if (!config || !assessment.tailoringBand || assessment.tailoringBand === "ideal" || assessment.direction === "close" || assessment.direction === "unknown") {
    return null;
  }

  const side = assessment.direction === "too_small" ? config.tooSmall : config.tooLarge;
  const actionType = assessment.direction === "too_small" ? config.tooSmallAction : config.tooLargeAction;
  const fallbackActionType: TailoringAction["type"] | null =
    assessment.tailoringBand === "untailorable"
      ? assessment.measurement === "shoulders"
        ? "structural_shoulder_work"
        : assessment.measurement === "chest"
          ? "structural_chest_issue"
          : "fit_issue"
      : null;
  if (!actionType && !fallbackActionType) {
    return null;
  }

  const estimatedCost =
    assessment.tailoringBand === "easy"
      ? side.easyCost ?? null
      : assessment.tailoringBand === "complex"
        ? side.complexCost ?? side.easyCost ?? null
        : null;
  const feasibility = matrixBandFeasibility(assessment.tailoringBand);

  return {
    type: actionType ?? fallbackActionType!,
    garment: assessment.garment,
    measurement: assessment.measurement,
    amount: amountToIdeal(assessment),
    estimatedCost,
    feasibility,
    note:
      assessment.tailoringBand === "easy"
        ? "This is relatively straightforward for a tailor to alter."
        : assessment.tailoringBand === "complex"
          ? "This is relatively complex for a tailor to alter."
          : assessment.alterationNote ?? side.untailorableNote
  };
}

function sleeveAction(
  assessment: MeasurementAssessment | undefined,
  actuals: ListingMeasurementTargets
): TailoringAction | null {
  if (!assessment || assessment.direction === "close" || assessment.direction === "unknown") {
    return null;
  }

  const amount = amountToIdeal(assessment);
  if (!amount || amount <= 0) {
    return null;
  }

  if (assessment.direction === "too_large") {
    return {
      type: "shorten_sleeves",
      garment: assessment.garment,
      measurement: "sleeve_length",
      amount,
      estimatedCost: roundMoney(25 + amount * 12),
      feasibility: "easy",
      note: "Routine sleeve shortening is usually straightforward."
    };
  }

  if (actuals.sleeveAllowance > 0 && assessment.preferredRange && actuals.sleeveLength !== null) {
    const reachesAcceptable = actuals.sleeveLength + actuals.sleeveAllowance >= assessment.preferredRange.acceptableMin;
    return {
      type: "lengthen_sleeves",
      garment: assessment.garment,
      measurement: "sleeve_length",
      amount,
      estimatedCost: reachesAcceptable ? roundMoney(42 + amount * 16) : null,
      feasibility: reachesAcceptable ? "possible" : "risky",
      note: reachesAcceptable
        ? "Sleeve lengthening looks plausible because allowance is listed."
        : "Sleeve lengthening depends on allowance, and the listed allowance may still be insufficient."
    };
  }

  return {
    type: "lengthen_sleeves",
    garment: assessment.garment,
    measurement: "sleeve_length",
    amount,
    estimatedCost: null,
    feasibility: "risky",
    note: "Sleeve lengthening is hard to recommend without listed allowance."
  };
}

function upperWaistAction(assessment: MeasurementAssessment | undefined): TailoringAction | null {
  if (!assessment || assessment.direction === "close" || assessment.direction === "unknown") {
    return null;
  }

  const amount = amountToIdeal(assessment);
  if (!amount || amount <= 0) {
    return null;
  }

  if (assessment.direction === "too_large") {
    return {
      type: "take_in_waist",
      garment: assessment.garment,
      measurement: "waist",
      amount,
      estimatedCost: roundMoney(35 + amount * 12),
      feasibility: "easy",
      note: "Waist suppression is a standard upper-body alteration."
    };
  }

  return {
    type: "let_out_waist",
    garment: assessment.garment,
    measurement: "waist",
    amount,
    estimatedCost: null,
    feasibility: "risky",
    note: "Letting out the waist depends on seam allowance, which is not listed here."
  };
}

function trouserWaistAction(
  assessment: MeasurementAssessment | undefined,
  actuals: ListingMeasurementTargets
): TailoringAction | null {
  if (!assessment || assessment.direction === "close" || assessment.direction === "unknown") {
    return null;
  }

  const amount = amountToIdeal(assessment);
  if (!amount || amount <= 0) {
    return null;
  }

  if (assessment.direction === "too_large") {
    const feasibility =
      assessment.rangePosition === "acceptable"
        ? "easy"
        : assessment.severity === "moderate_issue"
          ? "risky"
          : "not_realistic";
    return {
      type: "take_in_waist",
      garment: assessment.garment,
      measurement: "waist",
      amount,
      estimatedCost: feasibility === "not_realistic" ? null : roundMoney(28 + amount * 10),
      feasibility,
      note:
        feasibility === "easy"
          ? "Taking in the trouser waist should be relatively straightforward."
          : feasibility === "risky"
            ? "Taking in the trouser waist may still be possible, but the amount needed is moving beyond routine work."
            : "The trouser waist is so far from your target that normal waist suppression is unlikely to be worthwhile."
    };
  }

  if (actuals.waistAllowance > 0 && assessment.preferredRange && actuals.waist !== null) {
    const reachesAcceptable = actuals.waist + actuals.waistAllowance >= assessment.preferredRange.acceptableMin;
    const feasibility =
      assessment.rangePosition === "acceptable"
        ? "easy"
        : assessment.severity === "moderate_issue"
          ? "risky"
          : "not_realistic";
    return {
      type: "let_out_waist",
      garment: assessment.garment,
      measurement: "waist",
      amount,
      estimatedCost: reachesAcceptable && feasibility !== "not_realistic" ? roundMoney(35 + amount * 12) : null,
      feasibility: !reachesAcceptable ? "risky" : feasibility,
      note: !reachesAcceptable
        ? "The listed waist allowance may still be too limited for the amount needed."
        : feasibility === "easy"
          ? "Listed waist allowance should make this a relatively straightforward let-out."
          : feasibility === "risky"
            ? "Listed waist allowance may make this possible, but the amount needed is moving into difficult territory."
            : "Even with listed allowance, the amount needed is likely beyond a realistic let-out."
    };
  }

  return {
    type: "let_out_waist",
    garment: assessment.garment,
    measurement: "waist",
    amount,
    estimatedCost: null,
    feasibility: assessment.severity === "major_issue" ? "not_realistic" : "risky",
    note:
      assessment.severity === "major_issue"
        ? "Without clear waist allowance, this amount of let-out is likely unrealistic."
        : "Letting out the waist may be possible, but it is difficult to recommend without listed allowance."
  };
}

function trouserHipAction(assessment: MeasurementAssessment | undefined): TailoringAction | null {
  if (!assessment || assessment.direction === "close" || assessment.direction === "unknown") {
    return null;
  }

  const amount = amountToIdeal(assessment);
  if (!amount || amount <= 0) {
    return null;
  }

  if (assessment.direction === "too_large") {
    const feasibility =
      assessment.rangePosition === "acceptable"
        ? "easy"
        : assessment.severity === "moderate_issue"
          ? "risky"
          : "not_realistic";
    return {
      type: "take_in_hips",
      garment: assessment.garment,
      measurement: "hips",
      amount,
      estimatedCost: feasibility === "not_realistic" ? null : roundMoney(40 + amount * 14),
      feasibility,
      note:
        feasibility === "easy"
          ? "Taking in excess room through the hips is often possible when the garment is only moderately full."
          : feasibility === "risky"
            ? "Hip reduction may still be possible, but the amount needed is moving into difficult tailoring territory."
            : "The hips are so full that reducing them cleanly is unlikely to be worthwhile."
    };
  }

  return {
    type: "let_out_hips",
    garment: assessment.garment,
    measurement: "hips",
    amount,
    estimatedCost: null,
    feasibility: assessment.severity === "major_issue" ? "not_realistic" : "risky",
    note:
      assessment.severity === "major_issue"
        ? "Letting out the hips by this amount is likely not realistic."
        : "Letting out the hips may be possible in limited cases, but it is generally difficult."
  };
}

function bodyLengthAction(assessment: MeasurementAssessment | undefined): TailoringAction | null {
  if (!assessment || assessment.direction !== "too_large") {
    return null;
  }

  const amount = amountToIdeal(assessment);
  if (!amount || amount <= 0) {
    return null;
  }

  return {
    type: "shorten_body",
    garment: assessment.garment,
    measurement: "body_length",
    amount,
    estimatedCost: roundMoney(55 + amount * 18),
    feasibility: "possible",
    note: "Body shortening is possible, but it is more involved than routine sleeve or hem work."
  };
}

function shoulderAction(assessment: MeasurementAssessment | undefined): TailoringAction | null {
  if (!assessment || assessment.severity === "good" || assessment.direction === "unknown") {
    return null;
  }

  return {
    type: "structural_shoulder_work",
    garment: assessment.garment,
    measurement: "shoulders",
    amount: amountToIdeal(assessment),
    estimatedCost: null,
    feasibility: assessment.severity === "minor_issue" ? "risky" : "not_realistic",
    note: "Shoulder corrections are structural and usually not attractive alteration candidates."
  };
}

function chestAction(assessment: MeasurementAssessment | undefined): TailoringAction | null {
  if (!assessment || assessment.direction !== "too_small" || assessment.severity === "good" || assessment.direction === "unknown") {
    return null;
  }

  return {
    type: "structural_chest_issue",
    garment: assessment.garment,
    measurement: "chest",
    amount: amountToIdeal(assessment),
    estimatedCost: null,
    feasibility: "not_realistic",
    note: "A chest that runs materially too small is usually a structural issue, not a routine alteration."
  };
}

function trouserLengthAction(
  inseamAssessment: MeasurementAssessment | undefined,
  actuals: ListingMeasurementTargets
): TailoringAction | null {
  const primary = inseamAssessment;
  if (!primary || primary.direction === "close" || primary.direction === "unknown") {
    return null;
  }

  const amount = amountToIdeal(primary);
  if (!amount || amount <= 0) {
    return null;
  }

  if (primary.direction === "too_large") {
    return {
      type: "hem_trousers",
      garment: primary.garment,
      measurement: primary.measurement,
      amount,
      estimatedCost: roundMoney(18 + amount * 8),
      feasibility: "easy",
      note: "Hemming shorter is routine trouser work."
    };
  }

  if (actuals.inseamOutseamAllowance > 0 && primary.preferredRange && primary.actual !== null) {
    const reachesAcceptable = primary.actual + actuals.inseamOutseamAllowance >= primary.preferredRange.acceptableMin;
    return {
      type: "lengthen_trousers",
      garment: primary.garment,
      measurement: primary.measurement,
      amount,
      estimatedCost: reachesAcceptable ? roundMoney(30 + amount * 12) : null,
      feasibility: reachesAcceptable ? "possible" : "risky",
      note: reachesAcceptable
        ? "Listed hem allowance should make additional length plausible."
        : "The available hem allowance may still be too limited for the extra length needed."
    };
  }

  return {
    type: "lengthen_trousers",
    garment: primary.garment,
    measurement: primary.measurement,
    amount,
    estimatedCost: null,
    feasibility: "risky",
    note: "Lengthening trousers is hard to recommend without listed hem allowance."
  };
}

function feasibilityRank(feasibility: TailoringFeasibility) {
  return {
    easy: 0,
    possible: 1,
    risky: 2,
    not_realistic: 3
  }[feasibility];
}

function buildAlterationEstimate(
  kind: ListingFitKind,
  category: Listing["category"],
  status: FitRecommendationStatus,
  assessments: MeasurementAssessment[],
  actuals: ListingMeasurementTargets,
  hardStopReasons: string[]
): AlterationEstimate | null {
  const actions: TailoringAction[] = [];
  const notes = [...hardStopReasons];

  if (MATRIX_SUPPORTED_CATEGORIES.has(category)) {
    for (const assessment of assessments) {
      addAction(actions, buildMatrixTailoringAction(category, assessment));
    }
  } else if (kind === "trousers") {
    addAction(actions, trouserWaistAction(findAssessment(assessments, "waist"), actuals));
    addAction(actions, trouserHipAction(findAssessment(assessments, "hips")));
    addAction(
      actions,
      trouserLengthAction(findAssessment(assessments, "inseam"), actuals)
    );
  } else {
    addAction(actions, shoulderAction(findAssessment(assessments, "shoulders")));
    addAction(actions, chestAction(findAssessment(assessments, "chest")));
    addAction(actions, upperWaistAction(findAssessment(assessments, "waist")));
    addAction(actions, sleeveAction(findAssessment(assessments, "sleeve_length"), actuals));
    addAction(actions, bodyLengthAction(findAssessment(assessments, "body_length")));
  }

  for (const action of actions) {
    if (action.note) {
      notes.push(action.note);
    }
  }

  const feasibility = actions.reduce<TailoringFeasibility>(
    (current, action) => (feasibilityRank(action.feasibility) > feasibilityRank(current) ? action.feasibility : current),
    hardStopReasons.length > 0 ? "not_realistic" : "easy"
  );
  const finiteCosts = actions
    .map((action) => action.estimatedCost)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  let totalEstimatedCost: number | null = finiteCosts.reduce((sum, value) => sum + value, 0);
  if (status === "not_recommended" && (hardStopReasons.length > 0 || feasibility === "not_realistic")) {
    totalEstimatedCost = null;
  } else if (actions.some((action) => action.estimatedCost === null) && finiteCosts.length === 0) {
    totalEstimatedCost = null;
  } else {
    totalEstimatedCost = roundMoney(Math.min(totalEstimatedCost, 450));
  }

  return {
    totalEstimatedCost,
    feasibility,
    actions,
    notes
  };
}

function combineAlterationEstimates(
  estimates: Array<AlterationEstimate | null>,
  status: FitRecommendationStatus,
  hardStopReasons: string[]
): AlterationEstimate | null {
  const present = estimates.filter((estimate): estimate is AlterationEstimate => Boolean(estimate));

  if (present.length === 0) {
    return null;
  }

  const actions = present.flatMap((estimate) => estimate.actions);
  const notes = [...hardStopReasons, ...present.flatMap((estimate) => estimate.notes)];
  const feasibility = present.reduce<TailoringFeasibility>(
    (current, estimate) =>
      feasibilityRank(estimate.feasibility) > feasibilityRank(current) ? estimate.feasibility : current,
    hardStopReasons.length > 0 ? "not_realistic" : "easy"
  );
  const finiteCosts = present
    .map((estimate) => estimate.totalEstimatedCost)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  let totalEstimatedCost: number | null = finiteCosts.reduce((sum, value) => sum + value, 0);
  if (status === "not_recommended" && (hardStopReasons.length > 0 || feasibility === "not_realistic")) {
    totalEstimatedCost = null;
  } else if (present.some((estimate) => estimate.totalEstimatedCost === null) && finiteCosts.length === 0) {
    totalEstimatedCost = null;
  } else {
    totalEstimatedCost = roundMoney(Math.min(totalEstimatedCost, 450));
  }

  return {
    totalEstimatedCost,
    feasibility,
    actions,
    notes
  };
}

function buildSummary(recommendation: Omit<FitRecommendation, "summary" | "estimatedAlterationCost">) {
  if (!recommendation.available) {
    return recommendation.targetSourceNote || "Save garment measurements on your profile to unlock fit guidance for this listing.";
  }

  if (recommendation.hardStopReasons.length > 0) {
    return `${recommendation.hardStopReasons[0]} ${recommendation.targetSourceNote}`.trim();
  }

  const actionPreview = recommendation.alterationEstimate?.actions
    .slice(0, 2)
    .map((action) => {
      switch (action.type) {
        case "shorten_sleeves":
          return "shortening the sleeves";
        case "lengthen_sleeves":
          return "lengthening the sleeves";
        case "take_in_waist":
          return "taking in the waist";
        case "let_out_waist":
          return "letting out the waist";
        case "adjust_chest":
          return "adjusting the chest";
        case "adjust_shoulders":
          return "adjusting the shoulders";
        case "take_in_hips":
          return "taking in the hips";
        case "let_out_hips":
          return "letting out the hips";
        case "hem_trousers":
          return "hemming the trousers";
        case "lengthen_trousers":
          return "lengthening the trousers";
        case "shorten_body":
          return "shortening the body";
        case "structural_shoulder_work":
          return "structural shoulder work";
        case "structural_chest_issue":
          return "structural chest correction";
      }
    })
    .filter(Boolean)
    .join(" and ");

  if (recommendation.status === "strong_match") {
    if (recommendation.alterationEstimate?.actions.length) {
      return `This looks like a strong match overall, though it would likely benefit from ${actionPreview}. ${recommendation.targetSourceNote}`.trim();
    }

    return `This looks like a strong match with only minimal tailoring needed, if any. ${recommendation.targetSourceNote}`.trim();
  }

  if (recommendation.status === "workable_with_tailoring") {
    return `This looks workable with tailoring. The most likely next step is ${actionPreview || "routine tailoring"} rather than structural correction. ${recommendation.targetSourceNote}`.trim();
  }

  if (recommendation.status === "risky_but_possible") {
    return `This may still be possible, but the required work is moving beyond routine tailoring. ${actionPreview || "Several measurements are sitting outside your acceptable range"}. ${recommendation.targetSourceNote}`.trim();
  }

  return `This is not recommended based on the saved fit profile. ${recommendation.targetSourceNote}`.trim();
}

export function getFitRecommendation(profile: BuyerProfile, listing: Listing): FitRecommendation {
  if (listing.category === "two_piece_suit" || listing.category === "three_piece_suit") {
    const suit = getSuitBlocks(profile, listing);

    if (suit.unavailableNote || suit.blocks.length === 0) {
      const unavailable: Omit<FitRecommendation, "summary" | "estimatedAlterationCost"> = {
        status: "not_recommended",
        confidence: "low",
        score: 0,
        available: false,
        targetSource: "unavailable",
        targetSourceNote: suit.unavailableNote ?? "Save garment measurements on your profile to unlock fit guidance for this listing.",
        assessments: [],
        hardStopReasons: [suit.unavailableNote ?? "Save garment measurements on your profile to unlock fit guidance for this listing."],
        alterationEstimate: null
      };

      return {
        ...unavailable,
        summary: buildSummary(unavailable),
        estimatedAlterationCost: null
      };
    }

    const scoredMeasurements = suit.blocks.flatMap((block) => block.scoredMeasurements);
    const assessments = scoredMeasurements.map((result) => result.assessment);
    const comparableMeasurements = comparableFieldCount(assessments);

    if (comparableMeasurements === 0) {
      const unavailable: Omit<FitRecommendation, "summary" | "estimatedAlterationCost"> = {
        status: "not_recommended",
        confidence: "low",
        score: 0,
        available: false,
        targetSource: "unavailable",
        targetSourceNote: suit.blocks[0]?.targets.note ?? "Save garment measurements on your profile to unlock fit guidance for this listing.",
        assessments,
        hardStopReasons: [suit.blocks[0]?.targets.note ?? "Save garment measurements on your profile to unlock fit guidance for this listing."],
        alterationEstimate: null
      };

      return {
        ...unavailable,
        summary: buildSummary(unavailable),
        estimatedAlterationCost: null
      };
    }

    const hardStopReasons = scoredMeasurements
      .map((result) => result.hardStopReason)
      .filter((reason): reason is string => Boolean(reason));
    const { normalizedScore } = scoreFromResults(scoredMeasurements);
    const preliminaryStatus = statusFromScore(normalizedScore, hardStopReasons);
    const blockEstimates = suit.blocks.map((block) =>
      buildAlterationEstimate(
        block.kind,
        block.category,
        statusFromScore(
          scoreFromResults(block.scoredMeasurements).normalizedScore,
          block.scoredMeasurements
            .map((result) => result.hardStopReason)
            .filter((reason): reason is string => Boolean(reason))
        ),
        block.scoredMeasurements.map((result) => result.assessment),
        block.actuals,
        block.scoredMeasurements
          .map((result) => result.hardStopReason)
          .filter((reason): reason is string => Boolean(reason))
      )
    );
    const alterationEstimate = combineAlterationEstimates(blockEstimates, preliminaryStatus, hardStopReasons);
    const adjustedScore = applyTailoringBurdenAdjustment(normalizedScore, alterationEstimate, listing.category);
    const status = statusFromScore(adjustedScore, hardStopReasons);
    const baseRecommendation: Omit<FitRecommendation, "summary" | "estimatedAlterationCost"> = {
      status,
      confidence: suit.blocks.some((block) => block.targets.confidence === "medium") ? "medium" : "high",
      score: adjustedScore,
      available: true,
      targetSource: suit.blocks.some((block) => block.targets.source === "jacket_fallback_adjusted")
        ? "jacket_fallback_adjusted"
        : "category_direct",
      targetSourceNote: suit.blocks[0].targets.note,
      assessments,
      hardStopReasons,
      alterationEstimate
    };

    return {
      ...baseRecommendation,
      summary: buildSummary(baseRecommendation),
      estimatedAlterationCost: alterationEstimate?.totalEstimatedCost ?? null
    };
  }

  const kind = getListingKind(listing.category);
  const actuals = getListingMeasurements(listing);
  const targets = getFitTargetsForListing(profile, listing);
  const scoredMeasurements = buildMeasurementAssessments(
    kind,
    listing.category,
    listing.category === "waistcoat" ? "waistcoat" : listing.category === "trousers" ? "trousers" : (listing.category as GarmentScope),
    targets.measurements,
    actuals
  );
  const assessments = scoredMeasurements.map((result) => result.assessment);
  const comparableMeasurements = comparableFieldCount(assessments);

  if (targets.source === "unavailable" || comparableMeasurements === 0) {
    const unavailable: Omit<FitRecommendation, "summary" | "estimatedAlterationCost"> = {
      status: "not_recommended",
      confidence: "low",
      score: 0,
      available: false,
      targetSource: "unavailable",
      targetSourceNote: targets.note,
      assessments,
      hardStopReasons: [targets.note],
      alterationEstimate: null
    };

    return {
      ...unavailable,
      summary: buildSummary(unavailable),
      estimatedAlterationCost: null
    };
  }

  const hardStopReasons = scoredMeasurements
    .map((result) => result.hardStopReason)
    .filter((reason): reason is string => Boolean(reason));
  const { normalizedScore } = scoreFromResults(scoredMeasurements);
  const preliminaryStatus = statusFromScore(normalizedScore, hardStopReasons);
  const alterationEstimate = buildAlterationEstimate(kind, listing.category, preliminaryStatus, assessments, actuals, hardStopReasons);
  const adjustedScore = applyTailoringBurdenAdjustment(normalizedScore, alterationEstimate, listing.category);
  const status = statusFromScore(adjustedScore, hardStopReasons);
  const baseRecommendation: Omit<FitRecommendation, "summary" | "estimatedAlterationCost"> = {
    status,
    confidence: targets.confidence,
    score: adjustedScore,
    available: true,
    targetSource: targets.source,
    targetSourceNote: targets.note,
    assessments,
    hardStopReasons,
    alterationEstimate
  };

  return {
    ...baseRecommendation,
    summary: buildSummary(baseRecommendation),
    estimatedAlterationCost: alterationEstimate?.totalEstimatedCost ?? null
  };
}

export function getFitStatus(profile: BuyerProfile, listing: Listing): FitStatus {
  return getFitRecommendation(profile, listing).status;
}

export function getAlterationCost(profile: BuyerProfile, listing: Listing) {
  return getFitRecommendation(profile, listing).estimatedAlterationCost;
}
