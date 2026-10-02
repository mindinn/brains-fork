---
"@brains/ai-service": patch
"@brains/core": patch
"@brains/web-chat": patch
"@rizom/brain": patch
---

Follow-up fixes for GPT-6 support.

- `o4-mini`, `o3`, `o1` and every other o-series model now go to OpenAI, not Anthropic.
- The `temperature` rules now match `@ai-sdk/openai`. `gpt-5-chat-latest` and other chat models keep `temperature`. Search preview models drop it. `gpt-5.1` and later GPT-5 models keep it when `reasoningEffort` is `none`.
- A `reasoningEffort` that the configured GPT-6 model does not accept now logs a warning. Before, the provider dropped it with no message.
- `maxTokens` is now sent as `maxOutputTokens`, so the provider applies it. Before, the limit was never sent. The 1000-token default is removed, so a brain without `maxTokens` keeps the current behavior (no limit).
- Guest turns on `gpt-6-luna` and `gpt-6-sol` are now priced at OpenAI's published rates. Other unpriced models are still charged the answer cap.
- The guest chat preset discloses the provider as "OpenAI", without a model name that can be wrong.
- `ai`, `@ai-sdk/anthropic`, `@ai-sdk/google` and `@ai-sdk/react` are updated so all AI SDK packages share one `@ai-sdk/provider` and `@ai-sdk/provider-utils`.
