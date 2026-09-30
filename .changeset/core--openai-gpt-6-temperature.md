---
"@brains/ai-service": patch
"@rizom/brain": patch
---

Support GPT-6 chat models. `model: gpt-6-luna` and `model: gpt-6-sol` now omit `temperature` like the GPT-5 generation, and the bundled `@ai-sdk/openai` is updated to a release that knows the GPT-6 model ids. Before this change any `gpt-6-*` model was sent `temperature`, which OpenAI rejects while reasoning is enabled, so every generation call failed.
