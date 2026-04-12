import {
  rateGeneratedBuyerMeasurementOutputs,
  runBuyerBodyMeasurementSanityCheck,
  type BuyerBodyMeasurementInputs,
  type BodyMeasurementSanityStatus,
  type MeasurementGuideConfidenceLevel
} from "@/lib/measurement-guide-support";

type ExampleExpectation = {
  sanityStatus: BodyMeasurementSanityStatus;
  minimumSanityScore?: number;
  maximumSanityScore?: number;
  fieldConfidence?: Record<string, MeasurementGuideConfidenceLevel>;
};

type MeasurementGuideSupportExample = {
  name: string;
  description: string;
  inputs: BuyerBodyMeasurementInputs;
  expectation: ExampleExpectation;
};

function expectLevel(
  actual: MeasurementGuideConfidenceLevel | undefined,
  expected: MeasurementGuideConfidenceLevel,
  label: string
) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected} but received ${actual ?? "undefined"}.`);
  }
}

function expectScoreInRange(actual: number, minimum?: number, maximum?: number, label?: string) {
  if (minimum !== undefined && actual < minimum) {
    throw new Error(`${label ?? "Score"} expected at least ${minimum} but received ${actual}.`);
  }

  if (maximum !== undefined && actual > maximum) {
    throw new Error(`${label ?? "Score"} expected at most ${maximum} but received ${actual}.`);
  }
}

// Representative tuning examples for the menswear-only sanity checker and
// generated-output confidence model. This is intentionally deterministic and
// lightweight so we can adjust thresholds without needing an external test
// framework yet.
export const MEASUREMENT_GUIDE_SUPPORT_EXAMPLES: MeasurementGuideSupportExample[] = [
  {
    name: "classic_plausible_baseline",
    description: "Typical classic tailoring proportions with complete direct inputs.",
    inputs: {
      height: 71,
      weight: 178,
      chest: 40,
      waist: 34,
      hips: 40.5,
      shoulders: 18,
      sleeveLength: 34,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 90,
      fieldConfidence: {
        "shirt.neck": "high",
        "jacket.shoulders": "high",
        "waistcoat.shoulders": "low"
      }
    }
  },
  {
    name: "trim_athletic_case",
    description: "Athletic V-shaped body that should still pass sanity checks comfortably.",
    inputs: {
      height: 72,
      weight: 188,
      chest: 44,
      waist: 32,
      hips: 39.5,
      shoulders: 19,
      sleeveLength: 34.5,
      neck: 16
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 84,
      fieldConfidence: {
        "shirt.neck": "high",
        "trousers.hips": "high"
      }
    }
  },
  {
    name: "fuller_plausible_case",
    description: "Fuller body proportions that should remain broadly plausible.",
    inputs: {
      height: 70,
      weight: 245,
      chest: 50,
      waist: 46,
      hips: 49,
      shoulders: 19.5,
      sleeveLength: 33,
      neck: 17.5
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 78
    }
  },
  {
    name: "missing_hips_soft_confidence_drop",
    description: "Missing hips should not break sanity, but trouser hip confidence should drop.",
    inputs: {
      height: 71,
      weight: 176,
      chest: 40,
      waist: 34,
      hips: null,
      shoulders: 18,
      sleeveLength: 34,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 88,
      fieldConfidence: {
        "trousers.hips": "low",
        "shirt.neck": "high"
      }
    }
  },
  {
    name: "strong_neck_signal",
    description: "Provided neck should drive high shirt-neck confidence even if other fields are sparse.",
    inputs: {
      height: 71,
      weight: null,
      chest: null,
      waist: null,
      hips: null,
      shoulders: null,
      sleeveLength: null,
      neck: 15.75
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 94,
      fieldConfidence: {
        "shirt.neck": "high",
        "trousers.hips": "low"
      }
    }
  },
  {
    name: "waistcoat_shoulder_stays_low",
    description: "Waistcoat shoulder should remain low-confidence despite shoulder input.",
    inputs: {
      height: 73,
      weight: 190,
      chest: 42,
      waist: 35,
      hips: 41,
      shoulders: 18.5,
      sleeveLength: 35,
      neck: 16
    },
    expectation: {
      sanityStatus: "ok",
      minimumSanityScore: 88,
      fieldConfidence: {
        "waistcoat.shoulders": "low",
        "jacket.shoulders": "high"
      }
    }
  },
  {
    name: "flat_vs_circumference_chest_confusion",
    description: "Entering a flat chest width where a circumference is expected should look unlikely.",
    inputs: {
      height: 71,
      weight: 175,
      chest: 21,
      waist: 34,
      hips: 40,
      shoulders: 18,
      sleeveLength: 34,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "unlikely",
      maximumSanityScore: 60
    }
  },
  {
    name: "flat_vs_circumference_waist_confusion",
    description: "Entering a flat waist width where a circumference is expected should look unlikely.",
    inputs: {
      height: 71,
      weight: 175,
      chest: 40,
      waist: 18,
      hips: 40,
      shoulders: 18,
      sleeveLength: 34,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "unlikely",
      maximumSanityScore: 62
    }
  },
  {
    name: "arm_length_typo_case",
    description: "Arm length typo should trigger an unlikely result.",
    inputs: {
      height: 71,
      weight: 180,
      chest: 40,
      waist: 34,
      hips: 40,
      shoulders: 18,
      sleeveLength: 24,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "unlikely",
      maximumSanityScore: 62
    }
  },
  {
    name: "contradictory_chest_and_waist",
    description: "A waist far larger than chest should trigger review or unlikely.",
    inputs: {
      height: 70,
      weight: 190,
      chest: 36,
      waist: 48,
      hips: 49,
      shoulders: 17.5,
      sleeveLength: 33,
      neck: 15
    },
    expectation: {
      sanityStatus: "unlikely",
      maximumSanityScore: 66
    }
  },
  {
    name: "very_broad_shoulder_review",
    description: "Broad shoulders can be real, but extreme shoulder-to-height ratio should at least prompt review.",
    inputs: {
      height: 67,
      weight: 180,
      chest: 42,
      waist: 34,
      hips: 40,
      shoulders: 23,
      sleeveLength: 33,
      neck: 16
    },
    expectation: {
      sanityStatus: "review",
      maximumSanityScore: 82
    }
  },
  {
    name: "missing_height_drops_vertical_confidence",
    description: "Missing height should lower vertical-dimension confidence without forcing a sanity warning.",
    inputs: {
      height: null,
      weight: 180,
      chest: 40,
      waist: 34,
      hips: 40,
      shoulders: 18,
      sleeveLength: 34,
      neck: 15.5
    },
    expectation: {
      sanityStatus: "ok",
      fieldConfidence: {
        "jacket.bodyLength": "medium",
        "trousers.inseam": "medium"
      }
    }
  },
  {
    name: "weight_only_soft_signal",
    description: "An unusual weight should not dominate a otherwise plausible measurement set.",
    inputs: {
      height: 72,
      weight: 300,
      chest: 44,
      waist: 40,
      hips: 45,
      shoulders: 19,
      sleeveLength: 35,
      neck: 16.5
    },
    expectation: {
      sanityStatus: "review",
      minimumSanityScore: 70
    }
  }
];

export function validateMeasurementGuideSupportExamples() {
  for (const example of MEASUREMENT_GUIDE_SUPPORT_EXAMPLES) {
    const sanity = runBuyerBodyMeasurementSanityCheck(example.inputs);
    const confidence = rateGeneratedBuyerMeasurementOutputs(example.inputs);

    if (sanity.status !== example.expectation.sanityStatus) {
      throw new Error(
        `${example.name} expected sanity status ${example.expectation.sanityStatus} but received ${sanity.status}.`
      );
    }

    expectScoreInRange(
      sanity.confidenceScore,
      example.expectation.minimumSanityScore,
      example.expectation.maximumSanityScore,
      `${example.name} sanity score`
    );

    for (const [fieldKey, expectedLevel] of Object.entries(example.expectation.fieldConfidence ?? {})) {
      expectLevel(confidence.byField[fieldKey]?.confidenceLevel, expectedLevel, `${example.name} ${fieldKey}`);
    }
  }

  return true;
}
