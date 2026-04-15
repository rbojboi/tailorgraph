import test from "node:test";
import assert from "node:assert/strict";
import { getFitRecommendation } from "./fit";
import type { BuyerProfile, Listing } from "./types";

function makeProfile(overrides: Partial<BuyerProfile> = {}): BuyerProfile {
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
      country: ""
    },
    addresses: [],
    height: 71,
    weight: 180,
    chest: 40,
    shoulder: 18,
    waist: 34,
    sleeve: 25,
    neck: 15.5,
    inseam: 31,
    fitPreference: "classic",
    maxAlterationBudget: 100,
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

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    sellerId: "seller-1",
    sellerDisplayName: "seller",
    title: "Listing",
    brand: "Brand",
    category: "jacket",
    sizeLabel: "40R",
    trouserSizeLabel: "",
    chest: 22,
    shoulder: 18,
    waist: 20,
    sleeve: 25,
    inseam: 31,
    outseam: 41,
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
    price: 100,
    shippingPrice: 10,
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: 2,
    location: "New York",
    distanceMiles: 10,
    description: "",
    media: [],
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    },
    jacketSpecs: null,
    shirtSpecs: null,
    sweaterSpecs: null,
    waistcoatMeasurements: null,
    waistcoatSpecs: null,
    trouserMeasurements: null,
    trouserSpecs: null,
    status: "active",
    createdAt: new Date("2026-01-01").toISOString(),
    ...overrides
  };
}

test("listing inside the ideal range returns a strong direct match", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(profile, makeListing());
  const chest = recommendation.assessments.find((assessment) => assessment.measurement === "chest");

  assert.equal(recommendation.status, "strong_match");
  assert.equal(recommendation.confidence, "high");
  assert.equal(chest?.rangePosition, "ideal");
});

test("two-piece suit combines jacket and trouser guidance sources", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    },
    trouserMeasurements: {
      waist: 17.5,
      hips: 22,
      inseam: 31,
      outseam: 41,
      opening: 10,
      waistAllowance: 0,
      inseamOutseamAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "two_piece_suit",
      jacketMeasurements: {
        chest: 22.75,
        waist: 20.5,
        shoulders: 18.5,
        bodyLength: 30,
        sleeveLength: 25.5,
        sleeveLengthAllowance: 0
      },
      trouserMeasurements: {
        waist: 18.5,
        hips: 22.75,
        inseam: 31.5,
        outseam: 41.5,
        opening: 10.25,
        waistAllowance: 0,
        inseamOutseamAllowance: 0
      }
    })
  );

  assert.equal(recommendation.available, true);
  assert.match(recommendation.targetSourceNote, /saved jacket and trouser measurements/i);
  assert.ok(recommendation.assessments.some((assessment) => assessment.garment === "jacket"));
  assert.ok(recommendation.assessments.some((assessment) => assessment.garment === "trousers"));
});

test("waistcoat listing can fall back to jacket-derived waistcoat targets", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "waistcoat",
      waistcoatMeasurements: {
        chest: 21.5,
        waist: 20,
        shoulders: 13,
        bodyLength: 23.25
      },
      waistcoatSpecs: null,
      jacketMeasurements: null
    })
  );

  assert.equal(recommendation.available, true);
  assert.equal(recommendation.targetSource, "jacket_fallback_adjusted");
  assert.equal(recommendation.confidence, "medium");
  assert.match(recommendation.targetSourceNote, /saved jacket measurements/i);
});

test("three-piece suit can impute waistcoat targets from saved jacket measurements", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    },
    trouserMeasurements: {
      waist: 17.5,
      hips: 22,
      inseam: 31,
      outseam: 41,
      opening: 10,
      waistAllowance: 0,
      inseamOutseamAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "three_piece_suit",
      waistcoatMeasurements: {
        chest: 21,
        waist: 19.75,
        shoulders: 13,
        bodyLength: 23.25
      },
      waistcoatSpecs: null,
      trouserMeasurements: {
        waist: 17.5,
        hips: 22,
        inseam: 31,
        outseam: 41,
        opening: 10,
        waistAllowance: 0,
        inseamOutseamAllowance: 0
      }
    })
  );

  assert.equal(recommendation.available, true);
  assert.equal(recommendation.confidence, "medium");
  assert.equal(recommendation.targetSource, "jacket_fallback_adjusted");
  assert.match(recommendation.targetSourceNote, /saved jacket and trouser measurements/i);
  assert.match(recommendation.targetSourceNote, /waistcoat guidance adapted from your saved jacket measurements/i);
  assert.ok(recommendation.assessments.some((assessment) => assessment.garment === "waistcoat"));
});

