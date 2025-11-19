import {
  BackgroundResponse,
  RewriteMode,
  RewriteRequest,
  RewriteResult,
  Tone
} from "../types/messages";
import { preferenceManager, RefinePreferences } from "../content/preferences";

interface RewritePayload {
  text: string;
  mode: RewriteMode;
  tone: Tone;
  includeMultipleVersions: boolean;
  complexity: number;
}

interface PopupState {
  lastPayload: RewritePayload | null;
  tone: Tone;
  mode: RewriteMode;
  includeMultipleVersions: boolean;
  complexity: number;
}

const state: PopupState = {
  lastPayload: null,
  tone: "professional",
  mode: "cleaned",
  includeMultipleVersions: false,
  complexity: 5
};

const inputEl = document.getElementById("refine-input") as HTMLTextAreaElement | null;
const modeEl = document.getElementById("refine-mode") as HTMLSelectElement | null;
const toneEl = document.getElementById("refine-tone") as HTMLSelectElement | null;
const versionsCheckbox = document.getElementById("refine-multiple") as HTMLInputElement | null;
const complexitySlider = document.getElementById("refine-complexity") as HTMLInputElement | null;
const complexityValue = document.getElementById("complexity-value") as HTMLOutputElement | null;
const overlayToggle = document.getElementById("overlay-enabled") as HTMLInputElement | null;
const ghostToggle = document.getElementById("ghost-enabled") as HTMLInputElement | null;
const suggestionToggle = document.getElementById("suggestions-enabled") as HTMLInputElement | null;
const criticalToggle = document.getElementById("critical-enabled") as HTMLInputElement | null;
const outputEl = document.getElementById("refine-output") as HTMLTextAreaElement | null;
const versionsContainer = document.getElementById("refine-versions") as HTMLDivElement | null;
const rewriteButton = document.getElementById("refine-rewrite") as HTMLButtonElement | null;
const regenerateButton = document.getElementById("refine-regenerate") as HTMLButtonElement | null;
const importButton = document.getElementById("refine-import") as HTMLButtonElement | null;

[rewriteButton, regenerateButton].forEach((button) => {
  if (button && !button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent ?? "";
  }
});

initializePopup();

async function initializePopup(): Promise<void> {
  const prefs = await preferenceManager.init();
  applyPreferencesToUI(prefs);
  preferenceManager.subscribe(applyPreferencesToUI);
  attachEventListeners();
  await importActivePrompt();
}

function attachEventListeners(): void {
  rewriteButton?.addEventListener("click", () => void sendRewriteRequest());
  regenerateButton?.addEventListener("click", () => regenerateRewrite());
  importButton?.addEventListener("click", () => void importActivePrompt());

  modeEl?.addEventListener("change", (event) => {
    const mode = (event.target as HTMLSelectElement).value as RewriteMode;
    state.mode = mode;
    void preferenceManager.update({ rewriteMode: mode });
  });

  toneEl?.addEventListener("change", (event) => {
    const tone = (event.target as HTMLSelectElement).value as Tone;
    state.tone = tone;
    void preferenceManager.update({ tone });
  });

  versionsCheckbox?.addEventListener("change", (event) => {
    const includeMultipleVersions = (event.target as HTMLInputElement).checked;
    state.includeMultipleVersions = includeMultipleVersions;
    void preferenceManager.update({ includeMultipleVersions });
  });

  complexitySlider?.addEventListener("input", (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    state.complexity = value;
    updateComplexityOutput(value);
    void preferenceManager.update({ complexity: value });
  });

  overlayToggle?.addEventListener("change", (event) => {
    const overlayEnabled = (event.target as HTMLInputElement).checked;
    void preferenceManager.update({ overlayEnabled });
    syncOverlayToggles(overlayEnabled);
  });

  ghostToggle?.addEventListener("change", (event) => {
    const ghostTextEnabled = (event.target as HTMLInputElement).checked;
    void preferenceManager.update({ ghostTextEnabled });
  });

  suggestionToggle?.addEventListener("change", (event) => {
    const suggestionsEnabled = (event.target as HTMLInputElement).checked;
    void preferenceManager.update({ suggestionsEnabled });
  });

  criticalToggle?.addEventListener("change", (event) => {
    const criticalErrorsEnabled = (event.target as HTMLInputElement).checked;
    void preferenceManager.update({ criticalErrorsEnabled });
  });
}

function applyPreferencesToUI(prefs: RefinePreferences): void {
  state.mode = prefs.rewriteMode;
  state.tone = prefs.tone;
  state.includeMultipleVersions = prefs.includeMultipleVersions;
  state.complexity = prefs.complexity;

  if (modeEl) modeEl.value = prefs.rewriteMode;
  if (toneEl) toneEl.value = prefs.tone;
  if (versionsCheckbox) versionsCheckbox.checked = prefs.includeMultipleVersions;
  if (complexitySlider) complexitySlider.value = String(prefs.complexity);
  updateComplexityOutput(prefs.complexity);

  if (overlayToggle) overlayToggle.checked = prefs.overlayEnabled;
  if (ghostToggle) ghostToggle.checked = prefs.ghostTextEnabled;
  if (suggestionToggle) suggestionToggle.checked = prefs.suggestionsEnabled;
  if (criticalToggle) criticalToggle.checked = prefs.criticalErrorsEnabled;
  syncOverlayToggles(prefs.overlayEnabled);
}

