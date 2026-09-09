import {
  expect,
  test
} from "@playwright/test";

const testedCountries = [
  { name: "Paraguay", code: "PY" },
  { name: "Brazil", code: "BR" },
  { name: "Bolivia", code: "BO" },
  { name: "Spain", code: "ES" }
];

const forbiddenBackgrounds = new Set([
  "#FFFFFF",
  "#94A3B8",
  "#334155"
]);

async function installDiagnostics(page) {
  const diagnostics = {
    consoleErrors: [],
    failedRequests: []
  };

  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", error => {
    diagnostics.consoleErrors.push(error.message);
  });

  page.on("requestfailed", request => {
    diagnostics.failedRequests.push(
      `${request.failure()?.errorText ?? "failed"} ${request.url()}`
    );
  });

  page.on("response", response => {
    if (response.status() >= 400) {
      diagnostics.failedRequests.push(
        `${response.status()} ${response.url()}`
      );
    }
  });

  return diagnostics;
}

async function openApp(page) {
  await page.goto("./", {
    waitUntil: "networkidle"
  });
  await expect(page.locator("#country-search")).toBeEnabled();
}

async function searchCountry(page, query) {
  const input = page.locator("#country-search");

  await input.fill(query);
  await expect(page.locator("#country-options")).toBeVisible();
}

async function selectCountry(page, query, code) {
  await searchCountry(page, query);

  const option = page.locator("#country-options [role='option']").filter({
    hasText: code
  }).first();

  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator(".palette-option")).toHaveCount(3);
  await expect(page.locator("#output-name")).toHaveText(`${code}.svg`);
}

async function downloadCurrentFile(page) {
  return Promise.all([
    page.waitForEvent("download"),
    page.locator("#download-button").click()
  ]).then(([downloadEvent]) => downloadEvent);
}

function paletteInputs(page) {
  return page.locator('#palette-options input[name="badge-background"]');
}

async function getPaletteHexes(page) {
  return page.locator(".palette-hex").evaluateAll(elements =>
    elements.map(element => element.textContent.trim())
  );
}

async function assertDropdownIsAboveContent(page) {
  const result = await page.evaluate(() => {
    const list = document.querySelector("#country-options");
    const rect = list.getBoundingClientRect();
    const style = getComputedStyle(list);
    const pointX = rect.left + Math.min(24, rect.width / 2);
    const pointY = rect.top + Math.min(24, rect.height / 2);
    const topElement = document.elementFromPoint(pointX, pointY);

    return {
      visible: rect.width > 0 && rect.height > 0,
      zIndex: Number(style.zIndex),
      topElementIsDropdown:
        topElement === list ||
        Boolean(topElement?.closest("#country-options")),
      withinViewport:
        rect.left >= 0 &&
        rect.right <= window.innerWidth &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight
    };
  });

  expect(result.visible).toBe(true);
  expect(result.zIndex).toBeGreaterThanOrEqual(80);
  expect(result.topElementIsDropdown).toBe(true);
  expect(result.withinViewport).toBe(true);
}

test("combobox opens, filters, rejects free text, and supports keyboard and pointer selection", async ({ page }) => {
  const diagnostics = await installDiagnostics(page);
  await openApp(page);

  const input = page.locator("#country-search");

  await input.focus();
  await expect(page.locator("#country-options")).toBeVisible();
  await assertDropdownIsAboveContent(page);

  await input.fill("zzzzzz");
  await expect(page.locator(".country-no-results")).toHaveText("No countries found.");
  await expect(page.locator("#country-status")).toHaveText(
    "No countries found for \u201Czzzzzz\u201D."
  );
  await expect(page.locator("#country-status")).toHaveAttribute("data-state", "warning");
  await expect(page.locator("#country-options [role='option']")).toHaveCount(0);
  await expect(page.locator(".country-no-results")).not.toHaveAttribute("role", /.*/);

  await input.fill("Paraguay");
  await expect(page.locator("#country-options [role='option']").first()).toContainText("PY");
  await expect(page.locator("#country-status")).toHaveText("Countries loaded.");

  await input.fill("zzzzzz");
  await expect(page.locator("#country-status")).toHaveText(
    "No countries found for \u201Czzzzzz\u201D."
  );
  await input.fill("");
  await expect(page.locator("#country-status")).toHaveText("Countries loaded.");

  await input.fill("Paraguay");

  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /country-option-/);

  await input.press("ArrowUp");
  await expect(input).toHaveAttribute("aria-activedescendant", /country-option-/);

  await input.press("Escape");
  await expect(page.locator("#country-options")).toBeHidden();

  await input.fill("Brazil");
  await page.mouse.click(10, 10);
  await expect(page.locator("#country-options")).toBeHidden();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#output-name")).toHaveText("--");

  await input.fill("PY");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator("#output-name")).toHaveText("PY.svg");
  await expect(page.locator(".palette-option")).toHaveCount(3);

  await page.locator("#clear-search").click();
  await expect(input).toHaveValue("");
  await expect(page.locator("#output-name")).toHaveText("--");
  await expect(page.locator("#download-button")).toBeDisabled();

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.failedRequests).toEqual([]);
});

