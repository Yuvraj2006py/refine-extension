import { RewriteMode, Tone } from "../types/messages";

/** Supported chat message roles. */
export interface OpenAIContentBlock {
  type?: string;
  text?: string | { value?: string };
  value?: string;
  content?: OpenAIContentBlock[];
}

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentBlock[];
}

type RefineEnvKeys = "OPENAI_API_KEY" | "OPENAI_BASE_URL" | "OPENAI_MODEL";

type RuntimeEnv = typeof globalThis & {
  REFINE_ENV?: Partial<Record<RefineEnvKeys, string>>;
  process?: { env?: Record<string, string | undefined> };
};

const runtimeEnv = globalThis as RuntimeEnv;

/** Resolves environment variables injected at build/runtime with fallbacks. */
function resolveEnvVar(name: RefineEnvKeys, fallback?: string): string | undefined {
  return runtimeEnv.REFINE_ENV?.[name] ?? runtimeEnv.process?.env?.[name] ?? fallback;
}

const OPENAI_BASE_URL =
  resolveEnvVar("OPENAI_BASE_URL", "https://api.openai.com/v1") ?? "https://api.openai.com/v1";
const OPENAI_ENDPOINT = `${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`;
const OPENAI_MODEL = resolveEnvVar("OPENAI_MODEL", "gpt-4o") ?? "gpt-4o";
const OPENAI_API_KEY = resolveEnvVar("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  throw new Error(
    "OpenAI API key missing. Inject OPENAI_API_KEY via .env/build configuration before loading the extension."
  );
}
interface CallOptions {
  temperature?: number;
  maxTokens?: number;
}
export interface RewritePromptOptions {
  includeMultipleVersions?: boolean;
  complexity?: number;
}

/**
 * Calls OpenAI's chat completion endpoint with shared defaults.
 * @param messages Conversation messages passed to the LLM.
 * @param options Optional overrides for temperature and max tokens.
 * @returns Assistant text response.
 */
export async function callModel(
  messages: OpenAIChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_completion_tokens: options.maxTokens ?? 320,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("[REFINE RAW]", JSON.stringify(data, null, 2));
  return extractContent(data);
}

function extractContent(json: any): string {
  const msg = json?.choices?.[0]?.message;
  const rawContent = msg?.content;

  if (typeof rawContent === "string" && rawContent.trim() !== "") {
    return rawContent.trim();
  }

  console.warn("[Refine Parser] message.content empty — using fallback.");
  return JSON.stringify(json).slice(0, 800);
}

/**
 * Builds a prompt that asks for a single helpful sentence completion.
 * @param userText Partial text captured from the textbox.
 */
export function buildAutocompletePrompt(userText: string): OpenAIChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are Refine. Continue the user’s partial prompt with a single, concise sentence. Do not explain your reasoning."
    },
    {
      role: "user",
      content: `Continue this partial prompt succinctly: ${userText}`
    }
  ];
}

/**
 * Builds a prompt instructing the model to emit JSON suggestions.
 * @param userText Full prompt from the textbox.
 */
export function buildSuggestionPrompt(userText: string): OpenAIChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are Refine. Analyze the prompt and return 2–4 short, actionable suggestions to improve clarity and completeness. Do not explain your reasoning."
    },
    {
      role: "user",
      content: `Prompt: ${userText}`
    }
  ];
}

/**
 * Builds a prompt for detecting critical blockers in the user's request.
 * @param userText Full prompt from the textbox.
 */
export function buildCriticalErrorPrompt(userText: string): OpenAIChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are Refine. Identify any missing information that makes the prompt impossible to complete. Return 1–4 short critical issues. Do not explain your reasoning."
    },
    {
      role: "user",
      content: `Prompt: ${userText}`
    }
  ];
}

/**
 * Builds messages for rewrite requests depending on mode and tone.
 * @param userText User's raw prompt.
 * @param mode Rewrite strategy (`structured` or `steps`).
 * @param tone Desired tone for the rewrite.
 */