test("listing outside ideal but inside acceptable range stays workable", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 22.75,
        waist: 20,
        shoulders: 18,
        bodyLength: 30,
        sleeveLength: 25,
        sleeveLengthAllowance: 0
      }
    })
  );
  const chest = recommendation.assessments.find((assessment) => assessment.measurement === "chest");

  assert.equal(chest?.rangePosition, "acceptable");
  assert.ok(recommendation.score < 100);
  assert.notEqual(recommendation.status, "not_recommended");
});

test("listing outside acceptable range is scored as risky or worse", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 26,
        waist: 22,
        shoulders: 19.2,
        bodyLength: 32.5,
        sleeveLength: 27,
        sleeveLengthAllowance: 0
      }
    })
  );
  const chest = recommendation.assessments.find((assessment) => assessment.measurement === "chest");

  assert.equal(chest?.rangePosition, "outside_acceptable");
  assert.ok(["risky_but_possible", "not_recommended"].includes(recommendation.status));
});

test("coat listing uses jacket fallback with outerwear ease adjustment", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 19.5,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "coat",
      jacketMeasurements: {
        chest: 23.25,
        waist: 20.5,
        shoulders: 18.25,
        bodyLength: 32.25,
        sleeveLength: 25.25,
        sleeveLengthAllowance: 0
      }
    })
  );

  assert.equal(recommendation.targetSource, "jacket_fallback_adjusted");
  assert.equal(recommendation.confidence, "medium");
  assert.match(recommendation.summary, /saved jacket measurements/i);
});

test("sweater fallback is more forgiving than shirt fallback from the same jacket profile", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 19.5,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const sweater = getFitRecommendation(
    profile,
    makeListing({
      category: "sweater",
      jacketMeasurements: {
        chest: 24,
        waist: 21.5,
        shoulders: 18.2,
        bodyLength: 29.75,
        sleeveLength: 25.5,
        sleeveLengthAllowance: 0
      }
    })
  );
  const shirt = getFitRecommendation(
    profile,
    makeListing({
      category: "shirt",
      jacketMeasurements: {
        chest: 24,
        waist: 21.5,
        shoulders: 18.2,
        bodyLength: 30.5,
        sleeveLength: 25.5,
        sleeveLengthAllowance: 0
      }
    })
  );

  assert.ok(sweater.score > shirt.score);
});

test("matrix jacket sleeve pricing treats shortening and allowance-backed lengthening in the same easy band", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const shorten = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 22,
        waist: 20,
        shoulders: 18,
        bodyLength: 30,
        sleeveLength: 26.5,
        sleeveLengthAllowance: 0
      }
    })
  ).alterationEstimate;
  const lengthen = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 22,
        waist: 20,
        shoulders: 18,
        bodyLength: 30,
        sleeveLength: 24,
        sleeveLengthAllowance: 1
      }
    })
  ).alterationEstimate;

  const shortenAction = shorten?.actions.find((action) => action.type === "shorten_sleeves");
  const lengthenAction = lengthen?.actions.find((action) => action.type === "lengthen_sleeves");

  assert.equal(shortenAction?.feasibility, "easy");
  assert.equal(lengthenAction?.feasibility, "easy");
  assert.equal(shortenAction?.estimatedCost, 45);
  assert.equal(lengthenAction?.estimatedCost, 45);
});

test("trouser hemming is easier than lengthening without allowance", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 18,
      waistAllowance: 0,
      hips: 21,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const hem = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 18,
        waistAllowance: 0,
        hips: 21,
        inseam: 32.5,
        inseamOutseamAllowance: 0,
        outseam: 42.5,
        opening: 8.5
      }
    })
  ).alterationEstimate;
  const lengthen = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 18,
        waistAllowance: 0,
        hips: 21,
        inseam: 30,
        inseamOutseamAllowance: 0,
        outseam: 40,
        opening: 8.5
      }
    })
  ).alterationEstimate;

  const hemAction = hem?.actions.find((action) => action.type === "hem_trousers");
  const lengthenAction = lengthen?.actions.find((action) => action.type === "lengthen_trousers");

  assert.equal(hemAction?.feasibility, "easy");
  assert.equal(lengthenAction?.feasibility, "not_realistic");
});

test("waist let-out is downgraded when allowance is missing", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 18,
      waistAllowance: 0,
      hips: 21,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 16.75,
        waistAllowance: 0,
        hips: 21,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );
  const action = recommendation.alterationEstimate?.actions.find((entry) => entry.type === "let_out_waist");

  assert.equal(action?.feasibility, "not_realistic");
  assert.equal(action?.estimatedCost, null);
});

