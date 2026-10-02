import type {
  GuestTurnCost,
  GuestTurnSettlement,
} from "@brains/contracts/chat";
import type { LanguageModelUsage } from "ai";
import type { EmbeddingUsage } from "./embedding-usage-meter";

/** What the provider reported for each model call of a guest turn. */
export interface GuestProviderUsage {
  calls: Array<{
    input: number;
    cacheRead: number | undefined;
    cacheWrite: number | undefined;
    /** Includes reasoning, as the provider bills it. */
    output: number;
  }>;
}

/** Prices a guest turn's reported usage; absent when the model is unpriced. */
export type GuestPricing = (usage: GuestProviderUsage) => GuestTurnCost;

/** Nano-dollars per token, so every published rate is an integer. */
interface TierRates {
  input: number;
  /** Undefined when the provider does not publish this rate. */
  cacheRead: number | undefined;
  cacheWrite: number;
  output: number;
}

interface ModelRates {
  revision: string;
  standard: TierRates;
  /** Applies to the whole request above LONG_CONTEXT_THRESHOLD input tokens. */
  long: TierRates;
}

const LONG_CONTEXT_THRESHOLD = 272_000;

/**
 * Published gpt-5.6-luna rates, read on 2026-09-26
 * from https://developers.openai.com/api/docs/models/gpt-5.6-luna: per 1M
 * tokens, input $0.20, cached input $0.02, output $1.20 up to 272K input
 * tokens; above that, 2× input and 1.5× output for the whole request. Cache
 * writes cost 1.25× uncached input. Output includes reasoning. The long-context cached-input rate is not
 * published, so such a request is left unknown rather than guessed.
 */
export const openAiGuestPricingRevision = "openai-gpt-5.6-luna-2026-09-26";

/**
 * Published GPT-6 rates, read on 2026-10-01 from
 * https://developers.openai.com/api/docs/models/gpt-6-luna and
 * https://developers.openai.com/api/docs/models/gpt-6-sol: per 1M tokens,
 * gpt-6-luna input $0.10, cached input $0.01, cache writes $0.125, output
 * $0.50; gpt-6-sol input $2, cached input $0.20, cache writes $2.50, output
 * $10. Above 272K input tokens, 2× input and cache rates and 1.5× output for
 * the whole request. Output includes reasoning.
 */
const gpt56LunaRates: ModelRates = {
  revision: openAiGuestPricingRevision,
  standard: { input: 200, cacheRead: 20, cacheWrite: 250, output: 1200 },
  long: { input: 400, cacheRead: undefined, cacheWrite: 500, output: 1800 },
};

const modelRates: Readonly<Record<string, ModelRates>> = {
  "gpt-5.6-luna": gpt56LunaRates,
  "gpt-6-luna": {
    revision: "openai-gpt-6-luna-2026-10-01",
    standard: { input: 100, cacheRead: 10, cacheWrite: 125, output: 500 },
    long: { input: 200, cacheRead: 20, cacheWrite: 250, output: 750 },
  },
  "gpt-6-sol": {
    revision: "openai-gpt-6-sol-2026-10-01",
    standard: { input: 2000, cacheRead: 200, cacheWrite: 2500, output: 10000 },
    long: { input: 4000, cacheRead: 400, cacheWrite: 5000, output: 15000 },
  },
};

type Priced = { nano: number } | Extract<GuestTurnCost, { state: "unknown" }>;

function priceCall(
  rates: ModelRates,
  call: GuestProviderUsage["calls"][number],
): Priced {
  if (call.cacheRead === undefined)
    return { state: "unknown", reason: "missing-usage" };
  // The guest wire policy sends no cache writes; the provider reports none.
  const cacheWrite = call.cacheWrite ?? 0;
  const uncached = call.input - call.cacheRead - cacheWrite;
  if (uncached < 0) return { state: "unknown", reason: "missing-usage" };
  const tier =
    call.input > LONG_CONTEXT_THRESHOLD ? rates.long : rates.standard;
  if (call.cacheRead > 0 && tier.cacheRead === undefined)
    return { state: "unknown", reason: "unsupported-pricing" };
  return {
    nano:
      uncached * tier.input +
      call.cacheRead * (tier.cacheRead ?? 0) +
      cacheWrite * tier.cacheWrite +
      call.output * tier.output,
  };
}