function syncOverlayToggles(enabled: boolean): void {
  [ghostToggle, suggestionToggle, criticalToggle].forEach((toggle) => {
    if (toggle) {
      toggle.disabled = !enabled;
    }
  });
}

function updateComplexityOutput(value: number): void {
  if (complexityValue) {
    complexityValue.value = String(value);
  }
}

async function sendRewriteRequest(override?: Partial<RewritePayload>): Promise<void> {
  const text = (override?.text ?? inputEl?.value ?? "").trim();
  const mode = (override?.mode ?? (modeEl?.value as RewriteMode) ?? state.mode) ?? "structured";
  const tone = (override?.tone ?? (toneEl?.value as Tone) ?? state.tone) ?? "professional";
  const includeMultipleVersions =
    override?.includeMultipleVersions ?? state.includeMultipleVersions;
  const complexity = override?.complexity ?? state.complexity;

  if (!text) {
    if (outputEl) {
      outputEl.value = "Please enter a prompt to rewrite.";
    }
    return;
  }

  const request: RewriteRequest = {
    type: "rewrite",
    text,
    mode,
    tone,
    includeMultipleVersions,
    complexity
  };

  state.lastPayload = { text, mode, tone, includeMultipleVersions, complexity };
  setLoading(true);
  clearVersions();
  if (outputEl) {
    outputEl.value = "";
  }

  try {
    const response = await sendRuntimeMessage(request);
    if (response?.type === "rewriteResult") {
      handleRewriteResponse(response.data);
    }
  } catch (error) {
    console.error("[Refine] Rewrite failed", error);
    if (outputEl) {
      outputEl.value = "Rewrite failed. Please try again.";
    }
  } finally {
    setLoading(false);
  }
}

function handleRewriteResponse(result: RewriteResult): void {
  if (result.versions && result.versions.length > 0) {
    if (outputEl) {
      outputEl.value = "";
    }
    renderVersions(result.versions);
    return;
  }

  clearVersions();
  if (outputEl) {
    outputEl.value = result.text ?? "";
  }
}

function regenerateRewrite(): void {
  if (!state.lastPayload) {
    void sendRewriteRequest();
    return;
  }

  void sendRewriteRequest(state.lastPayload);
}

function setLoading(isLoading: boolean): void {
  [rewriteButton, regenerateButton].forEach((button) => {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.textContent = button.id === "refine-regenerate" ? "Regenerating..." : "Rewriting...";
    } else {
      button.textContent = button.dataset.originalLabel ?? "";
    }
  });
}

function sendRuntimeMessage(request: RewriteRequest): Promise<BackgroundResponse> {
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

function renderVersions(versions: string[]): void {
  if (!versionsContainer) {
    return;
  }
  versionsContainer.innerHTML = "";
  versionsContainer.classList.remove("hidden");
  versions.forEach((version, index) => {
    const card = document.createElement("div");
    card.className = "refine-version-card";

    const header = document.createElement("div");
    header.className = "refine-version-header";
    header.textContent = `Version ${index + 1}`;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "refine-version-copy";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => copyVersion(version));
    header.appendChild(copyButton);

    const body = document.createElement("pre");
    body.className = "refine-version-body";
    body.textContent = version;

    card.appendChild(header);
    card.appendChild(body);
    versionsContainer.appendChild(card);
  });
}

function clearVersions(): void {
  if (versionsContainer) {
    versionsContainer.innerHTML = "";
    versionsContainer.classList.add("hidden");
  }
}

function copyVersion(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  temp.style.position = "fixed";
  temp.style.opacity = "0";
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
}

async function importActivePrompt(): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const [tab] = tabs;
      if (!tab?.id) {
        resolve();
        return;
      }

      const isSupportedHost = Boolean(tab.url?.startsWith("https://chat.openai.com"));
      if (!isSupportedHost) {
        if (inputEl) {
          inputEl.placeholder = "Open ChatGPT to auto-import your prompt.";
        }
        resolve();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: "getActivePrompt" }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          const message =
            runtimeError && "message" in runtimeError
              ? runtimeError.message
              : JSON.stringify(runtimeError);
          console.warn("[Refine] Failed to import prompt", message);
          if (inputEl && message?.includes("Receiving end does not exist")) {
            inputEl.placeholder = "Reload ChatGPT to capture your latest prompt.";
          }
          resolve();
          return;
        }

        if (response?.text && inputEl) {
          inputEl.value = response.text;
        }
        resolve();
      });
    });
  });
}
