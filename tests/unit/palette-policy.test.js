import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSourceColors,
  selectPalette
} from "../../js/palette-policy.js";

// The policy is DOM-free, so every branch is exercised from controlled source
// colors instead of a rasterized flag.
const RED = { r: 213, g: 43, b: 30 };
const YELLOW = { r: 249, g: 227, b: 0 };
const GREEN = { r: 0, g: 121, b: 52 };
const BLUE = { r: 0, g: 87, b: 183 };
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

function source(rgb, weight = 1) {
  return { rgb, weight };
}

function hexesOf(sourceColors) {
  return selectPalette(sourceColors).map(option => option.hex);
}

test("the policy runs without a DOM, canvas, Image, or network", () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.Image, "undefined");

  assert.equal(hexesOf([source(GREEN)]).length, 3);
});

test("empty and neutral input fall back to the curated blue", () => {
  const fallback = hexesOf([]);

  assert.equal(fallback[0], "#3B82F6");
  assert.deepEqual(hexesOf(null), fallback);
  assert.deepEqual(hexesOf([source(GREEN, 0)]), fallback);
  assert.deepEqual(hexesOf([{ weight: 1 }]), fallback);
});

test("one, two, and three source families each produce three unique colors", () => {
  for (const sourceColors of [
    [source(GREEN)],
    [source(BLUE, 2), source(YELLOW, 1)],
    [source(RED, 1), source(YELLOW, 1), source(GREEN, 1)]
  ]) {
    const hexes = hexesOf(sourceColors);

    assert.equal(hexes.length, 3);
    assert.equal(new Set(hexes).size, 3);

    for (const hex of hexes) {
      assert.match(hex, /^#[0-9A-F]{6}$/);
    }
  }
});

test("a dominant family is represented by that family", () => {
  const [first] = hexesOf([source(GREEN, 10), source(WHITE, 1)]);

  assert.equal(first, "#22C55E");

  const [red] = hexesOf([source(RED, 10), source(WHITE, 1)]);

  assert.equal(red, "#EF4444");
});

test("light-weight flags still select a tint rather than nothing", () => {
  const hexes = hexesOf([source(WHITE, 20), source(BLUE, 1)]);

  assert.equal(hexes.length, 3);
  assert.equal(new Set(hexes).size, 3);
});

test("selection is deterministic and order-stable for the same input", () => {
  const sourceColors = [
    source(RED, 3),
    source(YELLOW, 2),
    source(GREEN, 1)
  ];

  assert.deepEqual(hexesOf(sourceColors), hexesOf(sourceColors));
});

test("selection never repeats a curated color, even from one flat source", () => {
  for (const rgb of [RED, YELLOW, GREEN, BLUE, WHITE, BLACK]) {
    const hexes = hexesOf([source(rgb)]);

    assert.equal(new Set(hexes).size, 3, `${JSON.stringify(rgb)}`);
  }
});

test("the palette always has exactly three labelled options", () => {
  const palette = selectPalette([source(RED), source(BLUE)]);

  assert.deepEqual(
    palette.map(option => option.id),
    [1, 2, 3]
  );
  assert.deepEqual(
    palette.map(option => option.label),
    ["Option 1", "Option 2", "Option 3"]
  );

  for (const option of palette) {
    assert.equal(typeof option.rgb.r, "number");
    assert.equal(typeof option.rgb.g, "number");
    assert.equal(typeof option.rgb.b, "number");
  }
});

test("source colors are normalized to shares of the flag", () => {
  const normalized = normalizeSourceColors([
    source(RED, 3),
    source(GREEN, 1),
    source(BLUE, 0),
    { rgb: BLUE, weight: Number.NaN }
  ]);

  assert.equal(normalized.length, 2);
  assert.deepEqual(
    normalized.map(entry => entry.weight),
    [0.75, 0.25]
  );
  assert.deepEqual(
    normalized.map(entry => entry.family),
    ["red", "green"]
  );

  for (const entry of normalized) {
    assert.equal(typeof entry.hsl.h, "number");
  }

  assert.deepEqual(normalizeSourceColors([]), []);
  assert.deepEqual(normalizeSourceColors("nope"), []);
});
