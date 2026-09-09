# Project Working Agreements

## Project identity and policy

- Project name: `country-badge-generator`
- Public name: `Country Badge Generator`
- Benefit-first description: Create downloadable SVG, PNG, and JPG country badges with three deterministic, flag-inspired backgrounds.
- Repository: `martonpaulo/country-badge-generator` (public)
- Public identifiers: repository slug `country-badge-generator`; the private npm package name is development metadata, not a published package.
- Landing page: `https://martonpaulo.com/country-badge-generator/`, hosted from `main:/` by GitHub Pages in this repository. The `github.io` address redirects here, so the canonical, `og:`/`twitter:` and sitemap references all use the custom domain.
- License: `MIT`
- Copyright: 2026 Marton Paulo
- Development language: English.
- Product copy: English only; there is no localization layer. English is the fallback language.
- Browser acceptance: Chromium only, using the Playwright-owned Chromium for Testing build. Do not use Brave as an acceptance browser. Gecko and WebKit are not supported acceptance targets.
- Branch policy: the owner and the owner's agents commit validated work directly to `main` in focused single-concern commits. Short-lived branches and pull requests remain available for work that benefits from review, and are required for any outside contributor.
- Commit policy: commit authorized work automatically when its required validation passes. Use Conventional Commits and keep each commit to one concern.
- Push policy: push explicitly authorized work automatically once its required validation passes. Never push unrelated work or an unvalidated commit.
- Product versioning: unversioned. `package.json` version `1.0.0` is non-public development metadata and changes only if an explicit release policy is introduced.
- Agent automation: `enabled`
- Implementation agent: `claude`
- Review agent: `codex`
- Orchestration agent: `codex`
- Merge policy: squash merge only. The pull request title and leading `Closes` block preserve the complete issue set.
- Commit subject: a commit made for an issue ends with `(#<issue number>)`.
- Delete branches after merge: enabled.
- Required review policy: none. The `main` branch ruleset was removed on 2026-09-09 by owner decision because a solo repository cannot satisfy a second-account approval. The complete unit and Chromium for Testing suites must pass locally before a commit. In CI the cheap Node suite (`validate`) and the expensive Chromium suite (`browser-suite`) are separate workflows, each triggered only by the paths it can observe.
- Release, signing, and secret-storage policy: GitHub Pages publishes the static site from `main`; this is not a user-visible versioned release. No signing identity or release secret applies. Repository and provider credentials stay only in their secure stores.
- Skills baseline revision: `18c3ac96955f83dfc985e180841c7896e23836da`
- Skills baseline applied: `2026-09-04`

Treat these values as stable project decisions. Change an established identifier, license, visibility, branch policy, versioning model, localization strategy, landing-page contract, automation decision, browser target, or release policy only through an explicit migration task.

## Instruction hierarchy and sources of truth

- Follow the direct task, the most specific scoped instructions, this file, and then general working agreements, in that order.
- Read applicable instructions before changing files.
- Code is evidence of current behavior. This file is normative for process. An approved specification is normative for desired behavior. Surface conflicts rather than silently choosing one source for everything.
- Keep one canonical owner for each rule. Secondary documents summarize or link instead of restating it.
- Do not turn analysis, research, planning, or a read-only audit into implementation without authorization.
- Ask only when a material decision cannot be resolved from trusted evidence.

## Existing project patterns

- Keep the app static: HTML, CSS, and native ES modules served directly from the repository root.
- Keep all local module and asset URLs relative so GitHub Pages works under the repository subpath.
- Keep external I/O in focused adapters such as `country-service.js` and `flag-service.js`; keep deterministic country and palette rules out of transport code.
- Keep `app.js` as the composition and DOM-event boundary. Move substantial pure policy or reusable service behavior behind a smaller module interface instead of adding more unrelated responsibility there.
- Surface recoverable failures through the existing field or global status elements. Do not hide a failure behind a success-shaped default.
- Coordinate replaceable async country work with cancellation and request identity so stale work never wins.
- Declare shared UI colors, radii, focus, and elevation decisions as CSS custom properties. Leave genuinely component-local values with their component.
- Keep exported SVG self-contained; PNG and JPG exports remain 1024 × 1024.
- Put pure logic and service contracts in Node tests. Put user flows, accessibility state, downloads, layout, and browser behavior in Playwright tests using Chromium for Testing.

When a change would break a recorded pattern or establish a new one, stop and ask first. Name the current pattern, the proposed replacement, and why the current pattern does not fit.

## Long-running operations

- Use bounded yields, timeouts, or status mechanisms and wait for observable progress rather than arbitrary sleeps.
- Keep the user informed at least once per minute during ongoing work.
- Inspect current output before interrupting or retrying. Do not rerun the same unchanged failure.
- Interrupt only on evidence of a stall, an expired deadline, or unjustified continued cost.
- Stop only processes started by the current task and identify them by captured process or session identity, never by a broad process-name pattern.

## Before editing

1. Check instructions, Git status, and the current branch.
2. Search for behavior, callers, tests, contracts, and nearby patterns.
3. Distinguish verified facts, reasonable inferences, and unknowns.
4. Define the source of truth and ownership before changing state.
5. Plan only when scope, risk, or the number of files justifies it.

## Scope, reuse, and implementation

- Keep changes scoped to the requested result. Do not mix unrelated cleanup, redesign, dependency updates, or future work.
- Preserve unrelated and uncommitted user changes.
- Reuse existing components, services, helpers, types, constants, tokens, and tests before creating another owner.
- Prefer the smallest correct, readable, reversible, and low-operational-cost solution.
- Maintain one owner for each rule, state, mapping, default, and copy value. Derive synchronized values instead of storing copies.
- Keep business rules out of presentation and external adapters when a domain owner exists.
- Do not add dependencies, services, layers, caches, observers, timers, polling, jobs, or infrastructure without a current requirement and explicit owner.
- Implement relevant errors, loading, empty, retry, accessibility, and regression coverage with the behavior.