test("generates deterministic palettes, previews every option, and downloads self-contained SVGs", async ({ page }) => {
  const diagnostics = await installDiagnostics(page);
  await openApp(page);

  for (const country of testedCountries) {
    await selectCountry(page, country.name, country.code);

    const hexes = await getPaletteHexes(page);
    expect(hexes).toHaveLength(3);
    expect(new Set(hexes).size).toBe(3);

    for (const hex of hexes) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(forbiddenBackgrounds.has(hex)).toBe(false);
    }

    const distances = await page.evaluate(async colors => {
      const { colorDistance } = await import("./js/palette.js");
      const parse = hex => ({
        r: Number.parseInt(hex.slice(1, 3), 16),
        g: Number.parseInt(hex.slice(3, 5), 16),
        b: Number.parseInt(hex.slice(5, 7), 16)
      });

      return colors.flatMap((first, firstIndex) =>
        colors.slice(firstIndex + 1).map(second =>
          colorDistance(parse(first), parse(second))
        )
      );
    }, hexes);

    expect(Math.min(...distances)).toBeGreaterThan(0.07);

    const previewColors = [];

    for (let index = 0; index < 3; index += 1) {
      await page.locator(".palette-option").nth(index).click();
      await expect(paletteInputs(page).nth(index)).toBeChecked();
      await expect(page.locator("#selected-color")).toHaveText(hexes[index]);

      const previewColor = await page.locator("#preview-canvas > svg rect").getAttribute("fill");
      previewColors.push(previewColor);
    }

    expect(previewColors).toEqual(hexes);

    const download = await downloadCurrentFile(page);

    expect(download.suggestedFilename()).toBe(`${country.code}.svg`);

    const path = await download.path();
    const svgText = await import("node:fs/promises").then(fs =>
      fs.readFile(path, "utf8")
    );

    expect(svgText).toContain('viewBox="0 0 1024 1024"');
    expect(svgText).toContain(`fill="${hexes[2]}"`);
    expect(svgText).toContain('width="558"');
    expect(svgText).toContain('height="351"');
    expect(svgText).toContain("data:image/svg+xml;base64,");
    expect(svgText).not.toMatch(/href="https?:\/\//);
  }

  await page.locator("#clear-search").click();
  await selectCountry(page, "Brazil", "BR");

  await page.getByLabel("PNG").check();
  await expect(page.locator("#output-name")).toHaveText("BR.png");
  await expect(page.locator("#download-label")).toHaveText("Download PNG");

  const pngDownload = await downloadCurrentFile(page);
  expect(pngDownload.suggestedFilename()).toBe("BR.png");

  const pngPath = await pngDownload.path();
  const pngBytes = await import("node:fs/promises").then(fs =>
    fs.readFile(pngPath)
  );

  expect(pngBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  await page.getByLabel("JPG").check();
  await expect(page.locator("#output-name")).toHaveText("BR.jpg");
  await expect(page.locator("#download-label")).toHaveText("Download JPG");

  const jpgDownload = await downloadCurrentFile(page);
  expect(jpgDownload.suggestedFilename()).toBe("BR.jpg");

  const jpgPath = await jpgDownload.path();
  const jpgBytes = await import("node:fs/promises").then(fs =>
    fs.readFile(jpgPath)
  );

  expect(jpgBytes.subarray(0, 2).toString("hex")).toBe("ffd8");
  await page.getByLabel("SVG").check();

  await page.locator("#clear-search").click();
  await selectCountry(page, "Brazil", "BR");
  const firstBrazil = await getPaletteHexes(page);
  await page.locator("#clear-search").click();
  await selectCountry(page, "BR", "BR");
  expect(await getPaletteHexes(page)).toEqual(firstBrazil);

  await page.locator("#clear-search").click();
  await selectCountry(page, "Paraguay", "PY");
  const firstParaguay = await getPaletteHexes(page);
  await page.locator("#clear-search").click();
  await selectCountry(page, "PY", "PY");
  expect(await getPaletteHexes(page)).toEqual(firstParaguay);

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.failedRequests).toEqual([]);
});

