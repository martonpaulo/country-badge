import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_CACHE_KEY,
  COUNTRY_DATA_URL,
  fetchCountryCatalog
} from "../../js/country-service.js";

import {
  fetchFlagSvg
} from "../../js/flag-service.js";

function createResponse({
  ok = true,
  status = 200,
  json,
  text
} = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text
  };
}

test("country service reports network and CORS-style failures", async () => {
  await assert.rejects(
    () => fetchCountryCatalog({
      fetcher: async () => {
        throw new TypeError("Failed to fetch");
      },
      storage: null
    }),
    /country list could not be loaded/
  );
});

test("country service rejects unavailable, invalid, and malformed payloads", async () => {
  await assert.rejects(
    () => fetchCountryCatalog({
      fetcher: async () => createResponse({ ok: false, status: 503 }),
      storage: null
    }),
    /temporarily unavailable/
  );

  await assert.rejects(
    () => fetchCountryCatalog({
      fetcher: async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        }
      }),
      storage: null
    }),
    /invalid JSON/
  );

  await assert.rejects(
    () => fetchCountryCatalog({
      fetcher: async () => createResponse({ json: { invalid: true } }),
      storage: null
    }),
    /unsupported format/
  );
});

test("flag service reports unsupported and unavailable flags", async () => {
  await assert.rejects(
    () => fetchFlagSvg({
      countryCode: "",
      flagUrl: ""
    }),
    /supported flag/
  );

  await assert.rejects(
    () => fetchFlagSvg({
      countryCode: "BR",
      flagUrl: "https://flagcdn.com/br.svg",
      fetcher: async () => createResponse({ ok: false, status: 404 })
    }),
    /unavailable/
  );
});

test("flag service rejects network failures and malformed SVG", async () => {
  await assert.rejects(
    () => fetchFlagSvg({
      countryCode: "PY",
      flagUrl: "https://flagcdn.com/py.svg",
      fetcher: async () => {
        throw new TypeError("Failed to fetch");
      }
    }),
    /could not be loaded/
  );

  await assert.rejects(
    () => fetchFlagSvg({
      countryCode: "ES",
      flagUrl: "https://flagcdn.com/es.svg",
      fetcher: async () => createResponse({
        text: "not svg"
      })
    }),
    /malformed SVG/
  );
});

// Minimal session-storage stand-in. Each operation can be made to throw so the
// service can be proven to keep working when storage is hostile.
function createStorage({ initial = {}, failOn = [] } = {}) {
  const entries = new Map(Object.entries(initial));
  const calls = { getItem: 0, setItem: 0, removeItem: 0 };

  const guard = operation => {
    calls[operation] += 1;

    if (failOn.includes(operation)) {
      throw new Error(`${operation} is unavailable`);
    }
  };

  return {
    entries,
    calls,
    getItem(key) {
      guard("getItem");
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      guard("setItem");
      entries.set(key, value);
    },
    removeItem(key) {
      guard("removeItem");
      entries.delete(key);
    }
  };
}

function createSourcePayload(count = 120) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const payload = [];

  for (const first of letters) {
    for (const second of letters) {
      if (payload.length >= count) {
        return payload;
      }

      const code = `${first}${second}`;

      payload.push({
        cca2: code,
        cca3: `${code}X`,
        population: payload.length + 1,
        altSpellings: [code],
        name: {
          common: `Country ${code}`,
          official: `Republic of ${code}`
        }
      });
    }
  }

  return payload;
}

function createRemoteFetcher(payload) {
  const calls = { count: 0 };

  return {
    calls,
    fetcher: async () => {
      calls.count += 1;
      return createResponse({ json: payload });
    }
  };
}

test("a successful remote load caches the normalized catalog, not the source payload", async () => {
  const storage = createStorage();
  const payload = createSourcePayload();
  const remote = createRemoteFetcher(payload);

  const catalog = await fetchCountryCatalog({
    fetcher: remote.fetcher,
    storage
  });

  const cached = JSON.parse(
    storage.entries.get(CATALOG_CACHE_KEY)
  );

  assert.equal(remote.calls.count, 1);
  assert.equal(storage.entries.size, 1);
  assert.equal(cached.source, COUNTRY_DATA_URL);
  assert.deepEqual(cached.countries, catalog);
  assert.equal(cached.countries[0].searchTerms.length > 0, true);

  // The record holds only what the application consumes; nothing from the
  // source shape survives into the cache.
  for (const country of cached.countries) {
    assert.deepEqual(Object.keys(country).sort(), [
      "altSpellings",
      "code",
      "emoji",
      "flagUrl",
      "name",
      "officialName",
      "population",
      "searchTerms"
    ]);
  }
});

