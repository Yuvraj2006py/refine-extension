import { describe, it, expect, beforeEach, vi } from "vitest";
import * as backgroundModule from "../src/background/background";
const { handleSuggestions, handleCriticalErrors, handleRewrite, routeRequest } = backgroundModule;
import * as llm from "../src/api/llm";
import {
  SuggestionsRequest,
  CriticalErrorsRequest,
  RewriteRequest,
  RewriteResult
} from "../src/types/messages";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("background handlers", () => {
  it("parses structured suggestions from JSON", async () => {
    vi.spyOn(llm, "callModel").mockResolvedValue(
      JSON.stringify([
        { type: "context", label: "Add context", reason: "Clarify dataset source" },
        { type: "output", label: "Define format", reason: "Specify markdown output" }
      ])
    );

    const request: SuggestionsRequest = { type: "suggestions", text: "Analyze code" };
    const result = await handleSuggestions(request);

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0].label).toBe("Add context");
  });

  it("parses critical errors", async () => {
    vi.spyOn(llm, "callModel").mockResolvedValue(
      JSON.stringify([{ span: "this", message: "Ambiguous subject" }])
    );

    const request: CriticalErrorsRequest = { type: "criticalErrors", text: "Fix this" };
    const result = await handleCriticalErrors(request);

    expect(result.errors).toEqual([{ span: "this", message: "Ambiguous subject" }]);
  });

  it("handles rewrite requests with advanced options", async () => {
    const buildSpy = vi.spyOn(llm, "buildRewritePrompt");
    vi.spyOn(llm, "callModel").mockResolvedValue("Rewritten prompt");

    const request: RewriteRequest = {
      type: "rewrite",
      text: "Write me a poem",
      mode: "template",
      tone: "technical",
      includeMultipleVersions: false,
      complexity: 9
    };

    const result = await handleRewrite(request);
    expect(result.text).toBe("Rewritten prompt");
    expect(buildSpy).toHaveBeenCalledWith("Write me a poem", "template", "technical", {
      includeMultipleVersions: false,
      complexity: 9
    });
  });

  it("parses multi-version rewrite responses", async () => {
    vi.spyOn(llm, "callModel").mockResolvedValue(
      JSON.stringify({ versions: ["Option A", "Option B", "Option C"] })
    );

    const request: RewriteRequest = {
      type: "rewrite",
      text: "Summarize findings",
      mode: "structured",
      tone: "professional",
      includeMultipleVersions: true,
      complexity: 5
    };

    const result = await handleRewrite(request);
    expect(result.versions).toEqual(["Option A", "Option B", "Option C"]);
    expect(result.text).toBeUndefined();
  });

  it("routes requests to the appropriate handler", async () => {
    vi.spyOn(llm, "callModel").mockResolvedValue("ok");
    const response = await routeRequest({
      type: "rewrite",
      text: "Optimize",
      mode: "structured",
      tone: "professional",
      includeMultipleVersions: false,
      complexity: 5
    });

    expect(response.type).toBe("rewriteResult");
    expect((response.data as RewriteResult).mode).toBe("structured");
  });
});
