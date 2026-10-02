/**
 * Provider/model selection helpers.
 *
 * Pure functions — no SDK imports, no side effects.
 */
import type { ReasoningEffort } from "./types";

export interface ResolvedModelProvider {
  provider: string;
  modelId: string;
}

/**
 * Model name patterns → provider auto-detection.
 */
const MODEL_PATTERNS: Array<[RegExp, string]> = [
  [/^claude/, "anthropic"],
  [/^gpt-/, "openai"],
  [/^o\d+(?:-|$)/, "openai"],
  [/^gemini/, "google"],
  [/^llama/, "ollama"],
  [/^mistral/, "ollama"],
  [/^phi-/, "ollama"],
  [/^qwen/, "ollama"],
];

/**
 * Parse explicit provider prefix from a model string.
 * "openai:gpt-4o-mini" → { provider: "openai", modelId: "gpt-4o-mini" }
 * "gpt-4o-mini" → null (no prefix)
 */
function parseProviderPrefix(model: string): ResolvedModelProvider | null {
  const colonIdx = model.indexOf(":");
  if (colonIdx > 0) {
    return {
      provider: model.slice(0, colonIdx),
      modelId: model.slice(colonIdx + 1),
    };
  }
  return null;
}

/**
 * Resolve both provider and SDK model ID for text generation.
 *
 * Supports:
 * - Auto-detection from model name: "gpt-4o-mini" → { provider: "openai", modelId: "gpt-4o-mini" }
 * - Explicit prefix: "openai:gpt-4o-mini" → { provider: "openai", modelId: "gpt-4o-mini" }
 */
export function resolveTextProvider(model: string): ResolvedModelProvider {
  const explicit = parseProviderPrefix(model);
  if (explicit) return explicit;

  for (const [pattern, provider] of MODEL_PATTERNS) {
    if (pattern.test(model)) return { provider, modelId: model };
  }

  return { provider: "anthropic", modelId: model };
}

/**
 * Select the text generation provider from a model string.
 *
 * Supports:
 * - Auto-detection from model name: "gpt-4o-mini" → "openai"
 * - Explicit prefix: "openai:gpt-4o-mini" → "openai"
 * - No model: defaults to "anthropic"
 */
export function selectTextProvider(model?: string): string {
  if (!model) return "anthropic";
  return resolveTextProvider(model).provider;
}

/**
 * Image model patterns → provider auto-detection.
 */
const IMAGE_MODEL_PATTERNS: Array<[RegExp, string]> = [
  [/^gpt-image/, "openai"],
  [/^dall-e/, "openai"],
  [/^gemini/, "google"],
];

const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";

/**
 * Select the image generation provider from a model string.
 *
 * Returns both the provider and the resolved model ID.
 * Falls back to OpenAI with gpt-image-1.5 if no model specified.
 */
export function selectImageProvider(model?: string): ResolvedModelProvider {
  if (!model) return { provider: "openai", modelId: DEFAULT_IMAGE_MODEL };

  const explicit = parseProviderPrefix(model);
  if (explicit) return explicit;

  for (const [pattern, provider] of IMAGE_MODEL_PATTERNS) {
    if (pattern.test(model)) return { provider, modelId: model };
  }

  return { provider: "openai", modelId: model };
}

/**
 * OpenAI model capabilities, kept in line with
 * `getOpenAILanguageModelCapabilities` in @ai-sdk/openai so this layer never
 * disagrees with what the SDK sends.
 */
function parseGptVersion(modelId: string): {
  major: number;
  minor: number | undefined;
  variant: string | undefined;
} | null {
  const match = /^gpt-(\d+)(?:\.(\d+))?(?:-(.+))?$/.exec(modelId);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: match[2] === undefined ? undefined : Number(match[2]),
    variant: match[3],
  };
}

const O_SERIES_PATTERN = /^o\d+(?:-|$)/;
const SEARCH_PREVIEW_PATTERN = /^gpt-4o(?:-mini)?-search-preview/;

const GPT6_EFFORTS: readonly ReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];
const GPT6_SOL_LUNA_EFFORTS: readonly ReasoningEffort[] = [
  "none",
  ...GPT6_EFFORTS,
];

