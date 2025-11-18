import {
  BackgroundResponse,
  RewriteMode,
  RewriteRequest,
  RewriteResult,
  Tone
} from "../types/messages";

interface RewritePayload {
  text: string;
  mode: RewriteMode;
  tone: Tone;
}

interface PopupState {
  lastPayload: RewritePayload | null;
  tone: Tone;
  mode: RewriteMode;
}

const state: PopupState = {
  lastPayload: null,
  tone: "professional",
  mode: "structured"
};

const inputEl = document.getElementById("refine-input") as HTMLTextAreaElement | null;
const modeEl = document.getElementById("refine-mode") as HTMLSelectElement | null;
const toneEl = document.getElementById("refine-tone") as HTMLSelectElement | null;
const outputEl = document.getElementById("refine-output") as HTMLTextAreaElement | null;
const rewriteButton = document.getElementById("refine-rewrite") as HTMLButtonElement | null;
const regenerateButton = document.getElementById("refine-regenerate") as HTMLButtonElement | null;

[rewriteButton, regenerateButton].forEach((button) => {
  if (button && !button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent ?? "";
  }
});

rewriteButton?.addEventListener("click", () => {
  void sendRewriteRequest();
});

regenerateButton?.addEventListener("click", () => {
  regenerateRewrite();
});

modeEl?.addEventListener("change", (event) => {
  state.mode = (event.target as HTMLSelectElement).value as RewriteMode;
});

// TODO: expose additional tone presets once UX is ready.
toneEl?.addEventListener("change", (event) => {
  applyTone((event.target as HTMLSelectElement).value as Tone);
});

/** Sends a rewrite request using the provided form values. */
async function sendRewriteRequest(override?: Partial<RewritePayload>): Promise<void> {
  const text = (override?.text ?? inputEl?.value ?? "").trim();
  const modeSelectValue = modeEl?.value as RewriteMode | undefined;
  const toneSelectValue = toneEl?.value as Tone | undefined;
  const mode = (override?.mode ?? modeSelectValue ?? state.mode) ?? "structured";
  const tone = (override?.tone ?? toneSelectValue ?? state.tone) ?? "professional";

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
    tone
  };

  state.mode = mode;
  state.tone = tone;
  state.lastPayload = { text, mode, tone };
  setLoading(true);

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

/** Applies the rewrite result to the popup UI. */
function handleRewriteResponse(result: RewriteResult): void {
  if (outputEl) {
    outputEl.value = result.text;
  }
}

/** Persists the selected tone for reuse and analytics. */
function applyTone(tone: Tone): void {
  state.tone = tone;
}

/** Triggers another rewrite using the last payload. */
function regenerateRewrite(): void {
  if (!state.lastPayload) {
    void sendRewriteRequest();
    return;
  }

  void sendRewriteRequest(state.lastPayload);
}

/** Simple utility to toggle loading state on buttons. */
function setLoading(isLoading: boolean): void {
  [rewriteButton, regenerateButton].forEach((button) => {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.textContent =
        button.id === "refine-regenerate" ? "Regenerating..." : "Rewriting...";
    } else {
      button.textContent = button.dataset.originalLabel ?? "";
    }
  });
}

/** Wraps runtime messaging for rewrite requests. */
function sendRuntimeMessage(
  request: RewriteRequest
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
