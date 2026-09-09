import {
  fetchCountryCatalog
} from "./country-service.js";

import {
  getDefaultSuggestions,
  normalizeSearch,
  searchCountries
} from "./countries.js";

import {
  fetchFlagSvg
} from "./flag-service.js";

import {
  createDeterministicPalette
} from "./palette.js";

import {
  copyText,
  createBadgeSvg,
  createFlagDataUri,
  downloadRasterizedSvg,
  downloadSvg
} from "./svg.js";

const MAX_SUGGESTIONS = 8;

const PALETTE_INPUT_NAME = "badge-background";
const RECENT_COUNTRIES_KEY =
  "country-badge-generator.recent-countries.v1";

const OUTPUT_FORMATS = {
  svg: {
    extension: "svg",
    label: "SVG",
    mimeType: "image/svg+xml"
  },
  png: {
    extension: "png",
    label: "PNG",
    mimeType: "image/png"
  },
  jpg: {
    extension: "jpg",
    label: "JPG",
    mimeType: "image/jpeg",
    quality: 0.92
  }
};

const elements = {
  input: document.querySelector("#country-search"),
  clearButton: document.querySelector("#clear-search"),
  countryOptions: document.querySelector("#country-options"),
  countryStatus: document.querySelector("#country-status"),
  countryRetry: document.querySelector("#country-retry"),
  paletteOptions: document.querySelector("#palette-options"),
  paletteCountryCode: document.querySelector("#palette-country-code"),
  selectedCountry: document.querySelector("#selected-country"),
  selectedColor: document.querySelector("#selected-color"),
  selectedSwatch: document.querySelector("#selected-swatch"),
  outputName: document.querySelector("#output-name"),
  formatOptions: document.querySelector("#format-options"),
  downloadButton: document.querySelector("#download-button"),
  downloadLabel: document.querySelector("#download-label"),
  copyButton: document.querySelector("#copy-button"),
  status: document.querySelector("#status-message"),
  preview: document.querySelector("#preview-canvas"),
  previewEmpty: document.querySelector("#preview-empty"),
  loadingState: document.querySelector("#loading-state")
};

const state = {
  catalog: [],
  catalogReady: false,
  catalogAttemptId: 0,
  catalogLoading: false,
  catalogRetryHadFocus: false,
  countrySuggestions: [],
  activeSuggestionIndex: -1,
  suggestionGestureActive: false,
  noResultsStatus: "",
  selectedCountry: null,
  flagSvgText: "",
  flagDataUri: "",
  flagObjectUrl: "",
  palette: [],
  selectedPaletteIndex: 0,
  selectedSvg: "",
  outputFormat: "svg",
  outputFileName: "",
  requestId: 0,
  generation: { status: "idle", country: null, message: "" },
  paletteRetryHadFocus: false,
  countryCache: new Map(),
  activeAssetController: null
};

function setMessage(element, message, stateName = "") {
  element.textContent = message;

  if (stateName) {
    element.dataset.state = stateName;
  } else {
    delete element.dataset.state;
  }
}

function setStatus(message, stateName = "") {
  setMessage(elements.status, message, stateName);
}

function setCountryStatus(message, stateName = "") {
  setMessage(elements.countryStatus, message, stateName);
}

function setInputInvalid(isInvalid) {
  elements.input.setAttribute(
    "aria-invalid",
    String(isInvalid)
  );
}

// Palette generation has one state owner. Selection, cancellation, completion,
// and retry all publish through it, so the overlay, the palette section, the
// export actions, and the status can never disagree about what is happening.
function setGenerationState(
  status,
  { country = null, message = "" } = {}
) {
  state.generation = { status, country, message };

  const isLoading = status === "loading";
  const hasOutput =
    status === "ready" && Boolean(state.selectedSvg);

  elements.loadingState.hidden = !isLoading;
  elements.loadingState.setAttribute(
    "aria-hidden",
    String(!isLoading)
  );

  elements.downloadButton.disabled = !hasOutput;
  elements.copyButton.disabled = !hasOutput;

  if (status === "ready") {
    state.paletteRetryHadFocus = false;
    return;
  }

  renderPaletteNotice(status, country, message);
}

function getOutputFormat() {
  return (
    OUTPUT_FORMATS[state.outputFormat] ??
    OUTPUT_FORMATS.svg
  );
}

