# Project Guidelines

## Build and Test
- Install deps: `npm install`
- Build bundle: `npm run build` (outputs `dist/index.js`)
- Run tests: `npm test` (currently runs `tests/session-filter.test.ts` via `tsx`)
- After plugin code changes, restart gateway: `openclaw gateway restart`

## Architecture
- Entry point is `index.ts`; register tools/commands/RPC/service there.
- Session execution is CLI-based, not SDK-based: `src/session-cli.ts` spawns `claude` and communicates with `stream-json` events.
- Session lifecycle and limits are centralized in `src/session-manager.ts`.
- Notification policy and foreground/background streaming are in `src/notifications.ts`.
- Shared runtime singletons (`sessionManager`, `notificationRouter`, `pluginConfig`) live in `src/shared.ts` and are initialized on service start, then nulled on stop.

## Conventions
- Prefer the existing tool factory pattern: `registerTool((ctx) => makeXxxTool(ctx))`.
- Keep command handlers in `src/commands/*` and tool handlers in `src/tools/*`; mirror naming between command and tool where applicable.
- Preserve channel-resolution behavior in `src/shared.ts` (`channel|account|target|threadId` variants and fallback chain).
- Preserve multi-turn behavior in `src/session-cli.ts`: end-of-turn detection plus 15s safety-net idle detection.
- Keep foreground/background semantics intact: foreground streams debounced output; background only sends minimal notifications.

## Documentation Parity
- Treat docs as bilingual by default: when changing a user-facing or architecture doc in `docs/*.md`, update the corresponding `docs/*.zh_CN.md` file in the same change when applicable.
- Keep both language versions aligned on behavior, commands, config keys, and safety requirements; avoid introducing feature drift between English and Chinese docs.
- If only one language is updated temporarily, add a clear follow-up note in the same PR/commit context describing what still needs parity updates.

## Pitfalls
- Do not migrate to Anthropic SDK patterns; this fork intentionally uses Claude Code CLI subprocesses.
- Wake fallback via `openclaw system event --mode now` depends on heartbeat setup; empty/comment-only `HEARTBEAT.md` can cause wake failures.
- Metrics are in-memory only and reset on restart.
- Pre-launch safety checks are part of launch flow and should not be bypassed accidentally when editing launch logic.

## Files to Read First
- `CLAUDE.md` (project-specific architecture and operational rules)
- `index.ts` (registration and startup wiring)
- `src/session-cli.ts` (process orchestration and event parsing)
- `src/session-manager.ts` (session pool, persistence, GC, wake)
- `src/notifications.ts` (routing behavior and debounce)
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRELAUNCH_GUARDS.md`
- `docs/ARCHITECTURE.zh_CN.md`, `docs/DEVELOPMENT.zh_CN.md`, `docs/PRELAUNCH_GUARDS.zh_CN.md`
