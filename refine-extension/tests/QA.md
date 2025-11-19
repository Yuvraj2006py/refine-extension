# Refine Manual QA Checklist

## Suggestions
1. Open ChatGPT, type a prompt longer than 12 words.
2. Pause typing and ensure suggestion pills appear under the textbox.
3. Hover to verify tooltip styling, click a pill, and confirm the suggestion text is appended to the prompt.

## Ghost Text
1. Start a short prompt (<12 words) and pause.
2. Confirm the gray inline completion appears at the caret position.
3. Resume typing and ensure the ghost text immediately disappears.

## Critical Errors
1. Enter a vague prompt referencing “this code” without context.
2. Pause; red underlines should highlight the problematic span.
3. Hover the underline to confirm the tooltip describes the issue and that typing is still possible.

## Rewrite Panel
1. Open the popup; verify the current prompt auto-populates.
2. Change modes (Structured → Power) and tones, enable “Include example prompts,” and adjust the complexity slider.
3. Click “Rewrite” and ensure the refined text populates the output area.
4. Use “Regenerate” to confirm the previous payload is reused.

## Popup Auto-Import
1. Modify the ChatGPT prompt, reopen the popup, or click “Import Current Prompt.”
2. Confirm the popup input reflects the latest textbox content.

## Preference Persistence
1. Toggle overlay, ghost text, suggestions, critical error switches, and adjust tone/mode preferences.
2. Close and reopen the popup; all controls should restore the saved values.
3. Refresh ChatGPT and verify the overlay obeys the saved feature toggles.
