import assert from "node:assert/strict";
import test from "node:test";

import { copyText, createBadgeSvg, createFlagDataUri } from "../../js/svg.js";

const flagSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height="2" fill="#009739"/></svg>`;

test("generated badge SVG is self-contained and accessible", () => {
  const svg = createBadgeSvg({
    code: "BR",
    countryName: "Brazil",
    flagSvgText: flagSvg,
    backgroundHex: "#62B46D",
  });

  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.match(svg, /fill="#62B46D"/);
  assert.match(svg, /<title id="badge-br-title">Brazil country badge<\/title>/);
  assert.match(svg, /<desc id="badge-br-description">BR flag centered/);
  assert.match(svg, /href="data:image\/svg\+xml;base64,/);
  assert.match(svg, /x="233"/);
  assert.match(svg, /y="336\.5"/);
  assert.match(svg, /width="558"/);
  assert.match(svg, /height="351"/);
  assert.doesNotMatch(svg, /href="https?:\/\//);
});

test("changing the selected background changes the SVG", () => {
  const first = createBadgeSvg({
    code: "PY",
    countryName: "Paraguay",
    flagSvgText: flagSvg,
    backgroundHex: "#FD9C91",
  });

  const second = createBadgeSvg({
    code: "PY",
    countryName: "Paraguay",
    flagSvgText: flagSvg,
    backgroundHex: "#8AB7FF",
  });

  assert.notEqual(first, second);
  assert.match(second, /fill="#8AB7FF"/);
});

// Minimal document stand-in: the fallback only needs a detachable textarea and
// a copy command whose result the caller must honour.
function createClipboardEnvironment({ execCommand }) {
  const attached = [];

  const document = {
    createElement() {
      const element = {
        style: {},
        setAttribute() {},
        select() {},
        remove() {
          const index = attached.indexOf(element);

          if (index >= 0) {
            attached.splice(index, 1);
          }
        },
      };

      return element;
    },
    body: {
      append(element) {
        attached.push(element);
      },
    },
    execCommand,
  };

  return { document, attached };
}

async function withClipboardEnvironment(environment, run) {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, "navigator", {
    value: {},
    configurable: true,
    writable: true,
  });
  globalThis.document = environment.document;

  try {
    return await run();
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  }
}

test("the clipboard fallback resolves only when the copy command succeeds", async () => {
  const environment = createClipboardEnvironment({
    execCommand: () => true,
  });

  await withClipboardEnvironment(environment, () => copyText("<svg />"));

  assert.deepEqual(environment.attached, []);
});

test("the clipboard fallback rejects when the copy command reports failure", async () => {
  const environment = createClipboardEnvironment({
    execCommand: () => false,
  });

  await withClipboardEnvironment(environment, () =>
    assert.rejects(() => copyText("<svg />"), /could not be copied/),
  );

  assert.deepEqual(environment.attached, []);
});

test("the clipboard fallback cleans up when the copy command throws", async () => {
  const environment = createClipboardEnvironment({
    execCommand: () => {
      throw new Error("NotAllowedError");
    },
  });

  await withClipboardEnvironment(environment, () =>
    assert.rejects(() => copyText("<svg />"), /NotAllowedError/),
  );

  assert.deepEqual(environment.attached, []);
});

test("a prepared flag data URI is reused instead of re-encoded", () => {
  const flagDataUri = createFlagDataUri(flagSvg);

  assert.match(flagDataUri, /^data:image\/svg\+xml;base64,/);

  const fromText = createBadgeSvg({
    code: "BR",
    countryName: "Brazil",
    flagSvgText: flagSvg,
    backgroundHex: "#62B46D",
  });

  const fromPrepared = createBadgeSvg({
    code: "BR",
    countryName: "Brazil",
    flagDataUri,
    backgroundHex: "#62B46D",
  });

  assert.equal(fromPrepared, fromText);
  assert.ok(fromPrepared.includes(flagDataUri));
});

test("a badge composed from prepared data stays self-contained", () => {
  const svg = createBadgeSvg({
    code: "PY",
    countryName: "Paraguay",
    flagDataUri: createFlagDataUri(flagSvg),
    backgroundHex: "#8AB7FF",
  });

  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.match(svg, /href="data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(svg, /href="https?:\/\//);
  assert.doesNotMatch(svg, /href="blob:/);
});