test("curated palettes preserve clear flag color families", async ({ page }) => {
  await openApp(page);

  const hexes = await page.evaluate(async () => {
    const { createDeterministicPalette } = await import("./js/palette.js");
    const flagSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 3">
      <rect width="3" height="1" fill="#D52B1E"/>
      <rect y="1" width="3" height="1" fill="#F9E300"/>
      <rect y="2" width="3" height="1" fill="#007934"/>
    </svg>`;

    return createDeterministicPalette(flagSvg)
      .then(palette => palette.map(option => option.hex));
  });

  expect(hexes).toHaveLength(3);
  expect(hexes).toContain("#EF4444");
  expect(hexes).toContain("#FACC15");
  expect(hexes).toContain("#22C55E");
});

test("layout remains usable at desktop and mobile viewports", async ({ page, viewport }) => {
  await openApp(page);
  await searchCountry(page, "Paraguay");
  await assertDropdownIsAboveContent(page);
  await page.locator("#country-options [role='option']").first().click();
  await expect(page.locator(".palette-option")).toHaveCount(3);

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    downloadVisible: (() => {
      const rect = document.querySelector("#download-button").getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    })(),
    previewVisible: (() => {
      const rect = document.querySelector("#preview-canvas").getBoundingClientRect();
      return rect.width >= 280 && rect.height >= 280 && rect.top < window.innerHeight && rect.bottom > 0;
    })()
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);

  if (viewport.width >= 940) {
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.downloadVisible).toBe(true);
    expect(metrics.previewVisible).toBe(true);
  } else {
    await page.locator("#preview-canvas").scrollIntoViewIfNeeded();
    await expect(page.locator("#preview-canvas")).toBeInViewport();
    await page.locator("#download-button").scrollIntoViewIfNeeded();
    await expect(page.locator("#download-button")).toBeInViewport();

    const touchTargets = await page.locator(".button:visible, #country-search, .palette-option").evaluateAll(elements =>
      elements.map(element => {
        const rect = element.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height
        };
      })
    );

    expect(touchTargets.every(rect => rect.height >= 44)).toBe(true);
  }

  // Compact density is expressed by scoped token overrides, so the panels must
  // resolve to the compact padding and radius below 641px and to the base
  // values above it.
  const panel = await page.locator(".controls-panel").evaluate(element => {
    const style = getComputedStyle(element);

    return {
      padding: style.paddingTop,
      radius: style.borderTopLeftRadius
    };
  });

  if (viewport.width <= 640) {
    expect(panel).toEqual({ padding: "16px", radius: "15px" });
  } else if (viewport.height > 900) {
    expect(panel).toEqual({ padding: "22px", radius: "18px" });
  } else {
    expect(panel).toEqual({ padding: "16px", radius: "18px" });
  }
});

test("the source note credits both data sources", async ({ page, viewport }) => {
  await openApp(page);

  const sourceNote = page.locator(".source-note");

  await expect(sourceNote).toContainText("world-countries");
  await expect(sourceNote).toContainText("FlagCDN");

  if (viewport.width > 640) {
    await expect(sourceNote).toBeVisible();
  }
});

const COUNTRY_DATA_PATTERN =
  "**/world-countries@*/dist/countries.json";

function createCatalogPayload() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const payload = [
    {
      cca2: "BR",
      name: {
        common: "Brazil",
        official: "Federative Republic of Brazil"
      }
    },
    {
      cca2: "PY",
      name: {
        common: "Paraguay",
        official: "Republic of Paraguay"
      }
    }
  ];

  const usedCodes = new Set(payload.map(country => country.cca2));

  for (const first of letters) {
    for (const second of letters) {
      const code = `${first}${second}`;

      if (usedCodes.has(code)) {
        continue;
      }

      usedCodes.add(code);
      payload.push({
        cca2: code,
        name: {
          common: `Country ${code}`,
          official: `Country ${code}`
        }
      });

      if (payload.length >= 120) {
        return payload;
      }
    }
  }

  return payload;
}

function createGate() {
  let release;
  const promise = new Promise(resolve => {
    release = resolve;
  });

  return { promise, release };
}

// Serves the catalog request from a local plan so failure and recovery are
// deterministic and no live CDN is involved.
async function installCatalogRoute(page, plan) {
  const tracker = { attempts: 0 };

  await page.route(COUNTRY_DATA_PATTERN, async route => {
    const step = plan[Math.min(tracker.attempts, plan.length - 1)];

    tracker.attempts += 1;

    if (step.gate) {
      await step.gate;
    }

    if (step.ok) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createCatalogPayload())
      });

      return;
    }

    await route.abort("failed");
  });

  return tracker;
}

async function expectCatalogFailureState(page) {
  await expect(page.locator("#country-status")).toHaveText(
    "The country list could not be loaded. Check the connection and try again."
  );
  await expect(page.locator("#country-status")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#country-search")).toBeDisabled();
  await expect(page.locator("#country-retry")).toBeVisible();
  await expect(page.locator("#country-retry")).toBeEnabled();
  await expect(page.locator("#status-message")).toHaveText(
    "Country search is unavailable until the country list loads."
  );

  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  );

  expect(overflows).toBe(false);
}

test("a failed catalog load recovers through the in-page retry control", async ({ page }) => {
  const gate = createGate();
  const tracker = await installCatalogRoute(page, [
    { ok: false },
    { ok: true, gate: gate.promise }
  ]);

  await page.goto("./", { waitUntil: "load" });

  await expectCatalogFailureState(page);
  expect(tracker.attempts).toBe(1);

  const retry = page.locator("#country-retry");

  await retry.focus();
  await retry.press("Enter");

  await expect(page.locator("#country-status")).toHaveText("Retrying the country list...");
  await expect(retry).toBeDisabled();

  // A second activation while one attempt is in flight must not start another request.
  await page.locator("#country-retry").dispatchEvent("click");
  expect(tracker.attempts).toBe(2);

  gate.release();

  const input = page.locator("#country-search");

  await expect(input).toBeEnabled();
  await expect(page.locator("#country-status")).toHaveText("Countries loaded.");
  await expect(page.locator("#country-status")).toHaveAttribute("data-state", "success");
  await expect(page.locator("#status-message")).toHaveText("Choose a country to begin.");
  await expect(retry).toBeHidden();
  await expect(input).toBeFocused();
  expect(tracker.attempts).toBe(2);

  await input.fill("Paraguay");
  await expect(page.locator("#country-options [role='option']").first()).toContainText("PY");
});

test("a repeated catalog failure stays retryable and never reports success", async ({ page }) => {
  const tracker = await installCatalogRoute(page, [{ ok: false }]);

  await page.goto("./", { waitUntil: "load" });

  await expectCatalogFailureState(page);
  expect(tracker.attempts).toBe(1);

  const retry = page.locator("#country-retry");

  await retry.focus();
  await retry.press("Enter");

  await expect(page.locator("#country-status")).toHaveAttribute("data-state", "error");
  await expectCatalogFailureState(page);
  await expect(retry).toBeFocused();
  expect(tracker.attempts).toBe(2);

  await retry.press("Enter");

  await expectCatalogFailureState(page);
  await expect(retry).toBeFocused();
  expect(tracker.attempts).toBe(3);
});

test("a settling retry leaves focus the user moved elsewhere alone", async ({ page }) => {
  const failureGate = createGate();
  const successGate = createGate();
  const tracker = await installCatalogRoute(page, [
    { ok: false },
    { ok: false, gate: failureGate.promise },
    { ok: true, gate: successGate.promise }
  ]);

  await page.goto("./", { waitUntil: "load" });
  await expectCatalogFailureState(page);

  const retry = page.locator("#country-retry");
  const pngFormat = page.locator("#format-options input[value='png']");
  const jpgFormat = page.locator("#format-options input[value='jpg']");

  // A failing retry must not pull focus off a control the user chose while waiting.
  await retry.focus();
  await retry.press("Enter");
  await expect(page.locator("#country-status")).toHaveText("Retrying the country list...");

  await pngFormat.focus();
  await expect(pngFormat).toBeFocused();

  failureGate.release();

  await expectCatalogFailureState(page);
  await expect(pngFormat).toBeFocused();
  expect(tracker.attempts).toBe(2);

  // A succeeding retry must not pull focus away either, and must not open the
  // suggestion list over the control the user is actually operating.
  await retry.focus();
  await retry.press("Enter");
  await expect(page.locator("#country-status")).toHaveText("Retrying the country list...");

  await jpgFormat.focus();
  await expect(jpgFormat).toBeFocused();

  successGate.release();

  const input = page.locator("#country-search");

  await expect(input).toBeEnabled();
  await expect(page.locator("#country-status")).toHaveText("Countries loaded.");
  await expect(jpgFormat).toBeFocused();
  await expect(page.locator("#country-options")).toBeHidden();
  expect(tracker.attempts).toBe(3);
});

const FLAG_PATTERN = "https://flagcdn.com/*.svg";

// Serves every flag from a local plain SVG so touch coverage never depends on
// the live CDN.
async function installFlagRoute(page) {
  await page.route(FLAG_PATTERN, async route => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">
        <rect width="3" height="2" fill="#D52B1E"/>
        <rect width="1" height="2" fill="#007934"/>
      </svg>`
    });
  });
}

