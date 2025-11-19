import { CriticalError, RefineSuggestion } from "../types/messages";

export interface OverlayFeatureFlags {
  overlayEnabled: boolean;
  ghostTextEnabled: boolean;
  suggestionsEnabled: boolean;
  criticalErrorsEnabled: boolean;
}

const TEXTAREA_SELECTOR = 'textarea[data-id="prompt-textarea"]';

class OverlayController {
  private root: HTMLDivElement | null = null;
  private textLayer: HTMLDivElement | null = null;
  private ghostLayer: HTMLDivElement | null = null;
  private errorsLayer: HTMLDivElement | null = null;
  private suggestionsLayer: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private target: HTMLTextAreaElement | null = null;
  private textObserver: ((event: Event) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private ghostCompletion = "";
  private suggestions: RefineSuggestion[] = [];
  private errors: CriticalError[] = [];
  private currentText = "";
  private flags: OverlayFeatureFlags = {
    overlayEnabled: true,
    ghostTextEnabled: true,
    suggestionsEnabled: true,
    criticalErrorsEnabled: true
  };

  setFlags(flags: OverlayFeatureFlags): void {
    this.flags = flags;
    if (!flags.overlayEnabled) {
      this.destroy();
      return;
    }

    if (this.target) {
      this.ensureRoot();
      this.updateLayout();
      this.updateGhostLayer();
      this.updateSuggestionsLayer();
      this.updateErrorLayer();
    } else {
      this.attachToActiveTextarea();
    }
  }

  attachToActiveTextarea(): void {
    const textarea = document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR);
    this.setTarget(textarea);
  }

  setTarget(element: HTMLTextAreaElement | null): void {
    if (this.target === element) {
      return;
    }

    this.detach();
    this.target = element;
    if (!element || !this.flags.overlayEnabled) {
      this.destroy();
      return;
    }

    this.ensureRoot();
    this.currentText = element.value;
    this.textObserver = () => {
      this.currentText = element.value;
      this.clearGhost();
      this.updateErrorLayer();
      this.updateLayout();
    };
    element.addEventListener("input", this.textObserver);
    this.scrollHandler = () => this.updateLayout();
    element.addEventListener("scroll", this.scrollHandler);

    this.resizeObserver = new ResizeObserver(() => this.updateLayout());
    this.resizeObserver.observe(element);

    this.updateLayout();
  }

  renderGhostText(completion: string): void {
    if (!completion) {
      this.clearGhost();
      return;
    }

    this.ghostCompletion = completion;
    this.updateGhostLayer();
  }

  renderSuggestions(suggestions: RefineSuggestion[]): void {
    this.suggestions = suggestions;
    this.updateSuggestionsLayer();
  }

  renderCriticalErrors(errors: CriticalError[]): void {
    this.errors = errors;
    this.updateErrorLayer();
  }

  clearAll(): void {
    this.ghostCompletion = "";
    this.suggestions = [];
    this.errors = [];
    this.updateGhostLayer();
    this.updateSuggestionsLayer();
    this.updateErrorLayer();
  }

  private ensureRoot(): void {
    if (this.root) {
      return;
    }

    const root = document.createElement("div");
    root.id = "refine-overlay";
    root.className = "refine-overlay-root";

    const textLayer = document.createElement("div");
    textLayer.className = "refine-overlay-text";

    const ghostLayer = document.createElement("div");
    ghostLayer.className = "refine-ghost-layer hidden";

    const errorsLayer = document.createElement("div");
    errorsLayer.className = "refine-error-layer";

    const tooltip = document.createElement("div");
    tooltip.className = "refine-tooltip hidden";

    const suggestionsLayer = document.createElement("div");
    suggestionsLayer.className = "refine-suggestions";

    textLayer.appendChild(ghostLayer);
    textLayer.appendChild(errorsLayer);
    root.appendChild(textLayer);
    root.appendChild(suggestionsLayer);
    document.body.appendChild(root);
    document.body.appendChild(tooltip);

    this.root = root;
    this.textLayer = textLayer;
    this.ghostLayer = ghostLayer;
    this.errorsLayer = errorsLayer;
    this.suggestionsLayer = suggestionsLayer;
    this.tooltip = tooltip;
  }

