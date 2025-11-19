(globalThis as typeof globalThis & { REFINE_ENV?: Record<string, string> }).REFINE_ENV = {
  OPENAI_API_KEY: "test-key",
  OPENAI_BASE_URL: "https://api.openai.com/v1",
  OPENAI_MODEL: "gpt-5-nano"
};
process.env.OPENAI_API_KEY = "test-key";