function refreshOutputDetails() {
  const format = getOutputFormat();

  elements.formatOptions
    .querySelectorAll(".format-option")
    .forEach(option => {
      const input = option.querySelector(
        'input[name="output-format"]'
      );

      if (input) {
        input.checked =
          input.value === state.outputFormat;
      }
    });

  elements.downloadLabel.textContent =
    `Download ${format.label}`;

  if (!state.selectedCountry) {
    state.outputFileName = "";
    elements.outputName.textContent = "--";
    return;
  }

  state.outputFileName =
    `${state.selectedCountry.code}.${format.extension}`;

  elements.outputName.textContent =
    state.outputFileName;
}

function removeRenderedPreview() {
  elements.preview
    .querySelector(":scope > svg")
    ?.remove();
}

// Progress and failure are rendered at the point of action, inside the palette
// section, so they are never pushed below the viewport on a narrow screen.
function renderPaletteNotice(status, country, message) {
  const notice = document.createElement("div");

  // Re-rendering the section removes the control the user activated, so a
  // repeated failure gives focus back to the replacement, and only when the
  // previous control still owned it.
  let restoreRetryFocus = false;

  notice.className = "palette-notice";
  notice.dataset.state = status;

  if (status === "loading") {
    const spinner = document.createElement("span");
    const label = document.createElement("span");

    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    label.textContent = `Building ${country.name}'s palette...`;

    notice.append(spinner, label);
  } else if (status === "error") {
    const label = document.createElement("span");
    const retry = document.createElement("button");

    label.textContent = message;

    retry.type = "button";
    retry.id = "palette-retry";
    retry.className = "button button-secondary";
    retry.textContent = "Try again";

    notice.append(label, retry);

    restoreRetryFocus = state.paletteRetryHadFocus;
    state.paletteRetryHadFocus = false;
  } else {
    notice.textContent =
      "Select a country to generate its palette.";
    state.paletteRetryHadFocus = false;
  }

  elements.paletteOptions.replaceChildren(notice);

  // Removing the previous control is what dropped focus to the body, so only
  // that case is given focus back; focus the user moved elsewhere is left be.
  if (
    restoreRetryFocus &&
    document.activeElement === document.body
  ) {
    notice.querySelector("#palette-retry")?.focus();
  }
}

function clearGeneratedOutput() {
  state.flagSvgText = "";
  setFlagObjectUrl("");
  state.flagDataUri = "";
  state.palette = [];
  state.selectedPaletteIndex = 0;
  state.selectedSvg = "";

  removeRenderedPreview();

  elements.previewEmpty.hidden = false;
  elements.paletteCountryCode.textContent = "--";
  elements.selectedColor.textContent = "--";
  elements.selectedSwatch.style.backgroundColor =
    "transparent";
  elements.downloadButton.disabled = true;
  elements.copyButton.disabled = true;
  refreshOutputDetails();
}

function getRecentCodes() {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(RECENT_COUNTRIES_KEY) ??
        "[]"
    );

    return Array.isArray(parsed)
      ? parsed.filter(code => /^[A-Z]{2}$/.test(code))
      : [];
  } catch {
    return [];
  }
}

function rememberCountry(code) {
  try {
    const recent = [
      code,
      ...getRecentCodes().filter(
        recentCode => recentCode !== code
      )
    ].slice(0, MAX_SUGGESTIONS);

    sessionStorage.setItem(
      RECENT_COUNTRIES_KEY,
      JSON.stringify(recent)
    );
  } catch {
    // Recent suggestions are optional and should not block generation.
  }
}

function abortActiveAssetRequest() {
  state.activeAssetController?.abort();
  state.activeAssetController = null;
}

function clearSelection({ focusInput = false } = {}) {
  state.requestId += 1;
  abortActiveAssetRequest();
  state.selectedCountry = null;
  state.activeSuggestionIndex = -1;

  elements.input.value = "";
  elements.selectedCountry.textContent = "None";
  elements.clearButton.hidden = true;

  setInputInvalid(false);
  closeCountrySuggestions();
  clearGeneratedOutput();
  setGenerationState("idle");
  setStatus("Choose a country to begin.");
  setCountryStatus(
    state.catalogReady
      ? "Countries loaded."
      : "Loading countries..."
  );

  if (focusInput) {
    elements.input.focus();
    updateCountrySuggestions();
  }
}

