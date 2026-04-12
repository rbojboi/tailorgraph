type ZippopotamPlace = {
  "place name": string;
  "state abbreviation": string;
};

type ZippopotamResponse = {
  places?: ZippopotamPlace[];
};

function normalizeZipCode(zipCode: string) {
  const digitsOnly = zipCode.replace(/\D/g, "");
  return digitsOnly.length === 5 ? digitsOnly : null;
}

export function sanitizeZipCode(zipCode: string) {
  return normalizeZipCode(zipCode);
}

export async function resolveUsZipCode(zipCode: string): Promise<{ zipCode: string; location: string } | null> {
  const normalizedZipCode = normalizeZipCode(zipCode);

  if (!normalizedZipCode) {
    return null;
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/US/${normalizedZipCode}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ZippopotamResponse;
    const place = payload.places?.[0];

    if (!place?.["place name"] || !place["state abbreviation"]) {
      return null;
    }

    return {
      zipCode: normalizedZipCode,
      location: `${place["place name"]}, ${place["state abbreviation"]}`
    };
  } catch {
    return null;
  }
}
