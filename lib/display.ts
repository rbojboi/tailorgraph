const DISPLAY_ALIASES: Record<string, string> = {
  beige_tan: "Beige/Tan",
  gray_charcoal: "Gray/Charcoal",
  purple_violet: "Purple/Violet",
  white_cream: "White/Cream",
  unknown: "Other"
};

export function formatDisplayValue(value: string) {
  if (!value) {
    return "";
  }

  if (DISPLAY_ALIASES[value]) {
    return DISPLAY_ALIASES[value];
  }

  if (value === "na") {
    return "N/A";
  }

  if (value === "used_excellent") {
    return "Used - Excellent";
  }

  if (value === "used_very_good") {
    return "Used - Very Good";
  }

  if (value === "used_good") {
    return "Used - Good";
  }

  if (value === "used_fair") {
    return "Used - Fair";
  }

  if (value === "used_poor") {
    return "Used - Poor";
  }

  if (value === "dominican_republic") {
    return "Dominican Rep.";
  }

  if (value === "south_korea") {
    return "Rep. of Korea";
  }

  if (value === "pique") {
    return "Piqué";
  }

  return value
    .split("_")
    .map((part) => {
      if (!part) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function formatSizeLabel(value: string) {
  if (!value) {
    return "";
  }

  return value.replace(/[X\u00d7]/g, "x");
}

export function formatListingSizeLabel(value: string, category: string) {
  const formattedSize = formatSizeLabel(value);
  const formattedCategory = formatDisplayValue(category);
  if (!formattedSize || !formattedCategory) {
    return formattedSize;
  }

  return formattedSize.replace(new RegExp(`\\s+${formattedCategory}$`, "i"), "");
}

export function formatEraLabel(value: string) {
  switch (value) {
    case "modern":
      return "Contemporary (~ post-2000)";
    case "vintage_1970_2000":
      return "Newer Vintage (~ 1970-2000)";
    case "vintage_1940_1970":
      return "Older Vintage (~ 1940-1970)";
    case "vintage_pre_1940":
      return "Antique (~ pre-1940)";
    default:
      return formatDisplayValue(value);
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
