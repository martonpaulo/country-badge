// Browser adapter: decodes a flag SVG, rasterizes it, and reports the colors
// it observed with the share of the flag each one covers. It makes no palette
// decision, so the policy it feeds can be exercised without a canvas.
import { clamp, colorDistance, rgbToHsl } from "./color.js";
import { loadSvgImage } from "./flag-service.js";

const SAMPLE_WIDTH = 176;
const QUANTIZATION_STEP = 18;
const MIN_ALPHA = 180;
const MAX_SOURCE_COLORS = 18;

// Quantization is a sampling decision: it decides how close two observed
// pixels have to be before they count as the same color.
function quantizeChannel(channel) {
  return clamp(
    Math.round(channel / QUANTIZATION_STEP) * QUANTIZATION_STEP,
    0,
    255,
  );
}

export async function sampleFlagColors(flagSvgText) {
  const image = await loadSvgImage(flagSvgText);
  const aspectRatio =
    image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalHeight / image.naturalWidth
      : 2 / 3;

  const width = SAMPLE_WIDTH;
  const height = clamp(Math.round(width * aspectRatio), 96, 176);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);

  const histogram = new Map();

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];

      if (alpha < MIN_ALPHA) {
        continue;
      }

      const r = quantizeChannel(data[index]);
      const g = quantizeChannel(data[index + 1]);
      const b = quantizeChannel(data[index + 2]);
      const key = `${r},${g},${b}`;

      histogram.set(key, (histogram.get(key) ?? 0) + alpha / 255);
    }
  }

  const colors = [...histogram.entries()]
    .map(([key, rawWeight]) => {
      const [r, g, b] = key.split(",").map(Number);
      const rgb = { r, g, b };
      const hsl = rgbToHsl(rgb);
      const toneWeight = hsl.l < 0.05 || hsl.l > 0.97 ? 0.5 : 1;
      const saturationWeight = clamp(0.45 + hsl.s * 1.2, 0.45, 1.8);

      return {
        rgb,
        hsl,
        rawWeight,
        rank: rawWeight * toneWeight * saturationWeight,
      };
    })
    .sort(
      (first, second) =>
        second.rank - first.rank || second.rawWeight - first.rawWeight,
    )
    .slice(0, 80);

  const merged = [];

  for (const color of colors) {
    const duplicate = merged.find(
      (entry) => colorDistance(entry.rgb, color.rgb) < 0.055,
    );

    if (duplicate) {
      duplicate.rawWeight += color.rawWeight;
      duplicate.rank += color.rank;
      continue;
    }

    merged.push({ ...color });

    if (merged.length >= MAX_SOURCE_COLORS) {
      break;
    }
  }

  return merged.map((color) => ({
    rgb: color.rgb,
    weight: color.rawWeight,
  }));
}
