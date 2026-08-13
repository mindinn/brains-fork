---
"@brains/ai-service": patch
"@brains/ai-evaluation": patch
"@brains/app": patch
---

Add Mistral as a text generation provider. `magistral`, `ministral`, `codestral`, `devstral`, `pixtral`, `open-mistral-*` and `open-mixtral-*` models auto-detect as `mistral`; bare `mistral-*` names stay on `ollama` because they collide with local Ollama tags, so the Mistral cloud API is reached for those with an explicit prefix (`mistral:mistral-large-latest`). Multi-model evals resolve the provider key from `MISTRAL_API_KEY`.

The app layer no longer strips the explicit `provider:model` prefix out of `brain.yaml` before handing the model to the AI service. Stripping it discarded the caller's provider choice and left the runtime's prefix support unreachable.
