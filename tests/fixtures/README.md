# Test fixtures

`countries.json` is an excerpt of the country list the site reads, [`world-countries`](https://cdn.jsdelivr.net/npm/world-countries@5.1.0/dist/countries.json) 5.1.0: eight records (BR, CW, ES, GN, GQ, GW, PG, PY) and only the fields the site reads (`cca2`, `cca3`, `cioc`, `name`, `altSpellings`, `demonyms`, `translations`). The unit tests rank real names against it, so they need no network.

The data is licensed under the [ODbL](https://cdn.jsdelivr.net/npm/world-countries@5.1.0/LICENSE), which keeps its own terms; this excerpt is a derived database under the same license. The live source is covered by the opt-in test in `tests/browser/app.spec.js`.
