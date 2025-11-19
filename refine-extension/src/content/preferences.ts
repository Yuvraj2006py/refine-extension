import { RewriteMode, Tone } from "../types/messages";
import { syncGet, syncSet } from "../utils/storage";

export interface RefinePreferences {
  rewriteMode: RewriteMode;
  tone: Tone;
  overlayEnabled: boolean;
  ghostTextEnabled: boolean;
  suggestionsEnabled: boolean;
  criticalErrorsEnabled: boolean;
  includeMultipleVersions: boolean;
  complexity: number;
}

export const DEFAULT_PREFERENCES: RefinePreferences = {
  rewriteMode: "cleaned",
  tone: "professional",
  overlayEnabled: true,
  ghostTextEnabled: true,
  suggestionsEnabled: true,
  criticalErrorsEnabled: true,
  includeMultipleVersions: false,
  complexity: 5
};

const PREFERENCE_KEY = "refine_preferences";

type PreferenceListener = (prefs: RefinePreferences) => void;

/** Centralized manager for reading/updating synced preferences. */
export class PreferenceManager {
  private value: RefinePreferences = DEFAULT_PREFERENCES;
  private initialized = false;
  private listeners = new Set<PreferenceListener>();

  async init(): Promise<RefinePreferences> {
    if (this.initialized) {
      return this.value;
    }

    const stored = await syncGet<RefinePreferences>(PREFERENCE_KEY, DEFAULT_PREFERENCES);
    this.value = { ...DEFAULT_PREFERENCES, ...stored };
    this.initialized = true;

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" || !changes[PREFERENCE_KEY]) {
          return;
        }
        const next = changes[PREFERENCE_KEY].newValue as RefinePreferences;
        this.value = { ...DEFAULT_PREFERENCES, ...next };
        this.emit();
      });
    }

    return this.value;
  }

  get preferences(): RefinePreferences {
    return this.value;
  }

  subscribe(listener: PreferenceListener): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }

  async update(partial: Partial<RefinePreferences>): Promise<void> {
    this.value = { ...this.value, ...partial };
    await syncSet(PREFERENCE_KEY, this.value);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.value));
  }
}

export const preferenceManager = new PreferenceManager();
