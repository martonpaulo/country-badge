# Contributing to Country Badge

Thank you for taking the time. This is a small personal project, so the process is deliberately
light.

## Report a bug

Open an [issue](https://github.com/martonpaulo/country-badge/issues) and include what you did, what
you expected, what happened, and the browser you used. The fastest thing you can give is the
**country** and, for a palette complaint, the three colors you were offered.

Two things are usually not bugs here:

- **A color you would not have picked.** The palette is deterministic and curated — it selects
  catalog entries from what the flag contains, not the flag's own hex values. Say which curated
  color you expected instead.
- **Wrong or missing country data, or wrong flag artwork.** Both come from upstream sources
  (`world-countries` via jsDelivr, and FlagCDN). This app can fix how they are read and displayed;
  it cannot fix the source data.

The project has no account and no credential, so an issue should never contain one.

## Propose a change

Open an issue describing the problem before writing code, especially for anything that changes the
palette policy, the curated catalog, the export format, or the accessibility behavior of the
combobox. [`docs/product.md`](./docs/product.md) records the scope and the non-goals, and
[`AGENTS.md`](./AGENTS.md) records the working agreements the repository follows. The app is static
by contract: a proposal that needs a backend, a build step, an API key, or a runtime dependency is
out of scope.

## Branches, commits and pull requests

- The owner commits validated work directly to `main`. Outside contributors work on a branch and
  open a pull request.
- Commit and pull request subjects follow [Conventional Commits](https://www.conventionalcommits.org/)
  in English: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`,
  `test`.
- One concern per commit. A commit or pull request made for an issue **ends with the issue numbers**:
  `feat(palette): widen the green family (#12)`, `fix: keep the combobox focus ring (#12, #15)`.
- A pull request that closes issues starts its body with one `Closes #<n>` line per issue, and the
  title's numbers must name the same set. `.github/workflows/pr-conventions.yml` checks exactly this.
- No force pushes.

## Run the validation gate

```bash
npm ci
npx playwright install chromium
npm run test:unit      # what the Validate workflow runs
npm run test:browser   # what the Browser suite workflow runs
```

`npm test` runs both in that order. The browser suite targets the Playwright-owned Chromium for
Testing build and serves the checkout on a run-time port, so it needs the browser download once and
network access for uncached flags.

## Code of conduct

Be respectful and assume good faith. Behaviour that makes the project unpleasant for others is not
welcome, whatever its technical merit.
