import { describe, it, expect } from "bun:test";
import {
  resolveTextProvider,
  selectTextProvider,
  selectImageProvider,
  supportsTemperature,
  unsupportedReasoningEffort,
} from "../src/provider-selection";

describe("selectTextProvider", () => {
  it("should default to anthropic when no model specified", () => {
    expect(selectTextProvider()).toBe("anthropic");
  });

  it("should detect anthropic from claude model", () => {
    expect(selectTextProvider("claude-haiku-4-5-20251001")).toBe("anthropic");
    expect(selectTextProvider("claude-sonnet-4-6")).toBe("anthropic");
  });

  it("should detect openai from gpt model", () => {
    expect(selectTextProvider("gpt-4o-mini")).toBe("openai");
    expect(selectTextProvider("gpt-4o")).toBe("openai");
  });

  it("should detect openai from o-series model", () => {
    expect(selectTextProvider("o1-preview")).toBe("openai");
    expect(selectTextProvider("o3-mini")).toBe("openai");
    expect(selectTextProvider("o4-mini")).toBe("openai");
    expect(selectTextProvider("o3")).toBe("openai");
    expect(selectTextProvider("o1")).toBe("openai");
  });

  it("should detect google from gemini model", () => {
    expect(selectTextProvider("gemini-2.0-flash")).toBe("google");
  });

  it("should detect ollama from local model names", () => {
    expect(selectTextProvider("llama-3.1-8b")).toBe("ollama");
    expect(selectTextProvider("mistral-7b")).toBe("ollama");
    expect(selectTextProvider("phi-3")).toBe("ollama");
    expect(selectTextProvider("qwen-2.5")).toBe("ollama");
  });

  it("should handle explicit provider prefix", () => {
    expect(selectTextProvider("openai:gpt-4o-mini")).toBe("openai");
    expect(selectTextProvider("anthropic:claude-haiku-4-5")).toBe("anthropic");
    expect(selectTextProvider("groq:llama-3.1-70b")).toBe("groq");
  });

  it("should fall back to anthropic for unknown model", () => {
    expect(selectTextProvider("some-unknown-model")).toBe("anthropic");
  });
});

describe("resolveTextProvider", () => {
  it("should return provider and SDK model ID for explicit prefixes", () => {
    expect(resolveTextProvider("openai:gpt-4o-mini")).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
    });
  });

  it("should return original model ID for auto-detected models", () => {
    expect(resolveTextProvider("claude-haiku-4-5")).toEqual({
      provider: "anthropic",
      modelId: "claude-haiku-4-5",
    });
  });
});

describe("supportsTemperature", () => {
  it("should allow temperature for non-reasoning models", () => {
    expect(supportsTemperature("claude-haiku-4-5")).toBe(true);
    expect(supportsTemperature("gpt-4o-mini")).toBe(true);
    expect(supportsTemperature("openai:gpt-4o-mini")).toBe(true);
  });

  it("should disable temperature for OpenAI reasoning models", () => {
    expect(supportsTemperature("gpt-5.4-mini")).toBe(false);
    expect(supportsTemperature("openai:gpt-5.4-mini")).toBe(false);
    expect(supportsTemperature("o3-mini")).toBe(false);
  });

  it("should disable temperature for GPT-6 and later generations", () => {
    expect(supportsTemperature("gpt-6-luna")).toBe(false);
    expect(supportsTemperature("gpt-6-sol")).toBe(false);
    expect(supportsTemperature("gpt-6.1-sol")).toBe(false);
    expect(supportsTemperature("openai:gpt-6-luna")).toBe(false);
    expect(supportsTemperature("gpt-10-luna")).toBe(false);
  });

  it("should keep temperature for GPT-4 generation models", () => {
    expect(supportsTemperature("gpt-4.1")).toBe(true);
  });

  it("should disable temperature for search preview models", () => {
    expect(supportsTemperature("gpt-4o-search-preview")).toBe(false);
    expect(supportsTemperature("gpt-4o-mini-search-preview")).toBe(false);
  });

  it("should keep temperature for GPT chat models", () => {
    expect(supportsTemperature("gpt-5-chat-latest")).toBe(true);
    expect(supportsTemperature("gpt-6-chat-latest")).toBe(true);
  });

  it("should disable temperature for every o-series generation", () => {
    expect(supportsTemperature("o4-mini")).toBe(false);
    expect(supportsTemperature("o3")).toBe(false);
    expect(supportsTemperature("openai:o10-mini")).toBe(false);
  });

  it("should keep temperature for gpt-5.1+ when reasoning is off", () => {
    expect(supportsTemperature("gpt-5.6-luna", "none")).toBe(true);
    expect(supportsTemperature("gpt-5.6-luna", "low")).toBe(false);
    expect(supportsTemperature("gpt-5-mini", "none")).toBe(false);
    expect(supportsTemperature("gpt-6-luna", "none")).toBe(false);
  });
});

describe("unsupportedReasoningEffort", () => {
  it("should flag efforts a GPT-6 model does not accept", () => {
    expect(unsupportedReasoningEffort("gpt-6-astra", "none")).toContain(
      'does not support reasoningEffort "none"',
    );
    expect(unsupportedReasoningEffort("gpt-6.1-sol", "none")).toBeDefined();
  });

  it("should accept supported efforts and other models", () => {
    expect(unsupportedReasoningEffort("gpt-6-luna", "none")).toBeUndefined();
    expect(unsupportedReasoningEffort("gpt-6-astra", "low")).toBeUndefined();
    expect(unsupportedReasoningEffort("gpt-5.6-luna", "none")).toBeUndefined();
    expect(
      unsupportedReasoningEffort("claude-sonnet-4-6", "none"),
    ).toBeUndefined();
    expect(
      unsupportedReasoningEffort("gpt-6-astra", undefined),
    ).toBeUndefined();
  });
});

describe("selectImageProvider", () => {
  it("should default to openai when no model specified", () => {
    expect(selectImageProvider()).toEqual({
      provider: "openai",
      modelId: "gpt-image-1.5",
    });
  });

  it("should detect openai from gpt-image model", () => {
    expect(selectImageProvider("gpt-image-1.5")).toEqual({
      provider: "openai",
      modelId: "gpt-image-1.5",
    });
  });

  it("should detect google from gemini image model", () => {
    expect(selectImageProvider("gemini-3-pro-image-preview")).toEqual({
      provider: "google",
      modelId: "gemini-3-pro-image-preview",
    });
    expect(selectImageProvider("gemini-2.5-flash-image")).toEqual({
      provider: "google",
      modelId: "gemini-2.5-flash-image",
    });
  });

  it("should handle explicit provider prefix", () => {
    expect(selectImageProvider("openai:gpt-image-1.5")).toEqual({
      provider: "openai",
      modelId: "gpt-image-1.5",
    });
    expect(selectImageProvider("google:gemini-3-pro-image-preview")).toEqual({
      provider: "google",
      modelId: "gemini-3-pro-image-preview",
    });
  });

  it("should detect google from any gemini model", () => {
    expect(selectImageProvider("gemini-2.0-flash")).toEqual({
      provider: "google",
      modelId: "gemini-2.0-flash",
    });
  });

  it("should fall back to openai for unknown model", () => {
    expect(selectImageProvider("some-unknown-model")).toEqual({
      provider: "openai",
      modelId: "some-unknown-model",
    });
  });
});
