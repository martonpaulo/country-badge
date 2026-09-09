export const SVG_SIZE = 1024;
const FLAG_BOX_WIDTH = 558;
const FLAG_BOX_HEIGHT = 351;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function textToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 0x8000;
  let binary = "";

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize)
    );
  }

  return btoa(binary);
}

// Encoding a flag is the expensive part of composing a badge, and the result
// only depends on the flag. Preparing it once per loaded country asset lets
// every later composition reuse it.
export function createFlagDataUri(flagSvgText) {
  return `data:image/svg+xml;base64,${textToBase64(flagSvgText)}`;
}

export function createBadgeSvg({
  code,
  countryName,
  flagSvgText,
  flagDataUri,
  backgroundHex,
  idPrefix = `badge-${code.toLowerCase()}`
}) {
  const flagX = (SVG_SIZE - FLAG_BOX_WIDTH) / 2;
  const flagY = (SVG_SIZE - FLAG_BOX_HEIGHT) / 2;
  const flagHref =
    flagDataUri ?? createFlagDataUri(flagSvgText);
  const titleId = `${idPrefix}-title`;
  const descriptionId = `${idPrefix}-description`;
  const shadowId = `${idPrefix}-flag-shadow`;

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${SVG_SIZE}"
  height="${SVG_SIZE}"
  viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}"
  role="img"
  aria-labelledby="${titleId} ${descriptionId}"
>
  <title id="${titleId}">${escapeXml(countryName)} country badge</title>
  <desc id="${descriptionId}">${escapeXml(code)} flag centered on a deterministic flag-inspired background.</desc>

  <defs>
    <filter
      id="${shadowId}"
      x="-35%"
      y="-45%"
      width="170%"
      height="190%"
      color-interpolation-filters="sRGB"
    >
      <feDropShadow
        dx="0"
        dy="24"
        stdDeviation="22"
        flood-color="#000000"
        flood-opacity="0.28"
      />
    </filter>
  </defs>

  <rect
    width="${SVG_SIZE}"
    height="${SVG_SIZE}"
    fill="${backgroundHex}"
  />

  <image
    href="${flagHref}"
    x="${flagX}"
    y="${flagY}"
    width="${FLAG_BOX_WIDTH}"
    height="${FLAG_BOX_HEIGHT}"
    preserveAspectRatio="xMidYMid meet"
    filter="url(#${shadowId})"
  />
</svg>`;
}

export function downloadSvg(fileName, svgText) {
  downloadBlob(
    fileName,
    new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8"
    })
  );
}

function downloadBlob(fileName, blob) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => URL.revokeObjectURL(objectUrl),
    0
  );
}

function loadSvgImage(svgText) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(
      new Blob([svgText], {
        type: "image/svg+xml"
      })
    );

    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error("The SVG could not be prepared for image export.")
      );
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    if (!canvas.toBlob) {
      reject(
        new Error("Image export is not supported in this browser.")
      );
      return;
    }

    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("The image file could not be created.")
          );
        }
      },
      mimeType,
      quality
    );
  });
}

export async function downloadRasterizedSvg({
  fileName,
  svgText,
  mimeType,
  quality = 0.92
}) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Canvas is not available in this browser."
    );
  }

  canvas.width = SVG_SIZE;
  canvas.height = SVG_SIZE;

  const image = await loadSvgImage(svgText);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SVG_SIZE, SVG_SIZE);
  context.drawImage(image, 0, 0, SVG_SIZE, SVG_SIZE);

  const blob = await canvasToBlob(
    canvas,
    mimeType,
    quality
  );

  downloadBlob(fileName, blob);
}

export async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  // The deprecated fallback reports failure through its return value, so a
  // false result must not resolve as a copy, and the temporary node has to go
  // on every exit path.
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  try {
    document.body.append(textarea);
    textarea.select();

    if (document.execCommand("copy") !== true) {
      throw new Error(
        "The SVG could not be copied in this browser."
      );
    }
  } finally {
    textarea.remove();
  }
}
