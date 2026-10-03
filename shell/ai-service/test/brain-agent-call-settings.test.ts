import { describe, expect, it } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import { createMockMessageBus } from "@brains/messaging-service/test";
import { createBrainAgentFactory } from "../src/brain-agent";
import type { BrainCallOptions } from "../src/agent-types";

type ModelResponse = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;

function answer(): ModelResponse {
  return {
    content: [{ type: "text", text: "Answer" }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  };
}

const options: BrainCallOptions = {
  interfaceType: "cli",
  userPermissionLevel: "admin",
  isAnchor: true,
  conversationId: "owner",
};

async function callSettings(
  modelId: string,
  settings: { maxTokens?: number } = {},
): Promise<MockLanguageModelV3["doGenerateCalls"][number]> {
  const model = new MockLanguageModelV3({
    doGenerate: async (): Promise<ModelResponse> => answer(),
  });
  const agent = createBrainAgentFactory({
    model,
    modelId,
    webSearch: false,
    temperature: 0.4,
    ...settings,
    messageBus: createMockMessageBus(),
  })({
    identity: {
      name: "Brain",
      role: "Role",
      purpose: "Purpose",
      values: ["Values"],
    },
    profile: { name: "Owner", description: "Owner profile" },
    pluginInstructions: [],
    agentInstructions: [],
    tools: [],
    getToolsForPermission: () => [],
    stepLimit: 1,
  });
  await agent.generate({
    messages: [{ role: "user", content: "Hello" }],
    options,
  });
  const call = model.doGenerateCalls[0];
  if (!call) throw new Error("Expected a provider call");
  return call;
}

describe("BrainAgent call settings", () => {
  it("omits temperature for GPT-6 models", async () => {
    expect((await callSettings("gpt-6-luna")).temperature).toBeUndefined();
  });

  it("keeps temperature for models that accept it", async () => {
    expect((await callSettings("claude-sonnet-4-6")).temperature).toBe(0.4);
  });

  it("sends the configured output limit as maxOutputTokens", async () => {
    const call = await callSettings("gpt-6-luna", { maxTokens: 800 });
    expect(call.maxOutputTokens).toBe(800);
  });
});
