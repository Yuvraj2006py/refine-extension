import { RewriteMode, Tone } from "../types/messages";

/** Supported chat message roles. */
export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
const OPENAI_MODEL = resolveEnvVar("OPENAI_MODEL", "gpt-5-nano") ?? "gpt-5-nano";
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
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 320,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content");
  }

  return content.trim();
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
        "You are assisting with AI prompt drafting. Reply with exactly one sentence that continues the user's text. Do not add explanations or bullet points."
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
        "Analyze the provided AI prompt and return 2-4 structured suggestions in valid JSON. Each item must include type, label, and reason. Focus on clarity, missing context, constraints, and structure."
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
        "Identify only critical issues that would prevent an AI from completing the task (missing inputs, contradictions, vague references). Reply as JSON array of { \"span\": string, \"message\": string }."
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
  tone: Tone
): OpenAIChatMessage[] {
  const sharedInstruction =
    "Preserve the user's intent while improving clarity. Apply the specified tone and avoid changing meaning.";

  if (mode === "steps") {
    return [
      {
        role: "system",
        content:
          `${sharedInstruction} Produce a numbered, step-by-step set of instructions suitable for guiding an AI model.`
      },
      {
        role: "user",
        content: `Rewrite this prompt in a ${tone} tone as clear steps: ${userText}`
      }
    ];
  }

  return [
    {
      role: "system",
      content:
        `${sharedInstruction} Produce a structured professional prompt with sections like Context, Goal, Constraints, and Output Format.`
    },
    {
      role: "user",
      content: `Rewrite this prompt in a ${tone} tone with structured sections: ${userText}`
    }
  ];
}
