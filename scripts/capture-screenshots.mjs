// Captures the published screenshots from real on-screen browser windows.
//
// Method, and why each step is the way it is:
//
// - The window is captured with `screencapture -l<windowid>`, never rendered
//   offscreen. An offscreen bitmap loses the window shadow, the rounded
//   corners, the material and the elevation, and raising the scale factor does
//   not bring them back.
// - `-o` is never passed: that is the flag that removes the shadow.
// - The capture inherits the scale of the display it runs on, so it must run on
//   a Retina display. A 1x monitor silently halves the resolution.
// - The window is reactivated after the first turns of the run loop and only
//   then captured, otherwise the traffic lights come out grey and the controls
//   dimmed.
// - The window id comes from the process this script launched itself, never
//   guessed from the window list, and only windows owned by that process are
//   ever captured.
// - Window size and the served port are fixed here, so the capture is
//   reproducible on another machine.
// - The window is a normal browser window, address bar included: Chromium's
//   app-window mode is not drivable through the automation protocol, and a
//   screenshot of the real browser is what a visitor actually sees.
// - The published width is capped at twice the widest slot the image is shown
//   in, then encoded as lossless WebP: identical pixels, the shadow's alpha
//   preserved, and roughly 70% fewer bytes than PNG.
//
// Requires: a Retina display, Screen Recording permission for the terminal
// running this, `cwebp`, and network access for the country catalog and flags.
//
//   node scripts/capture-screenshots.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import {
  removeServeRoot,
  resolveServeTarget
} from "../tests/support/static-server.js";

// A fixed port keeps the address bar in the capture identical between runs.
const SERVE_PORT = "4173";

const WINDOW_POSITION = { x: 60, y: 60 };

const OUTPUT_DIRECTORY = fileURLToPath(
  new URL("../assets/screenshots/", import.meta.url)
);

const SHOTS = [
  {
    name: "desktop",
    window: { width: 1280, height: 1000 },
    // Shown at up to 880 CSS pixels in the README's content column.
    publishWidth: 1760
  },
  {
    name: "mobile",
    window: { width: 430, height: 900 },
    // Shown at up to 440 CSS pixels beside the desktop capture.
    publishWidth: 880
  }
];

const COUNTRY = "Brazil";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function findWindowId(pid) {
  const script = fileURLToPath(
    new URL("./window-id.swift", import.meta.url)
  );

  return run("swift", [script, String(pid)]).split("\n")[0];
}

function activateWindow(pid) {
  try {
    run("osascript", [
      "-e",
      `tell application "System Events" to set frontmost of (first application process whose unix id is ${pid}) to true`
    ]);
  } catch (error) {
    console.warn(
      `Could not reactivate the window (${error.message.trim()}). The capture may show dimmed controls.`
    );
  }
}

async function settle(page, turns = 3) {
  for (let turn = 0; turn < turns; turn += 1) {
    await page.evaluate(
      () =>
        new Promise(resolve => requestAnimationFrame(() => resolve()))
    );
  }
}

async function captureShot(shot, baseURL, workingDirectory) {
  const server = await chromium.launchServer({
    headless: false,
    channel: "chromium",
    args: [
      `--window-size=${shot.window.width},${shot.window.height}`,
      `--window-position=${WINDOW_POSITION.x},${WINDOW_POSITION.y}`,
      "--hide-crash-restore-bubble"
    ]
  });

  const pid = server.process().pid;
  const browser = await chromium.connect(server.wsEndpoint());
  const rawCapture = join(workingDirectory, `${shot.name}.png`);

  try {
    const page = await browser.newPage({ viewport: null });

    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.locator("#country-search").fill(COUNTRY);
    await page
      .locator("#country-options [role='option']")
      .first()
      .click();
    await page.locator(".palette-option").nth(2).waitFor();

    // Show the resting interface: no focus ring left over from driving it, and
    // the page at the top whatever the window height was.
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await settle(page);

    activateWindow(pid);
    await settle(page);

    const windowId = findWindowId(pid);

    if (!windowId) {
      throw new Error(`No on-screen window found for pid ${pid}.`);
    }

    console.log(`${shot.name}: window id ${windowId}`);
    run("screencapture", ["-x", `-l${windowId}`, rawCapture]);
  } finally {
    await browser.close();
    await server.close();
  }

  const published = join(OUTPUT_DIRECTORY, `${shot.name}.webp`);

  run("sips", [
    "--resampleWidth",
    String(shot.publishWidth),
    rawCapture,
    "--out",
    rawCapture
  ]);
  run("cwebp", ["-lossless", "-exact", "-quiet", rawCapture, "-o", published]);

  console.log(`${shot.name}: ${published}`);
}

const workingDirectory = join(
  tmpdir(),
  `country-badge-generator-shots-${process.pid}`
);

process.env.CBG_SERVE_PORT = SERVE_PORT;
mkdirSync(workingDirectory, { recursive: true });
mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

const { command, baseURL } = await resolveServeTarget();
const [serverCommand, ...serverArgs] = command.split(" ");
const { spawn } = await import("node:child_process");
const staticServer = spawn(
  serverCommand,
  serverArgs.map(argument => argument.replaceAll('"', "")),
  { stdio: "ignore" }
);

try {
  await new Promise(resolve => setTimeout(resolve, 500));

  for (const shot of SHOTS) {
    await captureShot(shot, baseURL, workingDirectory);
  }
} finally {
  staticServer.kill();
  removeServeRoot();
  rmSync(workingDirectory, { recursive: true, force: true });
}
