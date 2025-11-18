import {
  AutocompleteRequest,
  AutocompleteResult,
  BackgroundRequest,
  BackgroundResponse,
  CriticalError,
  CriticalErrorResult,
  CriticalErrorsRequest,
  RefineSuggestion,
  RewriteRequest,
  RewriteResult,
  SuggestionsRequest,
  SuggestionsResult
} from "../types/messages";
import {
  buildAutocompletePrompt,
  buildCriticalErrorPrompt,
  buildRewritePrompt,
  buildSuggestionPrompt,
  callModel,
  OpenAIChatMessage
} from "../api/llm";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  (async () => {
    try {
      const response = await routeRequest(request);
      sendResponse(response);
    } catch (error) {
      console.error("Refine background error", error);
      sendResponse({ error: (error as Error).message });
    }
  })();

  return true;
});

/** Routes incoming messages to the appropriate handler. */
async function routeRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case "autocomplete": {
      const data = await handleAutocomplete(request);
      return { type: "autocompleteResult", data };
    }
    case "suggestions": {
      const data = await handleSuggestions(request);
      return { type: "suggestionsResult", data };
    }
    case "criticalErrors": {
      const data = await handleCriticalErrors(request);
      return { type: "criticalErrorResult", data };
    }
    case "rewrite": {
      const data = await handleRewrite(request);
      return { type: "rewriteResult", data };
    }
    default:
      throw new Error(`Unknown request type: ${(request as { type?: string }).type}`);
  }
}

/** Attempts the model call a few times before failing. */
async function callWithRetry(
  messages: OpenAIChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRIES) {
    try {
      return await callModel(messages, options);
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown LLM error");
}

/** Simple delay helper for retry backoff. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Handles autocomplete requests into a one-sentence completion. */
async function handleAutocomplete(request: AutocompleteRequest): Promise<AutocompleteResult> {
  const completion = await callWithRetry(buildAutocompletePrompt(request.text), {
    maxTokens: 64
  });
  return { completion };
}

/** Handles suggestion generation and parsing results. */
async function handleSuggestions(request: SuggestionsRequest): Promise<SuggestionsResult> {
  const raw = await callWithRetry(buildSuggestionPrompt(request.text), {
    maxTokens: 400
  });
  return { suggestions: parseSuggestions(raw) };
}

/** Handles critical error detection requests. */
async function handleCriticalErrors(
  request: CriticalErrorsRequest
): Promise<CriticalErrorResult> {
  const raw = await callWithRetry(buildCriticalErrorPrompt(request.text), {
    maxTokens: 240
  });
  return { errors: parseCriticalErrors(raw) };
}

/** Handles popup rewrite requests for the selected mode and tone. */
async function handleRewrite(request: RewriteRequest): Promise<RewriteResult> {
  const text = await callWithRetry(
    buildRewritePrompt(request.text, request.mode, request.tone),
    {
      maxTokens: 480,
      temperature: 0.35
    }
  );
  return { text, mode: request.mode, tone: request.tone };
}

/** Attempts to parse structured suggestions while handling fallback text. */
function parseSuggestions(payload: string): RefineSuggestion[] {
  try {
    const parsed = JSON.parse(payload);
    const arr: unknown = Array.isArray(parsed) ? parsed : parsed?.suggestions;
    if (Array.isArray(arr)) {
      return arr
        .map((item) => normalizeSuggestion(item))
        .filter((suggestion): suggestion is RefineSuggestion => Boolean(suggestion));
    }
  } catch (error) {
    console.warn("Suggestion parsing failed", error, payload);
  }

  return payload
    .split(/\n+/)
    .map((line, index) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      type: "generic",
      label: `Suggestion ${index + 1}`,
      reason: line
    }));
}

/** Normalizes suggestion-like objects to the RefineSuggestion interface. */
function normalizeSuggestion(candidate: unknown): RefineSuggestion | null {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("label" in candidate) ||
    !("reason" in candidate)
  ) {
    return null;
  }

  const { type, label, reason } = candidate as {
    type?: unknown;
    label?: unknown;
    reason?: unknown;
  };

  if (typeof label !== "string" || typeof reason !== "string") {
    return null;
  }

  return {
    type: typeof type === "string" ? type : "unspecified",
    label: label.trim(),
    reason: reason.trim()
  };
}

/** Parses the critical error payload with graceful fallback. */
function parseCriticalErrors(payload: string): CriticalError[] {
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => normalizeCriticalError(entry))
        .filter((error): error is CriticalError => Boolean(error));
    }
  } catch (error) {
    console.warn("Critical error parsing failed", error, payload);
  }

  return [];
}

/** Ensures data conforms to CriticalError. */
function normalizeCriticalError(candidate: unknown): CriticalError | null {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("span" in candidate) ||
    !("message" in candidate)
  ) {
    return null;
  }

  const { span, message } = candidate as { span?: unknown; message?: unknown };
  if (typeof span !== "string" || typeof message !== "string") {
    return null;
  }

  return { span: span.trim(), message: message.trim() };
}
