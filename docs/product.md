# Country Badge Generator product definition

## Product

Country Badge Generator is a browser-only tool for turning a supported country into a ready-to-use square badge with a flag and one of three deterministic, flag-inspired backgrounds.

## Audience and job

It is for someone preparing a website, document, presentation, or other digital asset who needs a consistent country marker without manually finding a flag, composing a background, sizing the artwork, and exporting each format.

## Outcomes

- Find a country by name, code, or supported alternate spelling.
- Compare three stable background choices derived from the fetched flag.
- Preview the selected badge before export.
- Download a self-contained 1024 × 1024 SVG, PNG, or JPG.
- Copy the current SVG markup when the browser permits clipboard access.

## Non-goals

- **Accounts, cloud storage, or cross-device sync:** the product is deliberately stateless beyond session-scoped browser convenience data.
- **A backend or private API:** static hosting keeps operation and maintenance cost low and avoids application secrets.
- **Bundling the complete country or flag datasets:** the app consumes pinned country data and flag assets from their documented remote sources instead of becoming their distributor.
- **Offline-first operation:** initial country data and uncached flags require network access; an offline bundle would conflict with the current source and update model.
- **A general-purpose badge editor:** the focused job is selecting a country, background, and output format rather than editing arbitrary artwork.

## Success

The product succeeds when a user can select a supported country, compare three valid backgrounds, and obtain a self-contained 1024 × 1024 asset in the chosen format without an account, backend, API key, or secret.

## Constraints

- GitHub Pages serves the repository root at `https://country-badge.martonpaulo.com/`.
- All product processing happens in the browser.
- Country data comes from the pinned `world-countries` source; flags come from FlagCDN.
- Local modules and assets use relative URLs.
- Product copy and developer documentation are English-only.
- Automated browser acceptance targets Chromium for Testing through Playwright. Brave, Gecko, and WebKit are outside the acceptance matrix.