// Real touch input, so the browser resolves the gesture itself instead of the
// test deciding whether a press was a drag or a tap.
async function dispatchTouchDrag(session, { x, y, distance, steps = 8 }) {
  const point = offsetY => [
    {
      x,
      y: offsetY,
      radiusX: 6,
      radiusY: 6,
      force: 1
    }
  ];

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(y)
  });

  for (let step = 1; step <= steps; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(y - (distance * step) / steps)
    });
  }

  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });
}

async function dispatchTouchTap(session, { x, y }) {
  const touchPoints = [{ x, y, radiusX: 6, radiusY: 6, force: 1 }];

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints
  });

  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });
}

test("a touch drag scrolls the suggestion list instead of selecting a country", async ({
  page,
  hasTouch,
  viewport
}) => {
  test.skip(!hasTouch || viewport.width !== 390, "Touch coverage runs at 390 x 844.");

  await installCatalogRoute(page, [{ ok: true }]);
  await installFlagRoute(page);
  await openApp(page);

  const input = page.locator("#country-search");
  const list = page.locator("#country-options");

  await input.fill("Country");
  await expect(list).toBeVisible();

  const overflow = await list.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }));

  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
  expect(overflow.scrollTop).toBe(0);

  const box = await list.boundingBox();
  const session = await page.context().newCDPSession(page);

  await dispatchTouchDrag(session, {
    x: box.x + box.width / 2,
    y: box.y + box.height - 24,
    distance: box.height - 48
  });

  await expect
    .poll(() => list.evaluate(element => element.scrollTop))
    .toBeGreaterThan(0);

  await expect(list).toBeVisible();
  await expect(page.locator("#output-name")).toHaveText("--");
  await expect(input).toHaveValue("Country");

  // The list scrolled, so the tap target is whichever option the scroll
  // actually brought into view.
  const tapTarget = await list.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const option = document
      .elementFromPoint(x, y)
      .closest('[role="option"]');

    return {
      x,
      y,
      code: option.querySelector(".country-option-code").textContent
    };
  });

  await dispatchTouchTap(session, {
    x: tapTarget.x,
    y: tapTarget.y
  });

  await expect(list).toBeHidden();
  await expect(page.locator("#output-name")).toHaveText(`${tapTarget.code}.svg`);
});

