import type { AIModelConfig, ReasoningEffort } from "./types";

const DEFAULT_TEMPERATURE = 0.7;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface SDKUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
}

interface TextGenerationOptions {
  temperature?: number;
  maxOutputTokens?: number;
  webSearch?: true;
  providerOptions?: {
    openai: { reasoningEffort: ReasoningEffort };
  };
}

export function withAIModelDefaults(config: AIModelConfig): AIModelConfig {
  return {
    ...config,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    webSearch: config.webSearch ?? true,
  };
}

export function getTextGenerationOptions(
  config: AIModelConfig,
  provider: string,
  supportsTemp: boolean,
): TextGenerationOptions {
  const options: TextGenerationOptions = {};

  if (config.temperature !== undefined && supportsTemp) {
    options.temperature = config.temperature;
  }

  if (config.maxTokens !== undefined) {
    options.maxOutputTokens = config.maxTokens;
  }

  if (config.webSearch) {
    options.webSearch = true;
  }

  if (provider === "openai" && config.reasoningEffort) {
    options.providerOptions = {
      openai: { reasoningEffort: config.reasoningEffort },
    };
  }

  return options;
}

export function toTokenUsage(usage: SDKUsage): TokenUsage {
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
  };
}
