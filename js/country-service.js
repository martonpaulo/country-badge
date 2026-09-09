import {
  createCountryCatalog,
  validateCountryCatalog
} from "./countries.js";

export const COUNTRY_DATA_URL =
  "https://cdn.jsdelivr.net/npm/world-countries@5.1.0/dist/countries.json";

// The cache holds the normalized catalog the application consumes, so its key
// is versioned by the shape and the record carries the pinned source: a schema
// or data-source change invalidates every older entry.
export const CATALOG_CACHE_KEY =
  "country-badge-generator.country-catalog.v2";

const LEGACY_PAYLOAD_CACHE_KEY =
  "country-badge-generator.country-data.v1";

const CATALOG_SCHEMA_VERSION = 2;

function getStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// Every storage operation is independently guarded, so an unavailable or
// rejecting session storage never changes what a request reports.
function readStoredValue(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStoredValue(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Session cache is an optimization; failure should not block use.
  }
}

function removeStoredValue(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // A cache that cannot be cleared is simply ignored on the next read.
  }
}

function readCachedCatalog(storage) {
  const raw = readStoredValue(storage, CATALOG_CACHE_KEY);

  if (!raw) {
    return null;
  }

  let record;

  try {
    record = JSON.parse(raw);
  } catch {
    removeStoredValue(storage, CATALOG_CACHE_KEY);
    return null;
  }

  if (
    record?.schemaVersion !== CATALOG_SCHEMA_VERSION ||
    record?.source !== COUNTRY_DATA_URL
  ) {
    removeStoredValue(storage, CATALOG_CACHE_KEY);
    return null;
  }

  const catalog = validateCountryCatalog(
    record.countries
  );

  if (!catalog) {
    removeStoredValue(storage, CATALOG_CACHE_KEY);
    return null;
  }

  return catalog;
}

function writeCachedCatalog(storage, catalog) {
  removeStoredValue(storage, LEGACY_PAYLOAD_CACHE_KEY);
  writeStoredValue(
    storage,
    CATALOG_CACHE_KEY,
    JSON.stringify({
      schemaVersion: CATALOG_SCHEMA_VERSION,
      source: COUNTRY_DATA_URL,
      countries: catalog
    })
  );
}

export async function fetchCountryCatalog({
  signal,
  fetcher = fetch,
  storage = getStorage()
} = {}) {
  const cachedCatalog = readCachedCatalog(storage);

  if (cachedCatalog) {
    return cachedCatalog;
  }

  let response;

  try {
    response = await fetcher(COUNTRY_DATA_URL, {
      signal,
      cache: "force-cache",
      headers: {
        Accept: "application/json"
      }
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "The country list could not be loaded. Check the connection and try again."
    );
  }

  if (!response.ok) {
    throw new Error(
      "The country list is temporarily unavailable."
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The country list returned invalid JSON."
    );
  }

  const catalog = createCountryCatalog(payload);

  writeCachedCatalog(storage, catalog);

  return catalog;
}
