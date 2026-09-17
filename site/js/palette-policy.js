// Curated palette selection policy. This module is DOM-free: it takes source
// colors sampled from a flag and decides which three curated colors represent
// it, so every branch can be exercised from controlled input.
import {
  clamp,
  colorDistance,
  contrastRatio,
  hexToRgb,
  rgbDistance,
  rgbToHsl,
} from "./color.js";

const PALETTE_SIZE = 3;

const OPTION_NAMES = ["Option 1", "Option 2", "Option 3"];

const OUTPUT_COLORS = [
  { hex: "#FDF2F8", family: "pink", tone: "tint" },
  { hex: "#EFF6FF", family: "blue", tone: "tint" },
  { hex: "#E0F2FE", family: "sky", tone: "tint" },
  { hex: "#ECFEFF", family: "cyan", tone: "tint" },
  { hex: "#F0FDF4", family: "green", tone: "tint" },
  { hex: "#FEFCE8", family: "gold", tone: "tint" },
  { hex: "#FFF1F2", family: "red", tone: "tint" },
  { hex: "#FFF7ED", family: "coral", tone: "tint" },
  { hex: "#FCA5A5", family: "red", tone: "soft" },
  { hex: "#F87171", family: "red", tone: "clear" },
  { hex: "#EF4444", family: "red", tone: "clear" },
  { hex: "#DC2626", family: "red", tone: "deep" },
  { hex: "#B91C1C", family: "red", tone: "deep" },
  { hex: "#FB7185", family: "rose", tone: "clear" },
  { hex: "#E11D48", family: "rose", tone: "deep" },
  { hex: "#FB7A57", family: "coral", tone: "clear" },
  { hex: "#F97316", family: "coral", tone: "clear" },
  { hex: "#FEF3C7", family: "gold", tone: "soft" },
  { hex: "#FDE68A", family: "gold", tone: "soft" },
  { hex: "#FACC15", family: "gold", tone: "clear" },
  { hex: "#EAB308", family: "gold", tone: "clear" },
  { hex: "#F59E0B", family: "gold", tone: "clear" },
  { hex: "#D97706", family: "gold", tone: "deep" },
  { hex: "#D9F99D", family: "lime", tone: "soft" },
  { hex: "#A3E635", family: "lime", tone: "clear" },
  { hex: "#65A30D", family: "lime", tone: "deep" },
  { hex: "#BBF7D0", family: "green", tone: "soft" },
  { hex: "#4ADE80", family: "green", tone: "clear" },
  { hex: "#22C55E", family: "green", tone: "clear" },
  { hex: "#16A34A", family: "green", tone: "deep" },
  { hex: "#15803D", family: "green", tone: "deep" },
  { hex: "#CCFBF1", family: "teal", tone: "soft" },
  { hex: "#2DD4BF", family: "teal", tone: "clear" },
  { hex: "#0D9488", family: "teal", tone: "deep" },
  { hex: "#22D3EE", family: "cyan", tone: "clear" },
  { hex: "#0891B2", family: "cyan", tone: "deep" },
  { hex: "#BFDBFE", family: "blue", tone: "soft" },
  { hex: "#93C5FD", family: "blue", tone: "soft" },
  { hex: "#60A5FA", family: "blue", tone: "clear" },
  {
    hex: "#3B82F6",
    family: "blue",
    tone: "clear",
    // The neutral fallback source color. Owning it here keeps the fallback
    // from drifting away from the curated catalog.
    fallback: true,
  },
  { hex: "#2563EB", family: "blue", tone: "deep" },
  { hex: "#1D4ED8", family: "blue", tone: "deep" },
  { hex: "#0369A1", family: "sky", tone: "deep" },
  { hex: "#EDE9FE", family: "violet", tone: "tint" },
  { hex: "#A78BFA", family: "violet", tone: "clear" },
  { hex: "#7C3AED", family: "violet", tone: "deep" },
  { hex: "#FBCFE8", family: "pink", tone: "soft" },
  { hex: "#DB2777", family: "pink", tone: "deep" },
];

