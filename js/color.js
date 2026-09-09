// Pure sRGB color math shared by the flag sampler and the palette policy.
// Nothing here touches the DOM.

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function srgbToLinear(channel) {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab({ r, g, b }) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);

  const l =
    0.4122214708 * red +
    0.5363325363 * green +
    0.0514459929 * blue;

  const m =
    0.2119034982 * red +
    0.6806995451 * green +
    0.1073969566 * blue;

  const s =
    0.0883024619 * red +
    0.2817188376 * green +
    0.6299787005 * blue;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l:
      0.2104542553 * lRoot +
      0.793617785 * mRoot -
      0.0040720468 * sRoot,
    a:
      1.9779984951 * lRoot -
      2.428592205 * mRoot +
      0.4505937099 * sRoot,
    b:
      0.0259040371 * lRoot +
      0.7827717662 * mRoot -
      0.808675766 * sRoot
  };
}


function channelToHex(channel) {
  return channel.toString(16).padStart(2, "0");
}

export function rgbToHex({ r, g, b }) {
  return (
    "#" +
    channelToHex(r) +
    channelToHex(g) +
    channelToHex(b)
  ).toUpperCase();
}

export function hexToRgb(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}

export function colorDistance(first, second) {
  const firstLab = rgbToOklab(first);
  const secondLab = rgbToOklab(second);

  return Math.hypot(
    firstLab.l - secondLab.l,
    firstLab.a - secondLab.a,
    firstLab.b - secondLab.b
  );
}

export function rgbDistance(first, second) {
  return Math.hypot(
    (first.r - second.r) / 255,
    (first.g - second.g) / 255,
    (first.b - second.b) / 255
  );
}

export function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;

  if (maximum === minimum) {
    return {
      h: 0,
      s: 0,
      l: lightness
    };
  }

  const delta = maximum - minimum;
  const saturation =
    lightness > 0.5
      ? delta / (2 - maximum - minimum)
      : delta / (maximum + minimum);

  let hue;

  if (maximum === red) {
    hue =
      (green - blue) / delta +
      (green < blue ? 6 : 0);
  } else if (maximum === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    h: hue * 60,
    s: saturation,
    l: lightness
  };
}

function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(
    firstLuminance,
    secondLuminance
  );
  const darker = Math.min(
    firstLuminance,
    secondLuminance
  );

  return (lighter + 0.05) / (darker + 0.05);
}
