import { describe, it, expect } from "bun:test";
import { resolveAIConfig } from "../src/ai-config";

describe("resolveAIConfig", () => {
  it("should use AI_API_KEY as the single key", () => {
    const config = resolveAIConfig({ AI_API_KEY: "sk-test" });
    expect(config.aiApiKey).toBe("sk-test");
  });

  it("should return no key when AI_API_KEY not set", () => {
    const config = resolveAIConfig({});
    expect(config.aiApiKey).toBeUndefined();
  });

  it("should pass model through when specified", () => {
    const config = resolveAIConfig(
      { AI_API_KEY: "sk-test" },
      { model: "gpt-4o-mini" },
    );
    expect(config.aiModel).toBe("gpt-4o-mini");
    expect(config.aiApiKey).toBe("sk-test");
  });

  it("should preserve an explicit provider prefix on the model", () => {
    const config = resolveAIConfig(
      { AI_API_KEY: "sk-test" },
      { model: "openai:gpt-4o-mini" },
    );
    expect(config.aiModel).toBe("openai:gpt-4o-mini");
  });

  it("should preserve a prefix that overrides name-based detection", () => {
    // "mistral-large-latest" auto-detects as ollama; the prefix is the only
    // way to reach the Mistral cloud API, so it must survive this layer.
    const config = resolveAIConfig(
      { AI_API_KEY: "sk-test" },
      { model: "mistral:mistral-large-latest" },
    );
    expect(config.aiModel).toBe("mistral:mistral-large-latest");
  });

  it("should not set model when no model specified", () => {
    const config = resolveAIConfig({ AI_API_KEY: "sk-test" });
    expect(config.aiModel).toBeUndefined();
  });

  it("should pass through configured reasoning effort", () => {
    const config = resolveAIConfig(
      { AI_API_KEY: "sk-test" },
      { model: "gpt-5.6-luna", reasoningEffort: "low" },
    );

    expect(config.aiModel).toBe("gpt-5.6-luna");
    expect(config.aiReasoningEffort).toBe("low");
  });

  describe("AI_IMAGE_KEY", () => {
    it("should use AI_IMAGE_KEY as separate image key", () => {
      const config = resolveAIConfig({
        AI_API_KEY: "sk-anthropic",
        AI_IMAGE_KEY: "sk-openai",
      });
      expect(config.aiApiKey).toBe("sk-anthropic");
      expect(config.aiImageKey).toBe("sk-openai");
    });

    it("should not set aiImageKey when AI_IMAGE_KEY absent", () => {
      const config = resolveAIConfig({ AI_API_KEY: "sk-test" });
      expect(config.aiImageKey).toBeUndefined();
    });

    it("should allow AI_IMAGE_KEY without AI_API_KEY", () => {
      const config = resolveAIConfig({ AI_IMAGE_KEY: "sk-openai" });
      expect(config.aiApiKey).toBeUndefined();
      expect(config.aiImageKey).toBe("sk-openai");
    });
  });
});