const FAMILY_ALTERNATES = {
  red: ["red", "rose", "coral"],
  rose: ["rose", "red", "pink"],
  coral: ["coral", "red", "gold"],
  gold: ["gold"],
  lime: ["lime", "green", "gold"],
  green: ["green", "lime", "teal"],
  teal: ["teal", "green", "cyan"],
  cyan: ["cyan", "sky", "teal"],
  sky: ["sky", "blue", "cyan"],
  blue: ["blue", "sky", "cyan"],
  violet: ["violet", "blue", "pink"],
  pink: ["pink", "rose", "violet"],
};

const FAMILY_TONE_PLAN = {
  red: ["clear", "deep", "soft", "tint"],
  rose: ["clear", "deep", "soft", "tint"],
  coral: ["clear", "soft", "tint"],
  gold: ["clear", "soft", "deep", "tint"],
  lime: ["clear", "soft", "deep", "tint"],
  green: ["clear", "deep", "soft", "tint"],
  teal: ["clear", "deep", "soft", "tint"],
  cyan: ["clear", "deep", "soft", "tint"],
  sky: ["tint", "clear", "deep", "soft"],
  blue: ["clear", "deep", "soft", "tint"],
  violet: ["clear", "deep", "tint"],
  pink: ["soft", "deep", "clear", "tint"],
};

const FAMILY_ORDER = [
  "red",
  "rose",
  "coral",
  "gold",
  "lime",
  "green",
  "teal",
  "cyan",
  "sky",
  "blue",
  "violet",
  "pink",
];

function familyFromRgb(rgb) {
  const hsl = rgbToHsl(rgb);

  if (hsl.s < 0.12) {
    return hsl.l > 0.72 ? "light" : "dark";
  }

  const hue = hsl.h;

  if (hue >= 345 || hue < 12) {
    return "red";
  }

  if (hue < 28) {
    return "coral";
  }

  if (hue < 72) {
    return "gold";
  }

  if (hue < 102) {
    return "lime";
  }

  if (hue < 162) {
    return "green";
  }

  if (hue < 185) {
    return "teal";
  }

  if (hue < 205) {
    return "cyan";
  }

  if (hue < 225) {
    return "sky";
  }

  if (hue < 265) {
    return "blue";
  }

  if (hue < 305) {
    return "violet";
  }

  if (hue < 340) {
    return "pink";
  }

  return "rose";
}

function familyGroup(family) {
  if (["red", "rose", "coral"].includes(family)) {
    return "red";
  }

  if (["green", "lime", "teal"].includes(family)) {
    return "green";
  }

  if (["blue", "sky", "cyan"].includes(family)) {
    return "blue";
  }

  return family;
}

function familySortIndex(family) {
  const index = FAMILY_ORDER.indexOf(family);

  return index === -1 ? FAMILY_ORDER.length : index;
}

const CURATED_PALETTE = OUTPUT_COLORS.map((color, index) => {
  const rgb = hexToRgb(color.hex);

  return {
    ...color,
    id: index,
    rgb,
    hsl: rgbToHsl(rgb),
  };
});

const FALLBACK_SOURCE_COLOR = CURATED_PALETTE.find((color) => color.fallback);

// Source colors arrive as raw observations: a color and how much of the flag
// it covers. Normalizing the weights and classifying the family are policy
// decisions, so a sampler never has to know about either.
export function normalizeSourceColors(sourceColors) {
  if (!Array.isArray(sourceColors)) {
    return [];
  }

  const observed = sourceColors.filter(
    (source) =>
      source?.rgb && Number.isFinite(source.weight) && source.weight > 0,
  );

  const totalWeight = observed.reduce((sum, source) => sum + source.weight, 0);

  if (totalWeight <= 0) {
    return [];
  }

  return observed.map((source) => ({
    rgb: source.rgb,
    hsl: rgbToHsl(source.rgb),
    family: familyFromRgb(source.rgb),
    weight: source.weight / totalWeight,
  }));
}