function openCountrySuggestions() {
  elements.countryOptions.hidden = false;
  elements.input.setAttribute(
    "aria-expanded",
    "true"
  );
}

function closeCountrySuggestions() {
  elements.countryOptions.hidden = true;
  elements.input.setAttribute(
    "aria-expanded",
    "false"
  );
  elements.input.removeAttribute(
    "aria-activedescendant"
  );

  state.activeSuggestionIndex = -1;
}

function getRenderedOptions() {
  return [
    ...elements.countryOptions.querySelectorAll(
      '[role="option"]'
    )
  ];
}

function setActiveCountrySuggestion(index) {
  const options = getRenderedOptions();

  if (options.length === 0) {
    elements.input.removeAttribute(
      "aria-activedescendant"
    );
    state.activeSuggestionIndex = -1;
    return;
  }

  state.activeSuggestionIndex = Math.max(
    0,
    Math.min(index, options.length - 1)
  );

  options.forEach((option, optionIndex) => {
    option.setAttribute(
      "aria-selected",
      String(
        optionIndex ===
          state.activeSuggestionIndex
      )
    );
  });

  const activeOption =
    options[state.activeSuggestionIndex];

  activeOption.scrollIntoView({
    block: "nearest"
  });

  elements.input.setAttribute(
    "aria-activedescendant",
    activeOption.id
  );
}

function renderNoResults() {
  const item = document.createElement("li");
  item.className = "country-no-results";
  item.textContent = "No countries found.";

  elements.countryOptions.append(item);
  openCountrySuggestions();
}

// The visible empty-state item lives in the listbox, which is not a live
// region, so the field-associated status stays the single announcement owner.
// Restoring only the exact message this function published keeps a selection,
// a failure, or a retry status from being clobbered.
function updateSearchResultStatus() {
  const query = elements.input.value.trim();

  if (
    normalizeSearch(query) &&
    state.countrySuggestions.length === 0
  ) {
    state.noResultsStatus = `No countries found for “${query}”.`;
    setCountryStatus(
      state.noResultsStatus,
      "warning"
    );
    return;
  }

  if (
    state.noResultsStatus &&
    elements.countryStatus.textContent ===
      state.noResultsStatus
  ) {
    setCountryStatus(
      "Countries loaded.",
      "success"
    );
  }

  state.noResultsStatus = "";
}

function renderCountrySuggestions() {
  elements.countryOptions.replaceChildren();
  state.activeSuggestionIndex = -1;
  elements.input.removeAttribute(
    "aria-activedescendant"
  );

  if (state.countrySuggestions.length === 0) {
    if (normalizeSearch(elements.input.value)) {
      renderNoResults();
    } else {
      closeCountrySuggestions();
    }

    return;
  }

  const fragment =
    document.createDocumentFragment();

  state.countrySuggestions.forEach(
    (country, index) => {
      const option =
        document.createElement("li");

      const flag =
        document.createElement("span");

      const name =
        document.createElement("span");

      const code =
        document.createElement("span");

      option.id = `country-option-${country.code}`;
      option.className = "country-option";
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        "false"
      );
      option.dataset.index = String(index);

      flag.className = "country-option-flag";
      flag.textContent = country.emoji;
      flag.setAttribute("aria-hidden", "true");

      name.className = "country-option-name";
      name.textContent = country.name;

      code.className = "country-option-code";
      code.textContent = country.code;

      option.append(flag, name, code);
      fragment.append(option);
    }
  );

  elements.countryOptions.append(fragment);
  openCountrySuggestions();
}

function updateCountrySuggestions({
  activateFirst = false
} = {}) {
  if (!state.catalogReady) {
    return;
  }

  const query = elements.input.value;

  state.countrySuggestions = normalizeSearch(query)
    ? searchCountries(
        state.catalog,
        query,
        MAX_SUGGESTIONS
      )
    : getDefaultSuggestions(
        state.catalog,
        getRecentCodes(),
        MAX_SUGGESTIONS
      );

  renderCountrySuggestions();
  updateSearchResultStatus();

  if (
    activateFirst &&
    state.countrySuggestions.length > 0
  ) {
    setActiveCountrySuggestion(0);
  }
}

