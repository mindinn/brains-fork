---
"@brains/auth-service": patch
"@rizom/brain": patch
---

Stop the first-passkey setup tool from handing out a dead `/setup` URL. `brain start` runs a web and a worker runtime on one auth database, and each saves an untargeted setup token at startup, which consumes the other. The web runtime then revealed its consumed in-memory token, and `/setup` answered 404. The setup flow now checks the in-memory token against the store before it reveals it, and mints a fresh one when another runtime consumed it.