## Data, security, and destructive operations

- Distinguish canonical data, reconstructible cache, transient state, local preferences, and durable intent.
- Validate external and persisted data at their boundaries. Never make a cache an independent source of truth.
- Keep credentials, tokens, keys, cookies, personal data, and environment values out of source, issues, logs, and generated artifacts.
- Inspect the exact payload before committing, pushing, publishing GitHub text, or uploading an artifact.
- Resolve exact targets before deletion or overwrite. Never use broad destructive Git or filesystem commands.
- Never force-push. Preserve third-party licenses, notices, and attribution.

## Product interface and accessibility

- Prefer native HTML controls and established platform behavior over custom semantics.
- Cover idle, loading, content, empty, error, retry, disabled, cancellation, and success states where the flow can reach them.
- Preserve keyboard navigation, focus, accessible names, live status, scalable text, contrast, touch behavior, reduced motion, and non-color cues.
- Keep user-facing copy concise and consistent with the English-only strategy.
- Keep expensive work out of input and render paths; measure before claiming or fixing a performance problem.

## Code, comments, and documentation

- Write code, comments, commits, filenames, tests, configuration, and documentation in English.
- Follow the existing formatting, naming, ES module, CSS layer, and file-layout conventions.
- Prefer clear interfaces, explicit ownership, and simple control flow over cleverness.
- Comment only non-obvious intent, provenance, or external constraints.
- Update the smallest canonical documentation owner when a durable contract changes.
- Keep README instructions executable and every fenced block explicitly typed.
- Do not add badges, screenshots, statistics, or diagrams unless they improve lookup and can remain current.

## Durable project learning

At wrap-up, consider only learnings that are verified, project-specific, likely to recur, and missing from their canonical owner. Propose the smallest source-linked update; do not automatically create a new file or persist raw logs, hypotheses, machine paths, credentials, or session details.

## User attention

- Use a clearly delimited proposed-issue card for valuable out-of-scope work that is not already tracked.
- Use a decision card when materially different outcomes require the owner's choice.
- Use an approval card immediately before a publication, permission, destructive, privacy, or external-mutation boundary that is not already authorized.
- Use an action-needed card for a concrete external step only the owner can perform.
- Ask through the client's structured question facility when one exists; otherwise end the turn with one direct question and an exact reply format.

## Configuration and repository hygiene

- Ignore only secrets, local environments, logs, caches, test reports, and generated artifacts that this stack actually creates.
- Do not add `.env.example` unless supported environment variables exist.
- Do not add release, dependency-update, deployment, or authentication automation without the corresponding project requirement and verified contract.
- The GitHub homepage mirrors the recorded landing page only after Pages metadata, latest deployment status, and environment URL agree.

## Tests and validation

- Install exact dependencies with `npm ci`.
- Run the focused test first, then `npm test` before declaring a code or setup change complete.
- Install the project-owned browser with `npx playwright install chromium`; CI installs its system dependencies with `npx playwright install --with-deps --no-shell chromium`.
- Browser acceptance uses Playwright `browserName: "chromium"` with `channel: "chromium"`. Do not substitute Brave or an installed branded browser.
- Do not claim a command passed unless it ran successfully. Report exact skips, failures, and residual manual verification.

## Artifacts and processes

- Temporary is the default. Keep only requested deliverables and established next-phase inputs.
- Put temporary files in a unique system temporary directory, not in the repository, and remove them before completion.
- Preserve pre-existing artifacts, fixtures, baselines, ignored content, and user processes.

## Git and pull requests

- Check status and branch before editing and before the completion report.
- Branch as `<type>/<agent>/issue-<n>/<short-slug>`; orchestrated branches add `ao/<session-id>/` before that project convention.
- Use Conventional Commits in English, one concern per commit, ending issue commits with `(#<n>)`.
- Pull request titles use `Issue #<n> - <description>` or `Issues #<a>, #<b> - <description>`.
- Begin the body with one `Closes #<n>` line per fully satisfied issue, followed by problem, implementation, validation, and residual risk.
- Merge with squash and delete the branch. Never arm GitHub auto-merge from a worker; the owner or `skd merge` owns merge execution.
- Do not publish a release or change a version unless explicitly requested under a recorded release policy.

## Agent skill paths

- Product definition: `docs/product.md`

Create no glossary, ADR, research, handoff, or prototype directory until a concrete artifact needs it.

## Agent execution

Rules for any executor working from a clone of this repository:

- Restore dependencies with `npm ci`; run tests with `npm test`. No separate lint command is configured.
- Use Chromium for Testing through the Playwright-owned `chromium` browser and channel. Never substitute Brave.
- Branch as `<type>/<agent>/issue-<n>/<short-slug>`; commit with a Conventional Commit subject ending in `(#<n>)`.
- Commit to `main` only after the complete suite passes; an outside contributor opens a pull request instead.
- Start the PR body with one `Closes #<n>` line per resolved issue, then record the problem, implementation, tests with results, and residual risk.
- Do not touch `.ao/` or `.github/workflows/` during ordinary issue implementation.
- `AGENTS.md` is protected by section: `## Project identity and policy` is governance and never changes under an executor. Other sections update only when the delivered code would make a recorded pattern untrue.
- When a needed decision is absent from the issue, post the exact missing choice, apply `status: needs-decision` with `in-progress`, read both back, and stop instead of guessing.

## Completion report

Lead with the outcome and include files changed, validation commands and actual results, warnings and skips, temporary-artifact cleanup, commit/branch/push status, final worktree state, and unrelated changes left untouched.