function priceTurn(
  rates: ModelRates,
  usage: GuestProviderUsage,
): GuestTurnCost {
  const parts: Priced[] = usage.calls.map((call) => priceCall(rates, call));
  const unknown = parts.find(
    (part): part is Extract<Priced, { state: "unknown" }> => "state" in part,
  );
  if (unknown) return unknown;
  const nano = parts.reduce(
    (sum, part) => sum + ("nano" in part ? part.nano : 0),
    0,
  );
  return {
    state: "known",
    microUsd: Math.ceil(nano / 1000),
    pricing: rates.revision,
  };
}

/** A gpt-5.6-luna guest turn's cost from the provider's reported usage; never a quote. */
export function priceOpenAiGuestTurn(usage: GuestProviderUsage): GuestTurnCost {
  return priceTurn(gpt56LunaRates, usage);
}

/**
 * Guest pricing for a configured text model, or undefined when its published
 * rates are not known. Accepts the "openai:" prefix.
 */
export function openAiGuestPricing(
  model: string | undefined,
): GuestPricing | undefined {
  if (!model) return undefined;
  const rates = modelRates[model.replace(/^openai:/, "")];
  return rates ? (usage): GuestTurnCost => priceTurn(rates, usage) : undefined;
}

/**
 * A guest turn's settlement from each model call's reported usage. A call that
 * reported no usage, or a model without pricing, leaves the cost unknown.
 */
export function guestTurnSettlement(
  steps: ReadonlyArray<{ usage?: LanguageModelUsage | undefined }>,
  pricing: GuestPricing | undefined,
): GuestTurnSettlement {
  const calls = steps.flatMap(({ usage }) =>
    usage?.inputTokens === undefined || usage.outputTokens === undefined
      ? []
      : [
          {
            input: usage.inputTokens,
            cacheRead: usage.inputTokenDetails.cacheReadTokens,
            cacheWrite: usage.inputTokenDetails.cacheWriteTokens,
            output: usage.outputTokens,
            reasoning: usage.outputTokenDetails.reasoningTokens ?? 0,
          },
        ],
  );
  const sum = (values: Array<number | undefined>): number =>
    values.reduce<number>((total, value) => total + (value ?? 0), 0);
  const missing = calls.length !== steps.length;
  return {
    usage: {
      modelCalls: steps.length,
      inputTokens: sum(calls.map((call) => call.input)),
      cachedInputTokens: sum(calls.map((call) => call.cacheRead)),
      outputTokens: sum(calls.map((call) => call.output)),
      reasoningTokens: sum(calls.map((call) => call.reasoning)),
      embeddingTokens: 0,
    },
    cost: missing
      ? { state: "unknown", reason: "missing-usage" }
      : pricing
        ? pricing({ calls })
        : { state: "unknown", reason: "unsupported-pricing" },
  };
}

/**
 * Published text-embedding-3-small rate, read on 2026-09-30 from
 * https://developers.openai.com/api/docs/models/text-embedding-3-small:
 * $0.02 per 1M tokens.
 */
export const openAiEmbeddingPricingRevision =
  "openai-text-embedding-3-small-2026-09-30";

/** Hundredths of a micro-dollar per token, by embedding model. */
const embeddingRates: Readonly<Record<string, number>> = {
  "text-embedding-3-small": 2,
};

/**
 * A guest turn's settlement with the embeddings it made: its searches and the
 * search that found its sources. Their tokens always count; their cost joins
 * a known cost at the model's rate, and an unpriced model leaves it unknown.
 */
export function withEmbeddingUsage(
  settlement: GuestTurnSettlement,
  embeddings: readonly EmbeddingUsage[],
): GuestTurnSettlement {
  if (embeddings.length === 0) return settlement;
  const tokens = embeddings.reduce((sum, call) => sum + call.tokens, 0);
  const usage = {
    ...settlement.usage,
    embeddingTokens: settlement.usage.embeddingTokens + tokens,
  };
  if (settlement.cost.state === "unknown")
    return { usage, cost: settlement.cost };
  const centis = embeddings.map((call) => {
    const rate = embeddingRates[call.model];
    return rate === undefined ? undefined : call.tokens * rate;
  });
  if (centis.includes(undefined))
    return { usage, cost: { state: "unknown", reason: "unsupported-pricing" } };
  const centi = centis.reduce<number>((sum, part) => sum + (part ?? 0), 0);
  return {
    usage,
    cost: {
      state: "known",
      microUsd: settlement.cost.microUsd + Math.ceil(centi / 100),
      pricing: `${settlement.cost.pricing}+${openAiEmbeddingPricingRevision}`,
    },
  };
}
