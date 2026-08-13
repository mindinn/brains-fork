/**
 * Resolve AI configuration from environment and brain.yaml overrides.
 *
 * Two env vars:
 *   AI_API_KEY   — primary key for text generation (and images if no override)
 *   AI_IMAGE_KEY — optional override for image generation (different provider)
 *
 * The model field determines the provider (resolved by AI service at runtime),
 * either by name or via an explicit "provider:model" prefix.
 */

import type { ReasoningEffort } from "./types";

/** Fields that resolveAIConfig adds to AppConfig */
export interface AIConfigFields {
  aiApiKey?: string;
  aiImageKey?: string;
  aiModel?: string;
  aiReasoningEffort?: ReasoningEffort;
}

export function resolveAIConfig(
  env: Record<string, string | undefined>,
  overrides?: { model?: string; reasoningEffort?: ReasoningEffort },
): AIConfigFields {
  const apiKey = env["AI_API_KEY"];
  const imageKey = env["AI_IMAGE_KEY"];

  const result: AIConfigFields = {};

  if (apiKey) {
    result.aiApiKey = apiKey;
  }
  if (imageKey) {
    result.aiImageKey = imageKey;
  }

  if (overrides?.model) {
    // Passed through verbatim: the AI service resolves the provider, and an
    // explicit "provider:model" prefix is how a caller overrides the
    // name-based auto-detection. Stripping it here would discard that choice.
    result.aiModel = overrides.model;
  }
  if (overrides?.reasoningEffort) {
    result.aiReasoningEffort = overrides.reasoningEffort;
  }

  return result;
}