test("a valid cache hit is consumed without contacting the source", async () => {
  const storage = createStorage();
  const payload = createSourcePayload();
  const first = createRemoteFetcher(payload);

  const remoteCatalog = await fetchCountryCatalog({
    fetcher: first.fetcher,
    storage
  });

  const second = createRemoteFetcher(payload);
  const cachedCatalog = await fetchCountryCatalog({
    fetcher: second.fetcher,
    storage
  });

  assert.equal(second.calls.count, 0);
  assert.deepEqual(cachedCatalog, remoteCatalog);
});

test("corrupt, partial, and stale cached records fall back to the remote source", async () => {
  const payload = createSourcePayload();
  const valid = await fetchCountryCatalog({
    fetcher: createRemoteFetcher(payload).fetcher,
    storage: createStorage()
  });

  const records = {
    "unparseable JSON": "{",
    "a stale schema version": JSON.stringify({
      schemaVersion: 1,
      source: COUNTRY_DATA_URL,
      countries: valid
    }),
    "another data source": JSON.stringify({
      schemaVersion: 2,
      source: "https://example.invalid/countries.json",
      countries: valid
    }),
    "too few countries": JSON.stringify({
      schemaVersion: 2,
      source: COUNTRY_DATA_URL,
      countries: valid.slice(0, 20)
    }),
    "a record missing search terms": JSON.stringify({
      schemaVersion: 2,
      source: COUNTRY_DATA_URL,
      countries: valid.map((country, index) =>
        index === 3 ? { ...country, searchTerms: [] } : country
      )
    }),
    "a duplicated country code": JSON.stringify({
      schemaVersion: 2,
      source: COUNTRY_DATA_URL,
      countries: valid.map((country, index) =>
        index === 4 ? { ...country, code: valid[0].code } : country
      )
    })
  };

  for (const [description, value] of Object.entries(records)) {
    const storage = createStorage({
      initial: { [CATALOG_CACHE_KEY]: value }
    });

    const remote = createRemoteFetcher(payload);
    const catalog = await fetchCountryCatalog({
      fetcher: remote.fetcher,
      storage
    });

    assert.equal(
      remote.calls.count,
      1,
      `${description} must trigger the remote path`
    );
    assert.deepEqual(catalog, valid, description);
  }
});

test("storage failures never change what a request reports", async () => {
  const payload = createSourcePayload();
  const valid = await fetchCountryCatalog({
    fetcher: createRemoteFetcher(payload).fetcher,
    storage: createStorage()
  });

  for (const failure of ["getItem", "setItem", "removeItem"]) {
    const storage = createStorage({
      initial: { [CATALOG_CACHE_KEY]: "{" },
      failOn: [failure]
    });

    const remote = createRemoteFetcher(payload);
    const catalog = await fetchCountryCatalog({
      fetcher: remote.fetcher,
      storage
    });

    assert.deepEqual(catalog, valid, failure);
    assert.equal(remote.calls.count, 1, failure);
  }

  const storage = createStorage({ failOn: ["setItem"] });

  await assert.rejects(
    () => fetchCountryCatalog({
      fetcher: async () => createResponse({ ok: false, status: 503 }),
      storage
    }),
    /temporarily unavailable/
  );
});

test("a legacy raw-payload cache entry is discarded on the next successful load", async () => {
  const storage = createStorage({
    initial: {
      "country-badge-generator.country-data.v1": JSON.stringify(
        createSourcePayload()
      )
    }
  });

  await fetchCountryCatalog({
    fetcher: createRemoteFetcher(createSourcePayload()).fetcher,
    storage
  });

  assert.equal(
    storage.entries.has("country-badge-generator.country-data.v1"),
    false
  );
  assert.equal(storage.entries.has(CATALOG_CACHE_KEY), true);
});
