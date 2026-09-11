import assert from "node:assert/strict";
import test from "node:test";

import {
  createCountryCatalog,
  getCountryByCode,
  normalizeSearch,
  searchCountries,
} from "../../js/countries.js";

import { COUNTRY_DATA_URL } from "../../js/country-service.js";

let catalogPromise;

async function getCatalog() {
  catalogPromise ??= fetch(COUNTRY_DATA_URL)
    .then((response) => {
      assert.equal(response.ok, true);
      return response.json();
    })
    .then((payload) => createCountryCatalog(payload));

  return catalogPromise;
}

test("normalizes search text case and diacritics", () => {
  assert.equal(normalizeSearch("  Curacao  "), "curacao");
  assert.equal(normalizeSearch("Cura\u00E7ao"), "curacao");
  assert.equal(normalizeSearch("COTE D'IVOIRE"), "cote divoire");
});

test("searches countries by English names and ISO alpha-2 codes", async () => {
  const catalog = await getCatalog();

  assert.equal(searchCountries(catalog, "Paraguay")[0]?.code, "PY");
  assert.equal(searchCountries(catalog, "PY")[0]?.code, "PY");
  assert.equal(searchCountries(catalog, "Brazil")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "BR")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "Spain")[0]?.code, "ES");
  assert.equal(searchCountries(catalog, "ES")[0]?.code, "ES");
});

test("ranks exact matches before substring matches", async () => {
  const catalog = await getCatalog();
  const results = searchCountries(catalog, "Guinea");

  assert.equal(results[0]?.name, "Guinea");
  assert.equal(
    results.some((country) => country.name === "Equatorial Guinea"),
    true,
  );
});

test("search ignores case and diacritics", async () => {
  const catalog = await getCatalog();

  assert.equal(searchCountries(catalog, "bRaZiL")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "curacao")[0]?.code, "CW");
});

test("no-results queries do not become valid countries", async () => {
  const catalog = await getCatalog();

  assert.deepEqual(searchCountries(catalog, "Atlantis"), []);
  assert.equal(getCountryByCode(catalog, "Atlantis"), null);
});

test("malformed country payloads fail validation", () => {
  assert.throws(
    () => createCountryCatalog({ BR: "Brazil" }),
    /unsupported format/,
  );

  assert.throws(
    () => createCountryCatalog([], { minCountries: 1 }),
    /enough supported countries/,
  );
});
