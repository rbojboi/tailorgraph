export const tailoredSizeOptions: Array<[string, string]> = [
  ["34S", "34S"],
  ["34R", "34R"],
  ["34L", "34L"],
  ["36S", "36S"],
  ["36R", "36R"],
  ["36L", "36L"],
  ["38S", "38S"],
  ["38R", "38R"],
  ["38L", "38L"],
  ["40S", "40S"],
  ["40R", "40R"],
  ["40L", "40L"],
  ["42S", "42S"],
  ["42R", "42R"],
  ["42L", "42L"],
  ["44S", "44S"],
  ["44R", "44R"],
  ["44L", "44L"],
  ["46S", "46S"],
  ["46R", "46R"],
  ["46L", "46L"],
  ["48S", "48S"],
  ["48R", "48R"],
  ["48L", "48L"],
  ["50S", "50S"],
  ["50R", "50R"],
  ["50L", "50L"],
  ["52S", "52S"],
  ["52R", "52R"],
  ["52L", "52L"],
  ["54S", "54S"],
  ["54R", "54R"],
  ["54L", "54L"],
  ["Other", "Other"],
  ["N/A", "N/A"]
];

export const trouserWaistSizeOptions: Array<[string, string]> = Array.from({ length: 21 }, (_, index) => {
  const size = String(26 + index);
  return [size, size] as [string, string];
}).concat([["Other", "Other"], ["N/A", "N/A"]]);

export const trouserLengthSizeOptions: Array<[string, string]> = [
  ["26", "26"],
  ["27", "27"],
  ["28", "28"],
  ["29", "29"],
  ["30", "30"],
  ["31", "31"],
  ["32", "32"],
  ["33", "33"],
  ["34", "34"],
  ["35", "35"],
  ["36", "36"],
  ["37", "37"],
  ["38", "38"],
  ["39", "39"],
  ["40", "40"],
  ["Other", "Other"],
  ["N/A", "N/A"]
];

export const shirtNeckSizeOptions: Array<[string, string]> = [
  ["14", "14"],
  ["14.5", "14.5"],
  ["15", "15"],
  ["15.5", "15.5"],
  ["16", "16"],
  ["16.5", "16.5"],
  ["17", "17"],
  ["17.5", "17.5"],
  ["18", "18"],
  ["18.5", "18.5"],
  ["19", "19"],
  ["19.5", "19.5"],
  ["Other", "Other"],
  ["N/A", "N/A"]
];

export const shirtLengthSizeOptions: Array<[string, string]> = [
  ["26", "26"],
  ["27", "27"],
  ["28", "28"],
  ["29", "29"],
  ["30", "30"],
  ["31", "31"],
  ["32", "32"],
  ["33", "33"],
  ["34", "34"],
  ["35", "35"],
  ["36", "36"],
  ["37", "37"],
  ["38", "38"],
  ["39", "39"],
  ["40", "40"],
  ["Other", "Other"],
  ["N/A", "N/A"]
];

export function isTailoredSizeCategory(category: string) {
  return ["jacket", "waistcoat", "two_piece_suit", "three_piece_suit", "coat", "sweater"].includes(category);
}

export function isTrouserSizeCategory(category: string) {
  return category === "trousers";
}

export function isShirtSizeCategory(category: string) {
  return category === "shirt";
}

export function hasSuitTrousers(category: string) {
  return category === "two_piece_suit" || category === "three_piece_suit";
}

export function getPrimarySizeOptions(category: string) {
  return isTailoredSizeCategory(category) ? tailoredSizeOptions : [];
}

export function combineSplitSize(partOne: string, partTwo: string) {
  if (!partOne && !partTwo) {
    return "";
  }

  if (partOne === "N/A" || partTwo === "N/A") {
    return "N/A";
  }

  if (!partOne) {
    return "";
  }

  return partTwo ? `${partOne}x${partTwo}` : partOne;
}

export function splitCombinedSize(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return { partOne: "", partTwo: "" };
  }

  if (normalized.toUpperCase() === "N/A") {
    return { partOne: "N/A", partTwo: "N/A" };
  }

  const [partOne = "", partTwo = ""] = normalized.split("x");
  return { partOne, partTwo };
}

export function getMarketplaceSizeFilterConfig(categories: string[]) {
  if (categories.length === 0) {
    return null;
  }

  if (categories.every((category) => isTailoredSizeCategory(category))) {
    return {
      kind: "single" as const,
      label: "Size",
      allLabel: "All Sizes",
      options: tailoredSizeOptions
    };
  }

  if (categories.every((category) => isTrouserSizeCategory(category))) {
    return {
      kind: "split" as const,
      firstLabel: "Waist Size",
      secondLabel: "Length Size",
      firstOptions: trouserWaistSizeOptions,
      secondOptions: trouserLengthSizeOptions
    };
  }

  if (categories.every((category) => isShirtSizeCategory(category))) {
    return {
      kind: "split" as const,
      firstLabel: "Neck Size",
      secondLabel: "Length Size",
      firstOptions: shirtNeckSizeOptions,
      secondOptions: shirtLengthSizeOptions
    };
  }

  return null;
}
