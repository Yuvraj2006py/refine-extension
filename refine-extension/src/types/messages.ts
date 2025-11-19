/**
 * Shared type definitions for background/content/popup messaging.
 */
export type MessageType =
  | "autocomplete"
  | "suggestions"
  | "criticalErrors"
  | "rewrite";

/** Allowed tones for rewrites and future features. */
export type Tone = "professional" | "casual" | "technical";

/** Rewrite modes supported in the popup. */
export type RewriteMode =
  | "cleaned"
  | "structured"
  | "steps"
  | "template"
  | "creative"
  | "expert"
  | "power";

/** Base shape for all runtime requests. */
export interface BaseRequest {
  /** Message discriminator consumed by the background worker. */
  type: MessageType;
  /** Raw text captured from the user interface. */
  text: string;
}

/** Request for ghost-text autocomplete. */
export interface AutocompleteRequest extends BaseRequest {
  type: "autocomplete";
}

/** Request for structured suggestions. */
export interface SuggestionsRequest extends BaseRequest {
  type: "suggestions";
}

/** Request for critical error identification. */
export interface CriticalErrorsRequest extends BaseRequest {
  type: "criticalErrors";
}

/** Request issued from the popup rewrite panel. */
export interface RewriteRequest extends BaseRequest {
  type: "rewrite";
  mode: RewriteMode;
  tone: Tone;
  includeMultipleVersions: boolean;
  complexity: number;
}

/**
 * Suggestions that Refine can surface under the textbox in later versions.
 * TODO: extend with metadata for ranking, icons, etc.
 */
export interface RefineSuggestion {
  type: string;
  label: string;
  reason: string;
}

/** Critical errors that must be highlighted to the user. */
export interface CriticalError {
  span: string;
  message: string;
}

/** Result payload for autocomplete requests. */
export interface AutocompleteResult {
  completion: string;
}

/** Result payload for suggestions requests. */
export interface SuggestionsResult {
  suggestions: RefineSuggestion[];
}

/** Result payload for critical error detection. */
export interface CriticalErrorResult {
  errors: CriticalError[];
}

/** Result payload for rewrite requests. */
export interface RewriteResult {
  text?: string;
  versions?: string[];
  mode: RewriteMode;
  tone: Tone;
}

/** Union covering every background request type. */
export type BackgroundRequest =
  | AutocompleteRequest
  | SuggestionsRequest
  | CriticalErrorsRequest
  | RewriteRequest;

/** Union used by transport helpers for responses. */
export type BackgroundResponse =
  | { type: "autocompleteResult"; data: AutocompleteResult }
  | { type: "suggestionsResult"; data: SuggestionsResult }
  | { type: "criticalErrorResult"; data: CriticalErrorResult }
  | { type: "rewriteResult"; data: RewriteResult }
  | { error: string };