  private detach(): void {
    if (this.target && this.textObserver) {
      this.target.removeEventListener("input", this.textObserver);
    }
    if (this.target && this.scrollHandler) {
      this.target.removeEventListener("scroll", this.scrollHandler);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.textObserver = null;
    this.scrollHandler = null;
    this.target = null;
  }

  private destroy(): void {
    this.detach();
    this.root?.remove();
    this.tooltip?.remove();
    this.root = null;
    this.textLayer = null;
    this.ghostLayer = null;
    this.errorsLayer = null;
    this.suggestionsLayer = null;
    this.tooltip = null;
  }

  private clearGhost(): void {
    this.ghostCompletion = "";
    this.updateGhostLayer();
  }

  private updateLayout(): void {
    if (!this.root || !this.target) {
      return;
    }

    const rect = this.target.getBoundingClientRect();
    this.root.style.top = `${rect.top + window.scrollY}px`;
    this.root.style.left = `${rect.left + window.scrollX}px`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;

    const computed = window.getComputedStyle(this.target);
    if (this.textLayer) {
      this.textLayer.style.fontSize = computed.fontSize;
      this.textLayer.style.fontFamily = computed.fontFamily;
      this.textLayer.style.lineHeight = computed.lineHeight;
      this.textLayer.style.padding = computed.padding;
    }

    if (this.suggestionsLayer) {
      this.suggestionsLayer.style.top = `${rect.height + 8}px`;
    }
  }

  private updateGhostLayer(): void {
    if (!this.ghostLayer || !this.flags.overlayEnabled || !this.flags.ghostTextEnabled) {
      return;
    }

    if (!this.ghostCompletion || !this.target) {
      this.ghostLayer.classList.add("hidden");
      this.ghostLayer.innerHTML = "";
      return;
    }

    const safeUser = escapeHtml(this.target.value);
    const safeGhost = escapeHtml(this.ghostCompletion);
    this.ghostLayer.innerHTML = `<span class="refine-ghost-prefix">${safeUser}</span><span class="refine-ghost-completion">${safeGhost}</span>`;
    this.ghostLayer.classList.remove("hidden");
  }

  private updateSuggestionsLayer(): void {
    if (!this.suggestionsLayer) {
      return;
    }

    this.suggestionsLayer.innerHTML = "";
    if (!this.flags.overlayEnabled || !this.flags.suggestionsEnabled || this.suggestions.length === 0) {
      this.suggestionsLayer.classList.add("hidden");
      return;
    }

    this.suggestionsLayer.classList.remove("hidden");
    this.suggestions.forEach((suggestion) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "refine-suggestion-pill";
      pill.textContent = suggestion.reason;
      pill.addEventListener("click", () => this.applySuggestion(suggestion));
      this.suggestionsLayer?.appendChild(pill);
    });
  }

  private applySuggestion(suggestion: RefineSuggestion): void {
    if (!this.target) {
      return;
    }

    const current = this.target.value;
    const next = current.trim().length > 0 ? `${current.trimEnd()}\n\n${suggestion.reason}` : suggestion.reason;
    this.target.value = next;
    this.target.focus();
    this.target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private updateErrorLayer(): void {
    if (!this.errorsLayer) {
      return;
    }

    if (!this.flags.overlayEnabled || !this.flags.criticalErrorsEnabled || this.errors.length === 0) {
      this.errorsLayer.innerHTML = "";
      return;
    }

    const markup = buildErrorMarkup(this.currentText, this.errors);
    this.errorsLayer.innerHTML = markup;

    this.errorsLayer.querySelectorAll<HTMLElement>(".refine-error-underline").forEach((span) => {
      span.addEventListener("mouseenter", () => this.showTooltip(span));
      span.addEventListener("mouseleave", () => this.hideTooltip());
      span.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.target?.focus();
      });
    });
  }

  private showTooltip(element: HTMLElement): void {
    if (!this.tooltip) {
      return;
    }

    const message = element.dataset.errorMessage ?? "";
    if (!message) {
      return;
    }

    const rect = element.getBoundingClientRect();
    this.tooltip.textContent = message;
    this.tooltip.classList.remove("hidden");
    this.tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    this.tooltip.style.left = `${rect.left + window.scrollX}px`;
  }

  private hideTooltip(): void {
    this.tooltip?.classList.add("hidden");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildErrorMarkup(text: string, errors: CriticalError[]): string {
  if (!text) {
    return "";
  }

  const highlights: { start: number; end: number; error: CriticalError }[] = [];
  errors.forEach((error) => {
    const span = error.span.trim();
    if (!span) {
      return;
    }
    const start = text.toLowerCase().indexOf(span.toLowerCase());
    if (start === -1) {
      return;
    }
    highlights.push({ start, end: start + span.length, error });
  });

  highlights.sort((a, b) => a.start - b.start);

  let cursor = 0;
  let markup = "";
  highlights.forEach((highlight, index) => {
    markup += escapeHtml(text.slice(cursor, highlight.start));
    const segment = escapeHtml(text.slice(highlight.start, highlight.end));
    markup += `<span class="refine-error-underline" data-error-message="${escapeHtml(
      highlight.error.message
    )}" data-error-index="${index}">${segment}</span>`;
    cursor = highlight.end;
  });

  markup += escapeHtml(text.slice(cursor));
  return markup;
}

const controller = new OverlayController();

export function setOverlayFlags(flags: OverlayFeatureFlags): void {
  controller.setFlags(flags);
}

export function attachOverlayToActiveTextarea(): void {
  controller.attachToActiveTextarea();
}

export function renderGhostText(completion: string): void {
  controller.renderGhostText(completion);
}

export function renderSuggestions(suggestions: RefineSuggestion[]): void {
  controller.renderSuggestions(suggestions);
}

export function renderCriticalErrors(errors: CriticalError[]): void {
  controller.renderCriticalErrors(errors);
}

export function clearOverlay(): void {
  controller.clearAll();
}
