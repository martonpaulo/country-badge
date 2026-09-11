const flagCache = new Map();

function assertFlagSvg(svgText, countryCode) {
  if (typeof svgText !== "string" || !/<svg[\s>]/i.test(svgText)) {
    throw new Error(`The flag for ${countryCode} returned malformed SVG.`);
  }
}

export async function fetchFlagSvg({
  countryCode,
  flagUrl,
  signal,
  fetcher = fetch,
}) {
  if (!countryCode || !flagUrl) {
    throw new Error("The selected country does not include a supported flag.");
  }

  const cached = flagCache.get(countryCode);

  if (cached) {
    return cached;
  }

  let response;

  try {
    response = await fetcher(flagUrl, {
      signal,
      cache: "force-cache",
      headers: {
        Accept: "image/svg+xml",
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      `The flag could not be loaded for ${countryCode}. Check the connection and try again.`,
    );
  }

  if (!response.ok) {
    throw new Error(`The flag is unavailable for ${countryCode}.`);
  }

  const svgText = await response.text();
  assertFlagSvg(svgText, countryCode);
  flagCache.set(countryCode, svgText);

  return svgText;
}

export function loadSvgImage(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], {
      type: "image/svg+xml",
    });

    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      cleanup();
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("The flag image could not be processed."));
    };

    image.src = objectUrl;
  });
}
