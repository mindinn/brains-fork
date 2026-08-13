import { describe, it, expect } from "bun:test";
import type { LanguageModel } from "ai";
import {
  createProviderClients,
  getLanguageModel,
} from "../src/provider-clients";

/** `LanguageModel` is `string | LanguageModelV3`; only the latter carries an ID. */
function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

describe("getLanguageModel", () => {
  it("should resolve anthropic models", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "claude-haiku-4-5",
    });
    expect(modelIdOf(getLanguageModel(clients, "claude-haiku-4-5"))).toBe(
      "claude-haiku-4-5",
    );
  });

  it("should resolve openai models", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "gpt-4o-mini",
    });
    expect(modelIdOf(getLanguageModel(clients, "gpt-4o-mini"))).toBe(
      "gpt-4o-mini",
    );
  });

  it("should resolve google models", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
    });
    expect(modelIdOf(getLanguageModel(clients, "gemini-2.0-flash"))).toBe(
      "gemini-2.0-flash",
    );
  });

  it("should strip the explicit provider prefix from the SDK model ID", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "openai:gpt-4o-mini",
    });
    expect(modelIdOf(getLanguageModel(clients, "openai:gpt-4o-mini"))).toBe(
      "gpt-4o-mini",
    );
  });

  it("should throw instead of silently routing unknown providers to anthropic", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "groq:llama-3.1-70b",
    });
    expect(() => getLanguageModel(clients, "groq:llama-3.1-70b")).toThrow(
      /Unsupported text provider "groq"/,
    );
  });

  it("should throw for providers without a client implementation", () => {
    const clients = createProviderClients({
      apiKey: "test-key",
      model: "llama-3.1-8b",
    });
    expect(() => getLanguageModel(clients, "llama-3.1-8b")).toThrow(
      /Unsupported text provider "ollama"/,
    );
  });

  it("should throw when the resolved provider has no API key configured", () => {
    const clients = createProviderClients({ model: "gpt-4o-mini" });
    expect(() => getLanguageModel(clients, "gpt-4o-mini")).toThrow(
      /requires an OpenAI API key/,
    );
  });
});