// The three colors are one exclusive choice, so they are native radios in a
// named group: assistive technology gets the `1 of 3` model and arrow-key
// navigation for free. Each thumbnail repeats the main preview, so it stays
// decorative and the preview remains the one meaningful badge image.
// One runtime flag resource per selected country. Replacing it revokes the
// previous URL, so nothing accumulates across countries.
function setFlagObjectUrl(flagSvgText) {
  if (state.flagObjectUrl) {
    URL.revokeObjectURL(state.flagObjectUrl);
    state.flagObjectUrl = "";
  }

  if (flagSvgText) {
    state.flagObjectUrl = URL.createObjectURL(
      new Blob([flagSvgText], {
        type: "image/svg+xml"
      })
    );
  }
}

function createThumbnailFlag() {
  const flag = document.createElement("img");

  flag.className = "palette-thumbnail-flag";
  flag.alt = "";
  flag.decoding = "async";
  flag.src = state.flagObjectUrl;

  return flag;
}

function renderPalette() {
  const choices = document.createElement("div");

  choices.className = "palette-choices";
  choices.setAttribute("role", "radiogroup");
  choices.setAttribute(
    "aria-labelledby",
    "palette-title"
  );

  state.palette.forEach((option, index) => {
    const card = document.createElement("label");
    const input = document.createElement("input");
    const thumbnail =
      document.createElement("span");

    const meta =
      document.createElement("span");

    const label =
      document.createElement("span");

    const hex =
      document.createElement("span");

    card.className = "choice-card palette-option";

    input.type = "radio";
    input.name = PALETTE_INPUT_NAME;
    input.value = String(index);
    input.checked =
      index === state.selectedPaletteIndex;

    // A thumbnail is decorative, so it renders the background and the shared
    // runtime flag resource instead of carrying its own export-grade payload.
    thumbnail.className = "palette-thumbnail";
    thumbnail.setAttribute("aria-hidden", "true");
    thumbnail.style.backgroundColor = option.hex;
    thumbnail.append(createThumbnailFlag());

    meta.className = "palette-meta";

    label.className = "palette-label";
    label.textContent = option.label;

    hex.className = "palette-hex";
    hex.textContent = option.hex;

    meta.append(label, hex);
    card.append(input, thumbnail, meta);
    choices.append(card);
  });

  elements.paletteOptions.replaceChildren(choices);
}

function getPaletteInputs() {
  return [
    ...elements.paletteOptions.querySelectorAll(
      `input[name="${PALETTE_INPUT_NAME}"]`
    )
  ];
}

function updateSelectedOption(index) {
  const option = state.palette[index];

  if (!option || !state.selectedCountry) {
    return;
  }

  state.selectedPaletteIndex = index;
  state.selectedSvg = createBadgeSvg({
    code: state.selectedCountry.code,
    countryName: state.selectedCountry.name,
    flagDataUri: state.flagDataUri,
    backgroundHex: option.hex,
    idPrefix:
      `download-${state.selectedCountry.code.toLowerCase()}`
  });

  removeRenderedPreview();
  elements.previewEmpty.hidden = true;
  elements.preview.insertAdjacentHTML(
    "afterbegin",
    state.selectedSvg
  );

  elements.selectedColor.textContent =
    option.hex;

  elements.selectedSwatch.style.backgroundColor =
    option.hex;

  refreshOutputDetails();

  getPaletteInputs().forEach(input => {
    input.checked = Number(input.value) === index;
  });

  setStatus(
    `${option.label} is selected.`,
    "success"
  );
}

async function loadCountryAssets(country, signal) {
  const cached =
    state.countryCache.get(country.code);

  if (cached) {
    return cached;
  }

  const flagSvgText = await fetchFlagSvg({
    countryCode: country.code,
    flagUrl: country.flagUrl,
    signal
  });

  if (signal.aborted) {
    throw new DOMException(
      "The request was cancelled.",
      "AbortError"
    );
  }

  const palette =
    await createDeterministicPalette(
      flagSvgText
    );

  if (signal.aborted) {
    throw new DOMException(
      "The request was cancelled.",
      "AbortError"
    );
  }

  const assets = {
    flagSvgText,
    // Encoded once per loaded country asset and reused by the thumbnails and
    // by every later export composition.
    flagDataUri: createFlagDataUri(flagSvgText),
    palette
  };

  state.countryCache.set(
    country.code,
    assets
  );

  return assets;
}