test("shoulder problems are treated as structural and not realistic", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 22,
        waist: 20,
        shoulders: 16.25,
        bodyLength: 30,
        sleeveLength: 25,
        sleeveLengthAllowance: 0
      }
    })
  );

  assert.equal(recommendation.status, "not_recommended");
  assert.match(recommendation.hardStopReasons[0] ?? "", /shoulders/i);
});

test("chest too small is not presented as a normal alteration", () => {
  const profile = makeProfile({
    jacketMeasurements: {
      chest: 22,
      waist: 20,
      shoulders: 18,
      bodyLength: 30,
      sleeveLength: 25,
      sleeveLengthAllowance: 0
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      jacketMeasurements: {
        chest: 18.5,
        waist: 20,
        shoulders: 18,
        bodyLength: 30,
        sleeveLength: 25,
        sleeveLengthAllowance: 0
      }
    })
  );
  const action = recommendation.alterationEstimate?.actions.find((entry) => entry.type === "adjust_chest");

  assert.equal(action?.feasibility, "not_realistic");
  assert.match(recommendation.hardStopReasons[0] ?? "", /chest/i);
});

test("allowance-backed strong matches still include tailoring actions and notes", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 18,
      waistAllowance: 0,
      hips: 21,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.25,
        waistAllowance: 1.5,
        hips: 21,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  assert.equal(recommendation.status, "strong_match");
  assert.ok((recommendation.alterationEstimate?.actions.length ?? 0) > 0);
  assert.match(recommendation.summary, /saved trouser measurements/i);
});

test("trouser waist inside the new ideal band needs no waist tailoring action", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 21,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.75,
        waistAllowance: 0,
        hips: 21,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  const waist = recommendation.assessments.find((assessment) => assessment.measurement === "waist");
  const waistAction = recommendation.alterationEstimate?.actions.find((action) => action.measurement === "waist");

  assert.equal(waist?.rangePosition, "ideal");
  assert.equal(waistAction, undefined);
});

test("trouser waist more than three inches beyond acceptable is not realistic", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 21,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 21,
        waistAllowance: 0,
        hips: 21,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  assert.equal(recommendation.status, "not_recommended");
  assert.match(recommendation.hardStopReasons[0] ?? "", /waist/i);
});

test("trouser hips inside the ideal band need no hip tailoring action", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 20,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.5,
        waistAllowance: 0,
        hips: 20.5,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  const hips = recommendation.assessments.find((assessment) => assessment.measurement === "hips");
  const hipAction = recommendation.alterationEstimate?.actions.find((action) => action.measurement === "hips");

  assert.equal(hips?.rangePosition, "ideal");
  assert.equal(hipAction, undefined);
});

test("trouser hips slightly large but inside acceptable are relatively straightforward", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 20,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.5,
        waistAllowance: 0,
        hips: 21.75,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  const action = recommendation.alterationEstimate?.actions.find((entry) => entry.type === "take_in_hips");
  assert.equal(action?.feasibility, "easy");
});

test("pleated trousers widen trouser hip tolerance by half an inch", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 22,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.5,
        waistAllowance: 0,
        hips: 21,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      },
      trouserSpecs: {
        cut: "straight",
        front: "pleated",
        formal: "na"
      }
    })
  );

  const hips = recommendation.assessments.find((assessment) => assessment.measurement === "hips");
  assert.notEqual(recommendation.status, "not_recommended");
  assert.equal(hips?.rangePosition, "ideal");
});

test("trouser hips beyond the difficult band are not realistic", () => {
  const profile = makeProfile({
    trouserMeasurements: {
      waist: 17.5,
      waistAllowance: 0,
      hips: 20,
      inseam: 31,
      inseamOutseamAllowance: 0,
      outseam: 41,
      opening: 8.5
    }
  });

  const recommendation = getFitRecommendation(
    profile,
    makeListing({
      category: "trousers",
      jacketMeasurements: null,
      trouserMeasurements: {
        waist: 17.5,
        waistAllowance: 0,
        hips: 23.25,
        inseam: 31,
        inseamOutseamAllowance: 0,
        outseam: 41,
        opening: 8.5
      }
    })
  );

  assert.equal(recommendation.status, "not_recommended");
  assert.match(recommendation.hardStopReasons[0] ?? "", /hips/i);
  assert.ok(
    recommendation.alterationEstimate?.actions.some(
      (action) => action.measurement === "hips" && action.feasibility === "not_realistic"
    )
  );
});
