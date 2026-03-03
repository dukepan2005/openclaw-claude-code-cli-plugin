# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands

```bash
# Build the plugin (bundles to dist/index.js)
npm run build

# Run tests (uses tsx)
npm test
```

After building, restart the OpenClaw gateway to pick up changes:
```bash
openclaw gateway restart
```

## High-Level Architecture

This is an OpenClaw plugin that orchestrates Claude Code sessions as managed background processes. It enables AI agents to spawn, monitor, and control Claude Code coding sessions from messaging platforms (Telegram, Discord, etc.).

### Core Components

- **`index.ts`** - Plugin entry point. Registers 8 tools, 10 commands, 5 gateway RPC methods, and 1 service. Creates SessionManager and NotificationRouter during service start.

- **`src/session-cli.ts`** - Wraps a single Claude Code session using the Claude Code CLI via `child_process.spawn()`. Handles output buffering, foreground streaming, multi-turn conversations via `--input-format stream-json`, and waiting-for-input detection with a 15s safety-net timer. Uses `stream-json` output format for event parsing.

- **`src/session.ts`** - Legacy SDK-based session implementation (not currently used). Kept for reference.

- **`src/session-manager.ts`** - Manages the pool of sessions. Enforces `maxSessions` limit, handles GC of completed sessions (1 hour after completion), persists session IDs for resume support, tracks aggregated metrics, and orchestrates wake events via detached subprocesses.

- **`src/notifications.ts`** - NotificationRouter decides when/what to notify based on session state and foreground/background mode. Implements debounced foreground streaming (500ms per channel), long-running reminders (>10min), and lifecycle notifications.

- **`src/shared.ts`** - Module-level mutable references for `sessionManager`, `notificationRouter`, and `pluginConfig`. Set during service start, nulled during stop. Helper functions for channel resolution, formatting, and stats.

- **`src/gateway.ts`** - Registers RPC methods that external processes can call via `openclaw gateway rpc`.

- **`src/tools/*.ts`** - Tool implementations. Each uses a factory function pattern: `registerTool((ctx) => makeXxxTool(ctx))` where `ctx` contains calling agent's runtime info (agentId, workspaceDir, messageChannel, etc.).

- **`src/commands/*.ts`** - Slash command implementations (`/claude`, `/claude_sessions`, etc.). Called directly from chat platforms.

## Key Design Patterns

### Tool Factory Pattern
Tools are registered as factory functions that receive `OpenClawPluginToolContext`:
```typescript
api.registerTool((ctx: OpenClawPluginToolContext) => makeClaudeLaunchTool(ctx));
```
Context contains: `agentId`, `workspaceDir`, `messageChannel`, `agentAccountId`, `sandboxed`, `sessionKey`.

### Multi-Turn Sessions
Multi-turn sessions use `--input-format stream-json` to enable continuous stdin communication. Messages are written as JSON objects to the CLI's stdin. End-of-turn is detected when the CLI returns a `result` event with `subtype: "success"` — the session stays in "running" status for follow-up messages. Interrupts are sent via ESC character (`\x1B`).

### Waiting for Input Detection (Dual Mechanism)
1. **Primary**: End-of-turn detection in multi-turn mode (when `result.subtype === "success"`)
2. **Safety-net**: 15s timer that fires if NO messages arrive (text, tool_use, result)
A `waitingForInputFired` flag prevents duplicate wake events.

### Two-Tier Wake System
- **Tier 1** (primary): Spawns detached `openclaw agent --agent <id> --message <text> --deliver` process. No heartbeat dependency.
- **Tier 2** (fallback): Uses `openclaw system event --mode now` which requires heartbeat configuration. Has a known bug where empty HEARTBEAT.md files cause silent failure.

### Channel Resolution
Channel strings follow these formats:
- `channel|target` (2 segments, basic) e.g., `telegram|123456789`
- `channel|account|target` (3 segments, with account) e.g., `telegram|my-agent|123456789`
- `channel|account|target|threadId` (4 segments, with topic) e.g., `telegram|my-agent|-1001234567890|42`
- `123456789` (bare numeric, assumed Telegram)

The `resolveOriginChannel()` function in `shared.ts` implements the fallback chain.

### Foreground/Background Model
- **Foreground**: Session output streams in real-time to subscribed channels (debounced 500ms). Multiple channels can watch the same session.
- **Background**: Minimal notifications only (questions, completion). Session output is buffered but not streamed.
Per-channel output offsets track what each channel has seen for catchup on re-foreground.

### Session Persistence
Completed sessions are garbage-collected after 1 hour, but their Claude session IDs are retained in `persistedSessions` map (keys: internal ID, name, and Claude UUID) for resume support.

### Pre-Launch Safety Checks
Four safety checks (can be skipped via `skipSafetyChecks` config):
1. **Autonomy skill**: Requires `skills/claude-code-autonomy/SKILL.md` in agent workspace
2. **Heartbeat config**: Agent must have heartbeat enabled in `~/.openclaw/openclaw.json`
3. **HEARTBEAT.md**: Must exist with real content (not just comments/whitespace)
4. **Agent channels**: Workspace must be mapped in `agentChannels` config

## Configuration Schema

Config is read from `~/.openclaw/openclaw.json` under `plugins.entries["openclaw-claude-code-plugin"].config`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSessions` | number | 5 | Concurrent session limit |
| `defaultBudgetUsd` | number | 5 | Default budget per session |
| `defaultModel` | string | — | Default model (e.g., "sonnet") |
| `defaultWorkdir` | string | — | Default working directory |
| `idleTimeoutMinutes` | number | 30 | Auto-kill idle multi-turn sessions |
| `maxPersistedSessions` | number | 50 | Max completed sessions to keep for resume |
| `fallbackChannel` | string | — | Default notification channel (e.g., "telegram|123456789") |
| `permissionMode` | string | "bypassPermissions" | Claude Code permission mode |
| `agentChannels` | object | — | Map workdir paths → notification channels |
| `maxAutoResponds` | number | 10 | Max consecutive agent auto-responds |
| `skipSafetyChecks` | boolean | false | Skip all pre-launch guards (dev only) |

## Adding a New Tool or Command

1. Create a new file in `src/tools/` or `src/commands/`
2. Export a factory function: `export function makeXxxTool(ctx: OpenClawPluginToolContext)`
3. In `index.ts`, import and register in the `register()` function

Tools receive context; commands receive `api` with `registerCommand()`.

## Session Lifecycle

```
spawn() → Session created → "starting"
  → CLI process spawned with stream-json output
  → CLI init message → "running"
  → Output arrives → onOutput callback → NotificationRouter.onAssistantText()
  → Tool use → onToolUse callback → NotificationRouter.onToolUse()
  → End-of-turn (multi-turn) → onWaitingForInput callback → wakeAgent()
  → Completion → onComplete callback → persistSession() → triggerAgentEvent()
  → GC after 1 hour → Session removed, ID retained in persistedSessions
```

## Important Constants

- `OUTPUT_BUFFER_MAX = 200` (lines of output per session)
- `DEBOUNCE_MS = 500` (foreground streaming debounce)
- `LONG_RUNNING_THRESHOLD_MS = 10 * 60 * 1000` (reminder timing)
- `CLEANUP_MAX_AGE_MS = 60 * 60 * 1000` (GC timing)
- `WAITING_EVENT_DEBOUNCE_MS = 5_000` (wake event debounce)
- `SAFETY_NET_IDLE_MS = 15_000` (fallback waiting-for-input timer)