async function selectCountry(country) {
  rememberCountry(country.code);
  setInputInvalid(false);

  elements.input.value = country.name;
  elements.clearButton.hidden = false;

  closeCountrySuggestions();
  setCountryStatus(
    `${country.name} selected.`,
    "success"
  );

  await generatePalette(country);
}

// Separated from selection so a retry repeats the request without repeating
// the selection side effects, such as recording a recent country.
async function generatePalette(country) {
  const requestId = ++state.requestId;
  abortActiveAssetRequest();

  const controller = new AbortController();
  state.activeAssetController = controller;

  state.selectedCountry = country;
  state.selectedPaletteIndex = 0;

  clearGeneratedOutput();

  elements.selectedCountry.textContent =
    country.name;
  elements.paletteCountryCode.textContent =
    country.code;

  setGenerationState("loading", { country });
  setStatus(
    `Generating ${country.code} palette...`
  );

  try {
    const assets = await loadCountryAssets(
      country,
      controller.signal
    );

    if (requestId !== state.requestId) {
      return;
    }

    state.flagSvgText = assets.flagSvgText;
    state.flagDataUri = assets.flagDataUri;
    setFlagObjectUrl(assets.flagSvgText);
    state.palette = assets.palette;

    renderPalette();
    updateSelectedOption(0);
    setGenerationState("ready", { country });

    setStatus(
      `${country.code} palette is ready.`,
      "success"
    );
  } catch (error) {
    if (
      requestId !== state.requestId ||
      error?.name === "AbortError"
    ) {
      return;
    }

    clearGeneratedOutput();

    elements.paletteCountryCode.textContent =
      country.code;

    const message =
      error instanceof Error
        ? error.message
        : "The palette could not be generated.";

    setGenerationState("error", {
      country,
      message
    });
    setStatus(message, "error");
  } finally {
    if (requestId === state.requestId) {
      state.activeAssetController = null;
    }
  }
}

function selectCountrySuggestion(index) {
  const country =
    state.countrySuggestions[index];

  if (country) {
    selectCountry(country);
  }
}

function invalidateSelectedCountry() {
  if (!state.selectedCountry) {
    return;
  }

  state.requestId += 1;
  abortActiveAssetRequest();
  state.selectedCountry = null;
  elements.selectedCountry.textContent =
    "None";

  clearGeneratedOutput();
  setGenerationState("idle");
}

function handleCountryInput() {
  const normalizedInput =
    normalizeSearch(elements.input.value);

  const normalizedSelection =
    state.selectedCountry
      ? normalizeSearch(
          state.selectedCountry.name
        )
      : "";

  elements.clearButton.hidden =
    elements.input.value.length === 0;

  if (
    state.selectedCountry &&
    normalizedInput !== normalizedSelection
  ) {
    invalidateSelectedCountry();
    setStatus(
      "Select a listed country before generating a badge.",
      "warning"
    );
  }

  setInputInvalid(false);
  updateCountrySuggestions();
}

function handleFormatChange(event) {
  const format = event.target.closest(
    'input[name="output-format"]'
  );

  if (!format || !OUTPUT_FORMATS[format.value]) {
    return;
  }

  state.outputFormat = format.value;
  refreshOutputDetails();

  if (state.selectedCountry) {
    setStatus(
      `${getOutputFormat().label} is selected for download.`,
      "success"
    );
  }
}

async function downloadSelectedOutput() {
  if (
    !state.selectedSvg ||
    !state.outputFileName
  ) {
    return;
  }

  // Raster encoding is asynchronous and the user may pick the next format
  // while it runs, so the operation reports the file it actually captured
  // rather than whatever the controls hold when it settles.
  const operation = {
    format: getOutputFormat(),
    fileName: state.outputFileName,
    svgText: state.selectedSvg,
    isVector: state.outputFormat === "svg"
  };

  elements.downloadButton.disabled = true;

  try {
    if (operation.isVector) {
      downloadSvg(
        operation.fileName,
        operation.svgText
      );
    } else {
      setStatus(
        `Preparing ${operation.fileName}...`
      );

      await downloadRasterizedSvg({
        fileName: operation.fileName,
        svgText: operation.svgText,
        mimeType: operation.format.mimeType,
        quality: operation.format.quality
      });
    }

    setStatus(
      `Downloaded ${operation.fileName}.`,
      "success"
    );
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : `${operation.fileName} could not be downloaded in this browser.`,
      "error"
    );
  } finally {
    elements.downloadButton.disabled =
      !state.selectedSvg;
  }
}