export function buildRewritePrompt(
  userText: string,
  mode: RewriteMode,
  tone: Tone,
  options: RewritePromptOptions = {}
): OpenAIChatMessage[] {
  const globalRules = `You are a senior AI prompt engineer. Rewrite the user's request into a superior task prompt for another AI model.

Global requirements:
- NEVER answer the user's question or provide the requested content.
- NEVER paraphrase or merely reword the original text.
- ALWAYS preserve the user's intent while improving clarity, structure, and quality.
- ALWAYS add helpful context, structure, constraints, missing parameters, explicit output expectations, and task guidance.
- ALWAYS output a directly usable prompt with no commentary, no reasoning trace, and no chain-of-thought.
- ALWAYS upgrade the request so the downstream AI delivers a stronger result than it would from the original prompt.
- If your draft violates any rule (answers the task, is empty, or fails the mode style), discard it and regenerate.`;

  const modeDirectives: Record<RewriteMode, string> = {
    cleaned: `Cleaned mode ONLY rewrites for grammar, clarity, and flow while keeping the format identical. Do not expand, summarize, or change structure, and never convert it into an email or a response.`,
    structured: `Structured mode must reorganize the task into sections labeled Context, Goal, Inputs, Constraints, Expected Output Format, and Success Criteria.`,
    steps: `Steps mode must convert the task into an ordered sequence of reasoning steps, actions, validations, and checkpoints the AI must follow without solving the task.`,
    template: `Template mode must output a reusable fill-in-the-blank template containing placeholders such as {topic}, {goal}, {dataset}, {constraints}. Do not fill in or explain the placeholders—only present the template.`,
    creative: `Creative mode should expand optionality, imagination, and flexibility—introducing alternative angles and expressive framing while still producing a higher-quality task.`,
    expert: `Expert mode must read like a specialist consultant wrote it, adding domain assumptions, professional terminology, evaluation rubrics, and strict constraints.`,
    power: `Power mode must produce the highest-level engineered prompt with role specification, pre-task context extraction, multi-stage reasoning paths, strict constraints, validation steps, disallowed behaviors, assumption checks, and precise output formatting for maximum accuracy.`
  };

  const complexityInstruction = describeComplexity(options.complexity);

  if (options.includeMultipleVersions) {
    const multiSystem = `${globalRules}
${modeDirectives[mode]}
${complexityInstruction}

Multiple-version requirement:
- Produce exactly 3–5 upgraded prompts.
- Each version must use a different structural strategy while satisfying the mode rules.
- Return ONLY valid JSON in the form:
{
  "versions": [
    "version 1",
    "version 2",
    "version 3"
  ]
}
- No prose or extra text. If any version answers the question, paraphrases, or violates the style, regenerate all versions.`;

    return [
      {
        role: "system",
        content: multiSystem
      },
      {
        role: "user",
        content: `Rewrite this prompt while generating multiple versions: ${userText}`
      }
    ];
  }

  const sharedInstruction = `${globalRules}
${modeDirectives[mode]}
${complexityInstruction}
Use a ${tone} tone and output one upgraded task prompt only.`;

  return [
    {
      role: "system",
      content: sharedInstruction
    },
    {
      role: "user",
      content: `Rewrite this prompt in a ${tone} tone: ${userText}`
    }
  ];
}

function describeComplexity(level = 5): string {
  if (level <= 3) {
    return "Complexity: Mild enhancement—clarify wording, tighten structure, and add at least one useful constraint while respecting the mode.";
  }
  if (level <= 6) {
    return "Complexity: Medium enhancement—infer missing inputs, specify explicit output formatting, add reasoning steps or placeholders, and strengthen constraints.";
  }
  return "Complexity: Major enhancement—infer deeper goals, add advanced constraints, multi-layer reasoning checkpoints, evaluation criteria, assumption checks, and comprehensive formatting requirements.";
}
