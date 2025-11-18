import { CriticalError, RefineSuggestion } from "../types/messages";

const OVERLAY_ROOT_ID = "refine-overlay";
const GHOST_TEXT_ID = "refine-ghost-text";
const SUGGESTIONS_ID = "refine-suggestions";
const CRITICAL_ERRORS_ID = "refine-critical-errors";

/** Ensures the overlay root exists on the page. */
function ensureOverlayRoot(): HTMLElement {
  let root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Placeholder for rendering ghost text inline with the textbox.
 * TODO: replace this with sophisticated inline rendering anchored to the caret.
 */
export function renderGhostText(completion: string): void {
  const root = ensureOverlayRoot();
  let ghost = document.getElementById(GHOST_TEXT_ID);
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = GHOST_TEXT_ID;
    ghost.className = "refine-placeholder";
    root.appendChild(ghost);
  }
  ghost.textContent = `Ghost: ${completion}`;
  console.info("[Refine] Ghost text", completion);
}

/**
 * Placeholder for showing structured suggestions under the textbox.
 * TODO: replace with pill-based UI attached to textbox bounds.
 */
export function renderSuggestions(suggestions: RefineSuggestion[]): void {
  const root = ensureOverlayRoot();
  let container = document.getElementById(SUGGESTIONS_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = SUGGESTIONS_ID;
    container.className = "refine-placeholder";
    root.appendChild(container);
  }

  container.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "refine-suggestion-item";
    item.textContent = `${suggestion.label}: ${suggestion.reason}`;
    container.appendChild(item);
  });

  console.info("[Refine] Suggestions", suggestions);
}

/**
 * Placeholder for showing critical errors near the textbox.
 * TODO: highlight specific spans once ghost underlines are supported.
 */
export function renderCriticalErrors(errors: CriticalError[]): void {
  const root = ensureOverlayRoot();
  let container = document.getElementById(CRITICAL_ERRORS_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CRITICAL_ERRORS_ID;
    container.className = "refine-placeholder";
    root.appendChild(container);
  }

  container.innerHTML = "";
  errors.forEach((error) => {
    const item = document.createElement("div");
    item.className = "refine-critical-item";
    item.textContent = `${error.span} → ${error.message}`;
    container.appendChild(item);
  });

  console.info("[Refine] Critical errors", errors);
}

/** Clears overlay placeholders to reduce noise. */
export function clearOverlay(): void {
  const root = document.getElementById(OVERLAY_ROOT_ID);
  if (root) {
    root.innerHTML = "";
  }
}