function validateFreeText() {
  if (
    !state.selectedCountry &&
    normalizeSearch(elements.input.value)
  ) {
    setInputInvalid(true);
    setCountryStatus(
      "Select a listed country. Free text is not accepted.",
      "warning"
    );
    return false;
  }

  setInputInvalid(false);
  return true;
}

function handleCountryKeydown(event) {
  if (event.key === "ArrowDown") {
    event.preventDefault();

    if (elements.countryOptions.hidden) {
      updateCountrySuggestions();
    }

    setActiveCountrySuggestion(
      state.activeSuggestionIndex + 1
    );
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    if (elements.countryOptions.hidden) {
      updateCountrySuggestions();
    }

    setActiveCountrySuggestion(
      state.activeSuggestionIndex <= 0
        ? state.countrySuggestions.length - 1
        : state.activeSuggestionIndex - 1
    );
    return;
  }

  if (event.key === "Home" && !elements.countryOptions.hidden) {
    event.preventDefault();
    setActiveCountrySuggestion(0);
    return;
  }

  if (event.key === "End" && !elements.countryOptions.hidden) {
    event.preventDefault();
    setActiveCountrySuggestion(
      state.countrySuggestions.length - 1
    );
    return;
  }

  if (event.key === "Enter") {
    if (
      !elements.countryOptions.hidden &&
      state.countrySuggestions.length > 0
    ) {
      event.preventDefault();

      selectCountrySuggestion(
        state.activeSuggestionIndex >= 0
          ? state.activeSuggestionIndex
          : 0
      );
    }

    return;
  }

  if (event.key === "Escape") {
    closeCountrySuggestions();
    return;
  }

  if (event.key === "Tab") {
    closeCountrySuggestions();
    validateFreeText();
  }
}

function bindEvents() {
  elements.input.addEventListener(
    "input",
    handleCountryInput
  );

  elements.input.addEventListener(
    "focus",
    () => {
      updateCountrySuggestions();
    }
  );

  // A touch press on a suggestion blurs the input before the tap resolves, so
  // the pending selection, not the typed query, is what the blur should see.
  elements.input.addEventListener(
    "blur",
    () => {
      if (state.suggestionGestureActive) {
        return;
      }

      validateFreeText();
    }
  );

  elements.input.addEventListener(
    "keydown",
    handleCountryKeydown
  );

  elements.clearButton.addEventListener(
    "click",
    () => {
      clearSelection({
        focusInput: true
      });
    }
  );

  // Committing the selection on pointerdown would close the list before a
  // touch drag could scroll it, so the pointer path commits on click, which
  // the browser only fires once the gesture resolved as a tap. Cancelling the
  // press keeps focus in the input for the mouse path, but doing so on touch
  // would also suppress the tap's click, so touch keeps its default press and
  // the blur it causes is deferred to the resolved gesture instead.
  elements.countryOptions.addEventListener(
    "pointerdown",
    event => {
      if (
        !event.target.closest('[role="option"]')
      ) {
        return;
      }

      if (event.pointerType === "mouse") {
        event.preventDefault();
        return;
      }

      state.suggestionGestureActive = true;
    }
  );

  elements.countryOptions.addEventListener(
    "pointercancel",
    () => {
      state.suggestionGestureActive = false;
    }
  );

  elements.countryOptions.addEventListener(
    "click",
    event => {
      state.suggestionGestureActive = false;

      const option = event.target.closest(
        '[role="option"]'
      );

      if (!option) {
        return;
      }

      selectCountrySuggestion(
        Number(option.dataset.index)
      );
    }
  );

  elements.countryOptions.addEventListener(
    "pointermove",
    event => {
      const option = event.target.closest(
        '[role="option"]'
      );

      if (!option) {
        return;
      }

      setActiveCountrySuggestion(
        Number(option.dataset.index)
      );
    }
  );

  elements.paletteOptions.addEventListener(
    "click",
    event => {
      if (
        !event.target.closest("#palette-retry") ||
        !state.selectedCountry ||
        state.generation.status === "loading"
      ) {
        return;
      }

      state.paletteRetryHadFocus =
        document.activeElement ===
        event.target.closest("#palette-retry");

      generatePalette(state.selectedCountry);
    }
  );

  elements.paletteOptions.addEventListener(
    "change",
    event => {
      const input = event.target.closest(
        `input[name="${PALETTE_INPUT_NAME}"]`
      );

      if (!input) {
        return;
      }

      updateSelectedOption(Number(input.value));
    }
  );

  elements.countryRetry.addEventListener(
    "click",
    () => {
      loadCountryCatalog({ isRetry: true });
    }
  );

  elements.formatOptions.addEventListener(
    "change",
    handleFormatChange
  );

  elements.downloadButton.addEventListener(
    "click",
    downloadSelectedOutput
  );

  elements.copyButton.addEventListener(
    "click",
    async () => {
      if (!state.selectedSvg) {
        return;
      }

      try {
        await copyText(state.selectedSvg);

        setStatus(
          "SVG copied to the clipboard.",
          "success"
        );
      } catch {
        setStatus(
          "The SVG could not be copied in this browser.",
          "error"
        );
      }
    }
  );

  document.addEventListener(
    "pointerdown",
    event => {
      if (!event.target.closest(".combobox")) {
        closeCountrySuggestions();
      }
    }
  );
}