function buildFamilyWeights(sourceColors) {
  const weights = new Map();
  let lightWeight = 0;

  for (const source of sourceColors) {
    const family = source.family;

    if (family === "light") {
      lightWeight += source.weight;
      continue;
    }

    if (family === "dark") {
      continue;
    }

    const accentFloor =
      source.hsl.s > 0.42 && source.weight > 0.006 ? 0.035 : 0;

    weights.set(
      family,
      (weights.get(family) ?? 0) +
        source.weight * (0.65 + source.hsl.s * 0.95) +
        accentFloor,
    );
  }

  return {
    weights,
    lightWeight,
  };
}

function sortFamilyWeights(first, second) {
  return (
    second[1] - first[1] ||
    familySortIndex(first[0]) - familySortIndex(second[0])
  );
}

function targetFamiliesFor(sourceColors) {
  const { weights, lightWeight } = buildFamilyWeights(sourceColors);

  const sortedFamilies = [...weights.entries()].sort(sortFamilyWeights);

  let targets = sortedFamilies
    .filter(([, weight]) => weight >= 0.055)
    .map(([family]) => family);

  const accentFamilies = sortedFamilies
    .filter(([, weight]) => weight >= 0.025)
    .map(([family]) => family);

  for (const family of accentFamilies) {
    if (!targets.includes(family)) {
      targets.push(family);
    }
  }

  const collapsedTargets = [];

  for (const family of targets) {
    const group = familyGroup(family);
    const hasGroup = collapsedTargets.some(
      (existing) => familyGroup(existing) === group,
    );

    if (!hasGroup) {
      collapsedTargets.push(family);
    } else if (
      collapsedTargets.length < PALETTE_SIZE &&
      ["red", "blue"].includes(group) &&
      !collapsedTargets.includes(family)
    ) {
      collapsedTargets.push(family);
    }
  }

  targets = collapsedTargets;

  if (targets.length === 0) {
    return ["blue:tint", "gold", "green"];
  }

  if (targets.length === 1) {
    const family = targets[0];
    const related =
      FAMILY_ALTERNATES[family]?.find((alternate) => alternate !== family) ??
      family;

    targets.push(related);

    if (lightWeight > 0.12) {
      targets.push(`${family}:tint`);
    } else {
      targets.push(`${related}:soft`);
    }
  } else if (targets.length === 2 && lightWeight > 0.18) {
    const lightFamily = targets.some((family) =>
      ["blue", "sky", "cyan"].includes(family),
    )
      ? "blue"
      : targets[0];

    targets.push(`${lightFamily}:tint`);
  }

  return targets.slice(0, PALETTE_SIZE);
}

function candidateRepresentatives(sourceColors, baseFamily) {
  const allowedFamilies = FAMILY_ALTERNATES[baseFamily] ?? [baseFamily];

  return sourceColors.filter((source) =>
    allowedFamilies.includes(source.family),
  );
}

