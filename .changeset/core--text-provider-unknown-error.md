---
"@brains/ai-service": patch
---

Fail loudly when a text model resolves to a provider the AI service cannot construct. `getLanguageModel` previously fell through to the Anthropic client for every unhandled provider, so `ollama`/`groq`-style models and any unrecognised prefix were silently sent to the Anthropic API under their foreign model IDs. Unsupported providers, and resolved providers with no API key configured, now throw an error naming the provider and model.