// Holds the raster encoding open so the next format can be selected while an
// export is still pending.
async function deferRasterEncoding(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;

    window.__pendingEncodings = [];
    window.__releaseEncoding = () => {
      const pending = window.__pendingEncodings.shift();
      pending?.();
    };

    HTMLCanvasElement.prototype.toBlob = function deferredToBlob(...args) {
      window.__pendingEncodings.push(() => original.apply(this, args));
    };
  });
}

test("a raster download reports the file it captured, not the next format", async ({
  page
}) => {
  await installCatalogRoute(page, [{ ok: true }]);
  await installFlagRoute(page);
  await deferRasterEncoding(page);
  await openApp(page);

  await selectCountry(page, "Brazil", "BR");

  const status = page.locator("#status-message");
  const outputName = page.locator("#output-name");

  for (const step of [
    { from: "PNG", to: "JPG" },
    { from: "JPG", to: "PNG" }
  ]) {
    const started = step.from.toLowerCase();
    const next = step.to.toLowerCase();

    await page.getByLabel(step.from).check();
    await expect(outputName).toHaveText(`BR.${started}`);

    const downloadPromise = page.waitForEvent("download");

    await page.locator("#download-button").click();
    await expect(status).toHaveText(`Preparing BR.${started}...`);

    await page.getByLabel(step.to).check();
    await expect(outputName).toHaveText(`BR.${next}`);

    await page.evaluate(() => window.__releaseEncoding());

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`BR.${started}`);
    await expect(status).toHaveText(`Downloaded BR.${started}.`);
    await expect(outputName).toHaveText(`BR.${next}`);
  }

  await page.getByLabel("SVG").check();
});

