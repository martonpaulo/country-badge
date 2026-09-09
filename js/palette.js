// Browser-facing facade: samples the flag, then asks the policy which three
// curated colors represent it. Sampling failures surface to the caller rather
// than being converted into a fallback palette.
import { sampleFlagColors } from "./palette-sampler.js";
import { selectPalette } from "./palette-policy.js";

export { colorDistance, rgbToHex } from "./color.js";

export async function createDeterministicPalette(
  flagSvgText
) {
  const sourceColors = await sampleFlagColors(
    flagSvgText
  );

  return selectPalette(sourceColors);
}
