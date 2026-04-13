# Codex Collaboration Modes vs DotCanvas Thread Modes

DotCanvas has an app-level thread mode called `start` that powers guided project intake.

That mode is not a native Codex app-server collaboration preset.

Codex app-server documents `collaborationMode` on `turn/start` and uses `settings.developer_instructions` as the customization hook for special behavior:

- reference: [Codex App Server API overview](https://developers.openai.com/codex/app-server#api-overview)

In this repo:

- `default`, `plan`, and `start` are DotCanvas thread interaction modes
- `default` maps to Codex `default`
- `plan` maps to Codex `plan`
- `start` also maps to Codex `plan`
- `start` reuses the exact same Codex plan developer instructions as `plan`
- the Start-specific behavior comes from the auto-seeded project-intake prompt, not from a separate provider collaboration prompt

Why:

- DotCanvas needs a visible onboarding state in the product model
- Start Mode should behave like real Plan Mode in the UI and tool/runtime behavior
- the guided intake and setup behavior should ride on top of the known-good Plan collaboration flow

Rule of thumb:

- treat `interactionMode` as a DotCanvas/orchestration concept
- translate it at the Codex boundary right before `turn/start`
- never send `mode: "start"` to Codex app-server
- use Codex `plan` for DotCanvas `start` when you need real structured-question and proposal behavior
- if Start needs special behavior, express it in the seeded intake prompt instead of forking the provider collaboration instructions
