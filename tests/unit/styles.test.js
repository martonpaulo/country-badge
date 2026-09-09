import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheet = await readFile(
  new URL("../../css/styles.css", import.meta.url),
  "utf8"
);

// Reads the declared token values so the assertions below measure what the
// stylesheet actually ships, not a copy of it.
function readTokens(source) {
  const root = source.match(/:root\s*\{([\s\S]*?)\n\s{2}\}/);

  assert.ok(root, "the :root token block must be readable");

  const tokens = new Map();

  for (const [, name, value] of root[1].matchAll(
    /(--[\w-]+):\s*([^;]+);/g
  )) {
    tokens.set(name, value.trim());
  }

  return tokens;
}

function resolveColor(tokens, name) {
  let value = tokens.get(name);

  assert.ok(value, `${name} must be declared`);

  const reference = value.match(/^var\((--[\w-]+)\)$/);

  if (reference) {
    value = resolveColor(tokens, reference[1]);
  }

  assert.match(
    value,
    /^#[0-9a-f]{6}$/i,
    `${name} must resolve to a six-digit hex color`
  );

  return value;
}

function channelLuminance(channel) {
  const ratio = channel / 255;

  return ratio <= 0.04045
    ? ratio / 12.92
    : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [red, green, blue] = [1, 3, 5].map(offset =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );

  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

// WCAG 2.2 SC 1.4.3. The value is compared unrounded so a failing pair can
// never be rounded up to the threshold.
function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = readTokens(stylesheet);

const textBackgrounds = [
  "--surface",
  "--surface-muted",
  "--page",
  "--page-accent",
  "--surface-strong",
  "--accent-soft"
];

test("normal-sized text roles meet WCAG 2.2 contrast on every rendered background", () => {
  for (const background of textBackgrounds) {
    for (const foreground of ["--text", "--text-soft", "--text-muted"]) {
      const ratio = contrastRatio(
        resolveColor(tokens, foreground),
        resolveColor(tokens, background)
      );

      assert.ok(
        ratio >= 4.5,
        `${foreground} on ${background} is ${ratio.toFixed(3)}:1, below 4.5:1`
      );
    }
  }
});

test("placeholder text meets WCAG 2.2 contrast on the input background", () => {
  const ratio = contrastRatio(
    resolveColor(tokens, "--text-placeholder"),
    resolveColor(tokens, "--surface")
  );

  assert.ok(
    ratio >= 4.5,
    `--text-placeholder is ${ratio.toFixed(3)}:1, below 4.5:1`
  );
});

test("muted icons meet the non-text contrast minimum", () => {
  for (const background of ["--surface", "--surface-muted"]) {
    const ratio = contrastRatio(
      resolveColor(tokens, "--icon-muted"),
      resolveColor(tokens, background)
    );

    assert.ok(
      ratio >= 3,
      `--icon-muted on ${background} is ${ratio.toFixed(3)}:1, below 3:1`
    );
  }
});

test("each semantic role has its own owner", () => {
  const roles = [
    "--text-muted",
    "--text-placeholder",
    "--icon-muted",
    "--action-primary",
    "--focus-border",
    "--focus-ring",
    "--selected-border",
    "--selected-surface",
    "--selected-text",
    "--selected-ring",
    "--progress-indicator",
    "--elevation-panel",
    "--elevation-popover"
  ];

  for (const role of roles) {
    assert.ok(tokens.has(role), `${role} must be declared`);
  }
});

test("no consumer bypasses the text or elevation roles with a literal", () => {
  const components = stylesheet.slice(stylesheet.indexOf("@layer components"));

  assert.doesNotMatch(
    components,
    /::placeholder\s*\{[^}]*color:\s*#/,
    "placeholder color must come from its token"
  );
  assert.doesNotMatch(
    components,
    /box-shadow:\s*var\(--shadow(-soft)?\)/,
    "elevation must come from the panel or popover role"
  );
  assert.doesNotMatch(
    components,
    /box-shadow:\s*var\(--focus\)/,
    "focus must come from the focus-ring role"
  );
});