// Disabling the in-flight retry control drops focus to the body, so the
// attempt records whether focus was its own to give back when it settles.
function claimRetryFocus() {
  return document.activeElement === elements.countryRetry;
}

// True while nothing else holds focus: either the body received it when the
// retry control was disabled, or the control itself still has it.
function retryFocusIsUnclaimed() {
  const active = document.activeElement;

  return (
    !active ||
    active === document.body ||
    active === elements.countryRetry
  );
}

function applyCatalogAttemptState(isRetry) {
  state.catalogReady = false;
  state.catalog = [];
  elements.input.disabled = true;

  state.catalogRetryHadFocus = claimRetryFocus();

  // A failed attempt keeps its control on screen so the retry stays discoverable.
  elements.countryRetry.hidden = !isRetry;
  elements.countryRetry.disabled = true;

  const message = isRetry
    ? "Retrying the country list..."
    : "Loading countries...";

  setCountryStatus(message);
  setStatus(message);
}

function applyCatalogReadyState(catalog, shouldRestoreFocus) {
  state.catalog = catalog;
  state.catalogReady = true;

  elements.countryRetry.hidden = true;
  elements.countryRetry.disabled = false;
  elements.input.disabled = false;

  setCountryStatus(
    "Countries loaded.",
    "success"
  );
  setStatus("Choose a country to begin.");

  if (shouldRestoreFocus) {
    elements.input.focus();
  }
}

function applyCatalogErrorState(error, shouldRestoreFocus) {
  state.catalog = [];
  state.catalogReady = false;
  elements.input.disabled = true;

  elements.countryRetry.hidden = false;
  elements.countryRetry.disabled = false;

  setCountryStatus(
    error instanceof Error
      ? error.message
      : "The country list could not be loaded.",
    "error"
  );
  setStatus(
    "Country search is unavailable until the country list loads.",
    "error"
  );

  if (shouldRestoreFocus) {
    elements.countryRetry.focus();
  }
}

// A retry only takes focus back when the user has not moved it elsewhere
// while the request was in flight.
function shouldRestoreRetryFocus() {
  return state.catalogRetryHadFocus && retryFocusIsUnclaimed();
}

async function loadCountryCatalog({ isRetry = false } = {}) {
  if (state.catalogLoading) {
    return;
  }

  state.catalogLoading = true;
  state.catalogAttemptId += 1;

  const attemptId = state.catalogAttemptId;

  applyCatalogAttemptState(isRetry);

  try {
    const catalog = await fetchCountryCatalog();

    if (attemptId !== state.catalogAttemptId) {
      return;
    }

    applyCatalogReadyState(catalog, shouldRestoreRetryFocus());
  } catch (error) {
    if (attemptId !== state.catalogAttemptId) {
      return;
    }

    applyCatalogErrorState(error, shouldRestoreRetryFocus());
  } finally {
    if (attemptId === state.catalogAttemptId) {
      state.catalogLoading = false;
    }
  }
}

async function initialize() {
  bindEvents();
  clearGeneratedOutput();
  setGenerationState("idle");

  await loadCountryCatalog();
}

initialize();