interface OpenAICapabilities {
  supportsTemperature: boolean;
  /** Undefined when the SDK sends any effort as configured. */
  supportedReasoningEfforts: readonly ReasoningEffort[] | undefined;
}

function openAICapabilities(
  modelId: string,
  reasoningEffort: ReasoningEffort | undefined,
): OpenAICapabilities {
  if (SEARCH_PREVIEW_PATTERN.test(modelId)) {
    return { supportsTemperature: false, supportedReasoningEfforts: undefined };
  }
  if (O_SERIES_PATTERN.test(modelId)) {
    return { supportsTemperature: false, supportedReasoningEfforts: undefined };
  }
  const gpt = parseGptVersion(modelId);
  if (!gpt || gpt.major < 5) {
    return { supportsTemperature: true, supportedReasoningEfforts: undefined };
  }
  // gpt-5-chat-latest and similar are chat models, not reasoning models.
  const isChat = gpt.minor === undefined && gpt.variant?.startsWith("chat");
  if (isChat) {
    return { supportsTemperature: true, supportedReasoningEfforts: undefined };
  }
  if (gpt.major >= 6) {
    const solOrLuna = modelId === "gpt-6-sol" || modelId === "gpt-6-luna";
    return {
      supportsTemperature: false,
      supportedReasoningEfforts: solOrLuna
        ? GPT6_SOL_LUNA_EFFORTS
        : GPT6_EFFORTS,
    };
  }
  // gpt-5.1 and later accept temperature when reasoning is turned off.
  const acceptsNonReasoningParameters = (gpt.minor ?? 0) >= 1;
  return {
    supportsTemperature:
      reasoningEffort === "none" && acceptsNonReasoningParameters,
    supportedReasoningEfforts: undefined,
  };
}

/**
 * Some providers/models reject temperature entirely.
 *
 * OpenAI reasoning models (gpt-5 and later, the o-series) and search preview
 * models reject temperature, so callers should omit it. gpt-5.1 to gpt-5.x
 * accept it when `reasoningEffort` is "none".
 */
export function supportsTemperature(
  model?: string,
  reasoningEffort?: ReasoningEffort,
): boolean {
  return resolveTextModelCapabilities(model, reasoningEffort)
    .supportsTemperature;
}

export interface TextModelCapabilities {
  provider: string;
  supportsTemperature: boolean;
  /**
   * The reasoning efforts the model accepts; the SDK drops any other effort
   * with only a warning. Undefined when the model has no such limit.
   */
  supportedReasoningEfforts: readonly ReasoningEffort[] | undefined;
}

/**
 * Avoids running the model-pattern regex twice when both fields are needed.
 */
export function resolveTextModelCapabilities(
  model?: string,
  reasoningEffort?: ReasoningEffort,
): TextModelCapabilities {
  if (!model) {
    return {
      provider: "anthropic",
      supportsTemperature: true,
      supportedReasoningEfforts: undefined,
    };
  }
  const resolved = resolveTextProvider(model);
  if (resolved.provider !== "openai") {
    return {
      provider: resolved.provider,
      supportsTemperature: true,
      supportedReasoningEfforts: undefined,
    };
  }
  return {
    provider: resolved.provider,
    ...openAICapabilities(resolved.modelId, reasoningEffort),
  };
}

/**
 * Explains why a configured reasoning effort will not reach the model, or
 * returns undefined when it will.
 */
export function unsupportedReasoningEffort(
  model: string | undefined,
  reasoningEffort: ReasoningEffort | undefined,
): string | undefined {
  if (!reasoningEffort) return undefined;
  const { provider, supportedReasoningEfforts } = resolveTextModelCapabilities(
    model,
    reasoningEffort,
  );
  if (provider !== "openai" || !supportedReasoningEfforts) return undefined;
  if (supportedReasoningEfforts.includes(reasoningEffort)) return undefined;
  return `${model} does not support reasoningEffort "${reasoningEffort}"; supported: ${supportedReasoningEfforts.join(", ")}. The provider will use its default effort.`;
}
