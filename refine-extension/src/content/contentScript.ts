import {
  AutocompleteRequest,
  BackgroundResponse,
  CriticalErrorsRequest,
  SuggestionsRequest
} from "../types/messages";
import {
  attachOverlayToActiveTextarea,
  clearOverlay,
  renderCriticalErrors,
  renderGhostText,
  renderSuggestions,
  setOverlayFlags
} from "./overlay";
import { DEFAULT_PREFERENCES, preferenceManager, RefinePreferences } from "./preferences";

const TYPING_PAUSE_MS = 600;

type EditableElement = HTMLTextAreaElement | HTMLDivElement;

let activeInput: EditableElement | null = null;
let pauseTimer: number | null = null;
let lastTextValue = "";
let preferences: RefinePreferences = DEFAULT_PREFERENCES;

void preferenceManager.init().then((prefs) => {
  preferences = prefs;
  setOverlayFlags({
    overlayEnabled: prefs.overlayEnabled,
    ghostTextEnabled: prefs.ghostTextEnabled,
    suggestionsEnabled: prefs.suggestionsEnabled,
    criticalErrorsEnabled: prefs.criticalErrorsEnabled
  });
});

preferenceManager.subscribe((prefs) => {
  preferences = prefs;
  setOverlayFlags({
    overlayEnabled: prefs.overlayEnabled,
    ghostTextEnabled: prefs.ghostTextEnabled,
    suggestionsEnabled: prefs.suggestionsEnabled,
    criticalErrorsEnabled: prefs.criticalErrorsEnabled
  });
});

init();

/** Bootstraps textbox detection and pause monitoring. */
function init(): void {
  injectOverlayStyles();
  locateTextInput();
  const observer = new MutationObserver(() => {
    if (activeInput && document.contains(activeInput)) {
      return;
    }
    activeInput = null;
    locateTextInput();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

/** Searches for the primary textbox on ChatGPT-style pages. */
function locateTextInput(): void {
  const textarea =
    document.querySelector<HTMLTextAreaElement>('textarea[data-id="prompt-textarea"]') ??
    document.querySelector<HTMLTextAreaElement>("textarea");
  const divInput = document.querySelector<HTMLDivElement>('div[role="textbox"]');
  // TODO: Extend detection to other AI chat products beyond ChatGPT.
  const candidate = textarea ?? divInput;

  if (candidate && candidate !== activeInput) {
    activeInput = candidate;
    attachInputListener(candidate);
    if (candidate instanceof HTMLTextAreaElement) {
      attachOverlayToActiveTextarea();
    }
    console.info("[Refine] Attached to textbox", candidate);
  }
}

/** Wires input listeners for pause detection. */
function attachInputListener(element: EditableElement): void {
  element.addEventListener("input", () => {
    lastTextValue = getTextValue(element);
    schedulePauseCheck();
  });
}

/** Reads text from textareas or content-editable divs. */
function getTextValue(element: EditableElement): string {
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  return element.innerText;
}

/** Debounces pause detection using a timeout. */
function schedulePauseCheck(): void {
  if (pauseTimer) {
    window.clearTimeout(pauseTimer);
  }

  pauseTimer = window.setTimeout(async () => {
    const text = lastTextValue.trim();
    if (!text) {
      clearOverlay();
      return;
    }

    const wordCount = getWordCount(text);
    if (wordCount < 12) {
      await requestAutocomplete(text);
    } else {
      await Promise.allSettled([requestSuggestions(text), requestCriticalErrors(text)]);
    }
  }, TYPING_PAUSE_MS);
}

/** Counts words using whitespace separation. */
function getWordCount(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

/** Sends autocomplete request to the background service. */
async function requestAutocomplete(text: string): Promise<void> {
  if (!preferences?.ghostTextEnabled || !preferences.overlayEnabled) {
    return;
  }
  const request: AutocompleteRequest = { type: "autocomplete", text };
  try {
    const response = await sendRuntimeMessage(request);
    if (response?.type === "autocompleteResult") {
      renderGhostText(response.data.completion);
    }
  } catch (error) {
    console.warn("[Refine] Autocomplete failed", error);
  }
}

/** Sends suggestion request to the background worker. */
async function requestSuggestions(text: string): Promise<void> {
  if (!preferences?.suggestionsEnabled) {
    return;
  }
  const request: SuggestionsRequest = { type: "suggestions", text };
  try {
    const response = await sendRuntimeMessage(request);
    if (response?.type === "suggestionsResult") {
      renderSuggestions(response.data.suggestions);
    }
  } catch (error) {
    console.warn("[Refine] Suggestions failed", error);
  }
}

/** Sends critical error detection request. */
async function requestCriticalErrors(text: string): Promise<void> {
  if (!preferences?.criticalErrorsEnabled) {
    return;
  }
  const request: CriticalErrorsRequest = { type: "criticalErrors", text };
  try {
    const response = await sendRuntimeMessage(request);
    if (response?.type === "criticalErrorResult") {
      renderCriticalErrors(response.data.errors);
    }
  } catch (error) {
    console.warn("[Refine] Critical errors failed", error);
  }
}

/**
 * Wraps chrome.runtime.sendMessage in a promise with typed payloads.
 * TODO: consider streaming updates for longer tasks.
 */
function sendRuntimeMessage(
  request: AutocompleteRequest | SuggestionsRequest | CriticalErrorsRequest
): Promise<BackgroundResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: BackgroundResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(runtimeError);
        return;
      }

      if (!response) {
        reject(new Error("No response from background"));
        return;
      }

      if ("error" in response) {
        reject(new Error((response as unknown as { error: string }).error));
        return;
      }

      resolve(response);
    });
  });
}

function injectOverlayStyles(): void {
  if (document.getElementById("refine-overlay-style")) {
    return;
  }
  const link = document.createElement("link");
  link.id = "refine-overlay-style";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("dist/content/overlay.css");
  document.head.appendChild(link);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "getActivePrompt") {
    const text = activeInput ? getTextValue(activeInput) : "";
    sendResponse({ text });
  }
});