test("a rejected clipboard copy reports failure and leaves downloads working", async ({
  page
}) => {
  await installCatalogRoute(page, [{ ok: true }]);
  await installFlagRoute(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true
    });

    document.execCommand = () => false;
  });
  await openApp(page);

  await selectCountry(page, "Brazil", "BR");

  await page.locator("#copy-button").click();

  await expect(page.locator("#status-message")).toHaveText(
    "The SVG could not be copied in this browser."
  );
  await expect(page.locator("#status-message")).toHaveAttribute("data-state", "error");
  await expect(page.locator("body > textarea")).toHaveCount(0);

  await expect(page.locator("#download-button")).toBeEnabled();

  const download = await downloadCurrentFile(page);

  expect(download.suggestedFilename()).toBe("BR.svg");
});

test("the background palette is one exclusive radio group with decorative thumbnails", async ({
  page
}) => {
  await installCatalogRoute(page, [{ ok: true }]);
  await installFlagRoute(page);
  await openApp(page);

  await selectCountry(page, "Brazil", "BR");

  const group = page.locator('#palette-options [role="radiogroup"]');
  const inputs = paletteInputs(page);

  await expect(group).toHaveAttribute("aria-labelledby", "palette-title");
  await expect(inputs).toHaveCount(3);
  await expect(inputs.nth(0)).toBeChecked();

  const names = await inputs.evaluateAll(elements =>
    elements.map(element => element.name)
  );

  expect(new Set(names).size).toBe(1);

  const accessibleNames = await page
    .locator(".palette-option")
    .evaluateAll(elements =>
      elements.map(element => element.textContent.replace(/\s+/g, " ").trim())
    );

  const hexes = await getPaletteHexes(page);

  accessibleNames.forEach((name, index) => {
    expect(name).toContain(hexes[index]);
  });

  // Every thumbnail repeats the main preview, so only the preview should reach
  // the accessibility tree as an image.
  const exposedImages = await page.locator("svg[role='img']").evaluateAll(elements =>
    elements.filter(element => !element.closest("[aria-hidden='true']")).length
  );

  expect(exposedImages).toBe(1);
  await expect(page.locator("#preview-canvas > svg")).toHaveAttribute("role", "img");

  // Arrow keys move a native radio group's selection and must move the preview.
  await inputs.nth(0).focus();
  await page.keyboard.press("ArrowRight");

  await expect(inputs.nth(1)).toBeChecked();
  await expect(page.locator("#selected-color")).toHaveText(hexes[1]);
  await expect(page.locator("#preview-canvas > svg rect")).toHaveAttribute(
    "fill",
    hexes[1]
  );

  await page.keyboard.press("ArrowLeft");

  await expect(inputs.nth(0)).toBeChecked();
  await expect(page.locator("#selected-color")).toHaveText(hexes[0]);

  await page.locator(".palette-option").nth(2).click();

  await expect(inputs.nth(2)).toBeChecked();
  await expect(inputs.nth(0)).not.toBeChecked();
  await expect(page.locator("#selected-color")).toHaveText(hexes[2]);

  const checkedCount = await inputs.evaluateAll(elements =>
    elements.filter(element => element.checked).length
  );

  expect(checkedCount).toBe(1);

  // The format control is the same exclusive-choice card, sharing one visual base.
  const cardBases = await page.locator(".choice-card").evaluateAll(elements =>
    elements.map(element => {
      const style = getComputedStyle(element);

      return `${style.borderRadius}|${style.borderTopWidth}|${style.minHeight}`;
    })
  );

  expect(new Set(cardBases).size).toBe(1);
  expect(cardBases.length).toBe(6);
});
