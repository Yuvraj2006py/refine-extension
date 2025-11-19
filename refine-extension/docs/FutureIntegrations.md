# Refine Future Integration Architecture

## Multi-Site Support (ChatGPT, Claude, Gemini, Perplexity)
- **Detection Layer**: Abstract the textbox discovery logic into per-site adapters (`SiteAdapter` interface) that expose selectors, pause heuristics, and DOM hooks. The content script bootstraps the correct adapter based on hostname.
- **Message Routing**: Keep the background/service worker agnostic by tagging requests with `siteId` so telemetry and UX decisions can pivot by site.
- **Overlay Mounts**: OverlayController accepts adapter-provided anchors (e.g., Gemini uses `div[role="textbox"]`). Each adapter can override styling tokens for site-specific spacing.

## Analytics & Logging Backends
- Introduce a `TelemetryClient` with a provider interface (no-op, local debug, remote HTTP). The background worker can emit anonymized events (feature usage, errors) after the LLM response resolves.
- Use batching + retry queues stored in `chrome.storage.local` to avoid blocking UX and to gracefully handle offline scenarios.

## API Provider Switching
- Extend `api/llm.ts` with a provider registry. Each provider defines supported models, auth strategy, and rate policies.
- Preferences gain a `provider` key; popup adds a selector (behind feature flag). The background worker reads the preference and instantiates the matching provider before calling `callModel`.

## Model-Agnostic Rewriting
- Normalize rewrite requests into a provider-independent schema (`RewriteIntent`) describing tone, structure, constraints, and examples.
- Each provider implements a translator that converts `RewriteIntent` into provider-specific prompts (system/user messages, JSON payloads, streaming options).

## Pluggable UI Layers
- OverlayController will expose lifecycle hooks (`onSuggestionClick`, `onErrorHover`) so alternate UI implementations (e.g., React-based overlays, tooltip libraries) can mount or replace DOM nodes without rewriting business logic.
- Define a `UIPlugin` interface that registers overlays, keyboard shortcuts, or context menus. Plugins receive preference updates and can opt-in/out per site.

## Versioned Prompt Builder Pipeline
- Store prompt-builder versions (e.g., `rewrite:v2`) alongside migrations. Each builder exposes metadata: target models, token budgets, capabilities.
- Add automated tests + golden files for every prompt version to guard against regressions when iterating on instructions.
- Popup/back-end negotiation: popup declares desired builder version; background resolves to latest compatible version before invoking the LLM, enabling A/B tests or gradual rollouts.
