import { describe, it, expect } from "vitest";
import {
  buildSuggestionPrompt,
  buildRewritePrompt
} from "../src/api/llm";

describe("prompt builders", () => {
  it("builds suggestion prompts with user context", () => {
    const prompt = buildSuggestionPrompt("Explain quantum computing");
    expect(prompt[1].content).toContain("Explain quantum computing");
  });

  it("builds multi-version rewrite prompts with JSON instructions", () => {
    const prompt = buildRewritePrompt("Draft onboarding email", "template", "casual", {
      includeMultipleVersions: true,
      complexity: 9
    });

    expect(prompt[0].content).toContain("Return exactly 3–5 rewritten versions");
    expect(prompt[0].content).toContain("\"versions\"");
    expect(prompt[1].content).toContain("Draft onboarding email");
  });
});
