import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createCountryCatalog,
  getCountryByCode,
  normalizeSearch,
  searchCountries,
} from "../../site/js/countries.js";

// An excerpt of the pinned `world-countries` list (see tests/fixtures/README.md), so the unit
// suite needs no network. The live source stays covered by the opt-in browser test.
const payload = JSON.parse(
  await readFile(
    new URL("../fixtures/countries.json", import.meta.url),
    "utf8",
  ),
);
const catalog = createCountryCatalog(payload, { minCountries: 1 });

test("normalizes search text case and diacritics", () => {
  assert.equal(normalizeSearch("  Curacao  "), "curacao");
  assert.equal(normalizeSearch("Cura\u00E7ao"), "curacao");
  assert.equal(normalizeSearch("COTE D'IVOIRE"), "cote divoire");
});

test("searches countries by English names and ISO alpha-2 codes", () => {
  assert.equal(searchCountries(catalog, "Paraguay")[0]?.code, "PY");
  assert.equal(searchCountries(catalog, "PY")[0]?.code, "PY");
  assert.equal(searchCountries(catalog, "Brazil")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "BR")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "Spain")[0]?.code, "ES");
  assert.equal(searchCountries(catalog, "ES")[0]?.code, "ES");
});

test("ranks exact matches before substring matches", () => {
  const results = searchCountries(catalog, "Guinea");

  assert.equal(results[0]?.name, "Guinea");
  assert.equal(
    results.some((country) => country.name === "Equatorial Guinea"),
    true,
  );
});

test("search ignores case and diacritics", () => {
  assert.equal(searchCountries(catalog, "bRaZiL")[0]?.code, "BR");
  assert.equal(searchCountries(catalog, "curacao")[0]?.code, "CW");
});

test("no-results queries do not become valid countries", () => {
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
