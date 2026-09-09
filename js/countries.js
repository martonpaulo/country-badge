const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true
});

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function countryCodeToEmoji(code) {
  return [...code]
    .map(character =>
      String.fromCodePoint(
        127397 + character.charCodeAt(0)
      )
    )
    .join("");
}

function getEnglishDemonym(country) {
  const demonyms = country?.demonyms?.eng;

  return [
    demonyms?.f,
    demonyms?.m
  ].filter(Boolean);
}

function getNativeNames(country) {
  return Object.values(
    country?.name?.native ?? {}
  ).flatMap(name => [
    name?.common,
    name?.official
  ]);
}

function getTranslationNames(country) {
  return Object.values(
    country?.translations ?? {}
  ).flatMap(name => [
    name?.common,
    name?.official
  ]);
}

function createSearchTerms(country) {
  return [
    country.name.common,
    country.name.official,
    country.cca2,
    country.cca3,
    country.cioc,
    ...(country.altSpellings ?? []),
    ...getEnglishDemonym(country),
    ...getNativeNames(country),
    ...getTranslationNames(country)
  ]
    .map(normalizeSearch)
    .filter(Boolean);
}

function normalizeCountry(country) {
  const code = String(country?.cca2 ?? "")
    .trim()
    .toUpperCase();

  const commonName =
    String(country?.name?.common ?? "").trim();

  if (!/^[A-Z]{2}$/.test(code) || !commonName) {
    return null;
  }

  const officialName =
    String(country?.name?.official ?? "").trim();

  return {
    code,
    emoji: countryCodeToEmoji(code),
    name: commonName,
    officialName,
    population:
      Number.isFinite(country.population)
        ? country.population
        : 0,
    altSpellings: Array.isArray(country.altSpellings)
      ? country.altSpellings.filter(Boolean)
      : [],
    flagUrl: `https://flagcdn.com/${code.toLowerCase()}.svg`,
    searchTerms: [...new Set(createSearchTerms(country))]
  };
}

export function createCountryCatalog(
  payload,
  { minCountries = 100 } = {}
) {
  if (!Array.isArray(payload)) {
    throw new Error(
      "The country list returned an unsupported format."
    );
  }

  const countries = payload
    .map(normalizeCountry)
    .filter(Boolean)
    .sort((first, second) =>
      collator.compare(first.name, second.name)
    );

  if (countries.length < minCountries) {
    throw new Error(
      "The country list did not include enough supported countries."
    );
  }

  return countries;
}

// The session cache stores the normalized catalog, so a hit must be validated
// as the consumable shape instead of being rebuilt from source records. A
// record that fails any check is rejected as a whole, so a structurally
// plausible but incomplete cache falls back to the remote source.
function isConsumableCountry(country) {
  return (
    Boolean(country) &&
    typeof country.code === "string" &&
    /^[A-Z]{2}$/.test(country.code) &&
    typeof country.emoji === "string" &&
    country.emoji.length > 0 &&
    typeof country.name === "string" &&
    country.name.length > 0 &&
    typeof country.officialName === "string" &&
    Number.isFinite(country.population) &&
    Array.isArray(country.altSpellings) &&
    country.altSpellings.every(
      spelling => typeof spelling === "string"
    ) &&
    typeof country.flagUrl === "string" &&
    country.flagUrl.startsWith("https://") &&
    Array.isArray(country.searchTerms) &&
    country.searchTerms.length > 0 &&
    country.searchTerms.every(
      term => typeof term === "string" && term.length > 0
    )
  );
}

export function validateCountryCatalog(
  countries,
  { minCountries = 100 } = {}
) {
  if (
    !Array.isArray(countries) ||
    countries.length < minCountries
  ) {
    return null;
  }

  const codes = new Set();

  for (const country of countries) {
    if (
      !isConsumableCountry(country) ||
      codes.has(country.code)
    ) {
      return null;
    }

    codes.add(country.code);
  }

  return countries;
}

function scoreCountry(country, normalizedQuery) {
  const normalizedCode =
    country.code.toLowerCase();

  if (normalizedCode === normalizedQuery) {
    return 0;
  }

  let bestScore = Number.POSITIVE_INFINITY;

  for (const term of country.searchTerms) {
    if (term === normalizedQuery) {
      bestScore = Math.min(bestScore, 1);
    } else if (term.startsWith(normalizedQuery)) {
      bestScore = Math.min(bestScore, 2);
    } else if (
      term
        .split(/\s+/)
        .some(word => word.startsWith(normalizedQuery))
    ) {
      bestScore = Math.min(bestScore, 3);
    } else if (term.includes(normalizedQuery)) {
      bestScore = Math.min(bestScore, 4);
    }
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    bestScore = Math.min(bestScore, 5);
  }

  return bestScore;
}

export function searchCountries(
  catalog,
  query,
  limit = 8
) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return [];
  }

  return catalog
    .map(country => ({
      country,
      score: scoreCountry(
        country,
        normalizedQuery
      )
    }))
    .filter(result =>
      Number.isFinite(result.score)
    )
    .sort((first, second) =>
      first.score - second.score ||
      collator.compare(
        first.country.name,
        second.country.name
      )
    )
    .slice(0, limit)
    .map(result => result.country);
}

export function getCountryByCode(catalog, code) {
  const normalizedCode = String(code ?? "")
    .trim()
    .toUpperCase();

  return (
    catalog.find(country =>
      country.code === normalizedCode
    ) ?? null
  );
}

export function getDefaultSuggestions(
  catalog,
  recentCodes = [],
  limit = 8
) {
  const seen = new Set();
  const suggestions = [];

  for (const code of recentCodes) {
    const country = getCountryByCode(catalog, code);

    if (country && !seen.has(country.code)) {
      suggestions.push(country);
      seen.add(country.code);
    }

    if (suggestions.length === limit) {
      return suggestions;
    }
  }

  const defaultPool = [...catalog].sort(
    (first, second) =>
      second.population - first.population ||
      collator.compare(first.name, second.name)
  );

  for (const country of defaultPool) {
    if (!seen.has(country.code)) {
      suggestions.push(country);
      seen.add(country.code);
    }

    if (suggestions.length === limit) {
      break;
    }
  }

  return suggestions;
}
