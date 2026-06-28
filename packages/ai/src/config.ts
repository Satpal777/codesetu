/**
 * Provider credentials, read from the environment LAZILY (at call time, not at
 * import time). Reading at import time would capture process.env before the
 * server's dotenv.config() has run — the same ordering trap fixed in
 * @repo/inngest's mailer. A provider with no key is simply hidden from the
 * model catalog rather than erroring.
 */
const read = (name: string): string | undefined => process.env[name]?.trim() || undefined;

export const aiConfig = {
  openAiKey: () => read("OPENAI_API_KEY"),
  anthropicKey: () => read("ANTHROPIC_API_KEY"),
  googleKey: () => read("GOOGLE_GENERATIVE_AI_API_KEY"),
  openRouterKey: () => read("OPENROUTER_API_KEY"),
  hasOpenAI: () => !!read("OPENAI_API_KEY"),
  hasAnthropic: () => !!read("ANTHROPIC_API_KEY"),
  hasGoogle: () => !!read("GOOGLE_GENERATIVE_AI_API_KEY"),
  hasOpenRouter: () => !!read("OPENROUTER_API_KEY"),
};
