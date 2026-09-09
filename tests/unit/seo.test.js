import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../../index.html", import.meta.url),
  "utf8"
);

const sitemap = await readFile(
  new URL("../../sitemap.xml", import.meta.url),
  "utf8"
);

const robots = await readFile(
  new URL("../../robots.txt", import.meta.url),
  "utf8"
);

// The one URL that answers 200: the site's own subdomain. The github.io
// address is only the DNS target, so nothing may point at it.
const CANONICAL = "https://badges.martonpaulo.com/";

function metaContent(attribute, name) {
  const match = page.match(
    new RegExp(
      `<meta\\s+${attribute}="${name}"\\s*(?:\\n\\s*)?content="([^"]*)"`,
      "s"
    )
  );

  return match?.[1] ?? null;
}

test("the document declares its language, viewport, and theme color", () => {
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.ok(metaContent("name", "theme-color"));
});

test("the canonical URL is the address that answers 200", () => {
  assert.match(
    page,
    new RegExp(`<link rel="canonical" href="${CANONICAL}">`)
  );
  assert.doesNotMatch(
    page,
    /martonpaulo\.github\.io/,
    "the github.io address redirects and must not be referenced"
  );
});

test("Open Graph and Twitter cards are complete and agree with the canonical URL", () => {
  const description = metaContent("name", "description");

  assert.ok(description);
  assert.equal(metaContent("property", "og:url"), CANONICAL);
  assert.equal(metaContent("property", "og:type"), "website");
  assert.equal(metaContent("property", "og:title"), "Country Badge Generator");
  assert.equal(metaContent("property", "og:description"), description);
  assert.equal(metaContent("property", "og:image:type"), "image/png");
  assert.equal(metaContent("property", "og:image:width"), "1200");
  assert.equal(metaContent("property", "og:image:height"), "630");
  assert.ok(metaContent("property", "og:image:alt"));
  assert.equal(metaContent("name", "twitter:card"), "summary_large_image");
  assert.equal(metaContent("name", "twitter:description"), description);
  assert.ok(metaContent("name", "twitter:image:alt"));

  for (const property of ["og:image", "twitter:image"]) {
    const attribute = property.startsWith("og:") ? "property" : "name";

    assert.equal(
      metaContent(attribute, property),
      `${CANONICAL}assets/social-card.png`
    );
  }
});

test("the structured data describes this application and parses", () => {
  const match = page.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );

  assert.ok(match, "the page must carry JSON-LD");

  const data = JSON.parse(match[1]);

  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.url, CANONICAL);
  assert.equal(data.name, "Country Badge Generator");
  assert.equal(data.description, metaContent("name", "description"));

  // The product is unversioned, so no version may appear in two places.
  assert.equal("softwareVersion" in data, false);
});

test("the sitemap lists the canonical URL and nothing outside it", () => {
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    match => match[1]
  );

  assert.deepEqual(locations, [CANONICAL]);
});

test("robots.txt allows crawling and points at the sitemap", () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${CANONICAL}sitemap.xml$`, "m"));
});

test("the document has one first-level heading and a flat section hierarchy", () => {
  const headings = [...page.matchAll(/<h([1-6])[\s>]/g)].map(match =>
    Number(match[1])
  );

  assert.equal(headings.filter(level => level === 1).length, 1);
  assert.equal(headings[0], 1);
  assert.equal(
    headings.every(level => level <= 2),
    true,
    "a level jumps past h2"
  );
});