function scoreCandidate({
  candidate,
  baseFamily,
  forcedTone,
  familyWeights,
  representatives,
  selected,
}) {
  const tonePlan = forcedTone
    ? [forcedTone]
    : (FAMILY_TONE_PLAN[baseFamily] ?? ["clear", "soft", "deep", "tint"]);

  const toneIndex = tonePlan.indexOf(candidate.tone);
  const toneBonus = toneIndex >= 0 ? 0.34 - toneIndex * 0.065 : 0;

  const exactFamilyBonus = candidate.family === baseFamily ? 0.32 : 0;

  const familyWeight = familyWeights.weights.get(baseFamily) ?? 0;

  const sourceDistanceScore =
    representatives.length > 0
      ? representatives.reduce(
          (sum, source) =>
            sum +
            source.weight *
              Math.max(0, 1 - rgbDistance(candidate.rgb, source.rgb)),
          0,
        )
      : 0;

  const contrastScore = representatives.reduce(
    (sum, source) =>
      sum +
      source.weight *
        clamp(contrastRatio(candidate.rgb, source.rgb) / 4.8, 0, 1),
    0,
  );

  const selectedPenalty = selected.reduce((penalty, existing) => {
    const distance = colorDistance(existing.rgb, candidate.rgb);

    if (distance < 0.105) {
      return penalty + 1.1;
    }

    if (distance < 0.15) {
      return penalty + 0.35;
    }

    return penalty;
  }, 0);

  const tintPenalty =
    candidate.tone === "tint" &&
    selected.some((option) => option.tone === "tint")
      ? 1.1
      : 0;

  return (
    exactFamilyBonus +
    toneBonus +
    familyWeight * 0.4 +
    sourceDistanceScore * 0.22 +
    contrastScore * 0.12 -
    selectedPenalty -
    tintPenalty
  );
}

function pickCandidate({ target, sourceColors, familyWeights, selected }) {
  const [baseFamily, forcedTone] = target.split(":");
  const allowedFamilies = FAMILY_ALTERNATES[baseFamily] ?? [baseFamily];
  const representatives = candidateRepresentatives(sourceColors, baseFamily);

  let candidates = CURATED_PALETTE.filter(
    (candidate) =>
      allowedFamilies.includes(candidate.family) &&
      !selected.some((option) => option.hex === candidate.hex),
  );

  if (forcedTone) {
    const toneMatches = candidates.filter(
      (candidate) => candidate.tone === forcedTone,
    );

    if (toneMatches.length > 0) {
      candidates = toneMatches;
    }
  }

  if (candidates.length === 0) {
    candidates = CURATED_PALETTE.filter(
      (candidate) => !selected.some((option) => option.hex === candidate.hex),
    );
  }

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate({
        candidate,
        baseFamily,
        forcedTone,
        familyWeights,
        representatives,
        selected,
      }),
    }))
    .sort(
      (first, second) => second.score - first.score || first.id - second.id,
    )[0];
}

function selectCuratedPalette(sourceColors) {
  const safeSourceColors =
    sourceColors.length > 0
      ? sourceColors
      : [
          {
            rgb: FALLBACK_SOURCE_COLOR.rgb,
            hsl: FALLBACK_SOURCE_COLOR.hsl,
            family: FALLBACK_SOURCE_COLOR.family,
            weight: 1,
          },
        ];

  const targets = targetFamiliesFor(safeSourceColors);
  const familyWeights = buildFamilyWeights(safeSourceColors);
  const selected = [];

  for (const target of targets) {
    const candidate = pickCandidate({
      target,
      sourceColors: safeSourceColors,
      familyWeights,
      selected,
    });

    if (candidate) {
      selected.push(candidate);
    }
  }

  while (selected.length < PALETTE_SIZE) {
    const fallbackTarget = selected[0]?.family
      ? `${selected[0].family}:tint`
      : "blue:tint";
    const candidate = pickCandidate({
      target: fallbackTarget,
      sourceColors: safeSourceColors,
      familyWeights,
      selected,
    });

    if (!candidate) {
      break;
    }

    selected.push(candidate);
  }

  return selected.slice(0, PALETTE_SIZE);
}

// The one entry point policy exposes. Source colors carry a raw positive
// weight; normalization, family classification, and the neutral fallback are
// policy decisions, so a caller only has to report what it saw.
export function selectPalette(sourceColors) {
  return selectCuratedPalette(normalizeSourceColors(sourceColors)).map(
    (option, index) => ({
      id: index + 1,
      label: OPTION_NAMES[index],
      hex: option.hex,
      rgb: option.rgb,
    }),
  );
}
