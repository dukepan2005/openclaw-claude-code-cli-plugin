# Architecture — OpenClaw Claude Code Plugin

## Overview

OpenClaw plugin that enables AI agents to orchestrate Claude Code sessions from messaging channels (Telegram, Discord, Rocket.Chat). Agents can spawn, monitor, resume, and manage Claude Code as background development tasks.

## System Context

```
User (Telegram/Discord) → OpenClaw Gateway → Agent → Plugin Tools → Claude Code Sessions
                                                  ↓
                                        NotificationRouter → openclaw message send → User
```

## Core Components

### 1. Plugin Entry (`index.ts`)
- Registers 8 tools, 8 commands, 5 gateway RPC methods, and 1 service
- Creates SessionManager and NotificationRouter during service start
- Wires outbound messaging via `openclaw message send` CLI

### 2. SessionManager (`src/session-manager.ts`)
- Manages lifecycle of Claude Code processes (spawn, track, kill, resume)
- Enforces `maxSessions` concurrent limit
- Persists completed sessions for resume (up to `maxPersistedSessions`)
- GC interval cleans up stale sessions every 5 minutes

### 3. Session (`src/session-cli.ts`)

- Wraps a single Claude Code CLI process via `child_process.spawn`
- Handles output buffering, foreground streaming, and multi-turn conversation
- Implements waiting-for-input detection with 15s safety-net timer
- Double-firing guard (`waitingForInputFired`) prevents duplicate wake events

### 4. NotificationRouter (`src/notifications.ts`)
- Routes notifications to appropriate channels based on session state
- Debounced foreground streaming (500ms per channel per session)
- Background mode: minimal notifications (only questions and responses)
- Long-running session reminders (>10min, once per session)
- Completion/failure notifications in foreground only

### 5. Shared State (`src/shared.ts`)
- Module-level mutable references: `sessionManager`, `notificationRouter`, `pluginConfig`
- Set during service `start()`, nulled during `stop()`

## Data Flow

### Session Launch
```
Agent calls claude_launch → tool validates params → SessionManager.spawn()
  → Session created with PTY → Claude Code process starts
  → Origin channel stored for notifications
  → Pre-launch safety checks (autonomy skill, heartbeat config)
```

### Waiting for Input (Wake) — Two-Tier Mechanism
```
Session detects idle (end-of-turn or 15s timer)
  → NotificationRouter.onWaitingForInput()
  → Background: 🔔 notification to origin channel

Wake tier 1 — Primary (spawn detached):
  → openclaw agent --agent <id> --message <text> --deliver
  → Spawns detached process → delivers message directly
  → Independent of heartbeat configuration

Wake tier 2 — Fallback (system event, requires heartbeat):
  → openclaw system event --mode now
  → Triggers immediate heartbeat with reason="wake"
  → Only used when originAgentId is missing
  → REQUIRES heartbeat configured on agent (no config = silent no-op)

  → Orchestrator agent wakes up, reads output, forwards to user
```

#### Heartbeat dependency for fallback wake

The fallback path (`system event --mode now`) depends on the OpenClaw heartbeat pipeline:
- It triggers an immediate heartbeat with `reason="wake"`
- The `"wake"` reason is **not exempted** from `isHeartbeatContentEffectivelyEmpty` (unlike `"exec-event"` and `"cron:*"` reasons)
- **Bug [#14527](https://github.com/openclaw/openclaw/issues/14527)**: If `HEARTBEAT.md` is empty or contains only comments, the wake is silently skipped — CLI returns "ok" but the agent is never woken. This is a known OpenClaw defect where the empty-content guard incorrectly applies to wake events.
- Pre-launch checks validate that heartbeat is configured, but do not validate that `HEARTBEAT.md` has effective (non-empty, non-comment-only) content.

### Session Completion
```
Claude Code process exits
  → Session status → completed/failed
  → System event broadcast
  → Orchestrator agent retrieves output, summarizes to user
```

## Key Design Decisions

1. **CLI for outbound messages** — No runtime API for sending messages; uses `openclaw message send` subprocess
2. **Two-tier wake** — Primary: detached spawn `openclaw agent --message --deliver` (no heartbeat dependency). Fallback: `openclaw system event --mode now` (requires heartbeat; see bug [#14527](https://github.com/openclaw/openclaw/issues/14527) re: empty HEARTBEAT.md)
3. **PTY-based sessions** — Full terminal emulation for Claude Code compatibility
4. **Background notification suppression** — Completion/failure suppressed in background; orchestrator handles user-facing summaries
5. **maxAutoResponds limit** — Prevents infinite agent loops; resets on user interaction (`userInitiated: true`)
6. **Channel propagation** — Tools accept optional `channel` param to route to correct user instead of falling back to "unknown"

## OpenClaw Context Types

The plugin receives context from OpenClaw when tools and commands are invoked. Understanding these types is essential for proper channel resolution and message routing.

### PluginCommandContext

Passed to command handlers registered via `api.registerCommand()`:

```typescript
type PluginCommandContext = {
  senderId?: string;          // Sender's identifier (e.g., Telegram user ID)
  channel: string;            // The channel/surface (e.g., "telegram", "discord")
  channelId?: ChannelId;      // Provider channel id (e.g., "telegram")
  isAuthorizedSender: boolean;// Whether the sender is on the allowlist
  args?: string;              // Raw command arguments after the command name
  commandBody: string;        // The full normalized command body
  config: OpenClawConfig;     // Current OpenClaw configuration
  from?: string;              // Raw "From" value (source, with group/topic info)
  to?: string;                // Raw "To" value (target chat ID)
  accountId?: string;         // Account id for multi-account channels
  messageThreadId?: number;   // Thread/topic id if available
};
```

### ctx.to vs ctx.from

- **`ctx.to`** — The TARGET chat where the message was sent. This is where replies should go.
  - Example: `"telegram:-1003889434099"` (a Telegram group)
- **`ctx.from`** — The SOURCE with potentially more complex structure.
  - Example: `"telegram:group:-1003889434099:topic:2"` (includes group and topic info)

**Use `ctx.to` for channel resolution** because we want to reply to the chat/group, not to the individual sender.

### OpenClawPluginToolContext

Passed to tool factories registered via `api.registerTool((ctx) => ...)`:

```typescript
type OpenClawPluginToolContext = {
  config?: OpenClawConfig;     // Full OpenClaw configuration
  workspaceDir?: string;       // Agent's workspace directory
  agentDir?: string;           // Agent's config directory
  agentId?: string;            // Agent identifier
  sessionKey?: string;         // Session key for the conversation
  messageChannel?: string;     // Channel to send messages to
  agentAccountId?: string;     // Agent's account ID
  sandboxed?: boolean;         // Whether running in sandbox mode
};
```

### Channel Resolution

The `resolveOriginChannel()` function in `src/shared.ts` converts context to a normalized channel string:

- Format: `channel|account|target|threadId` (segments vary)
- Example: `"telegram|default|-1003889434099|2"` (Telegram group with topic)

See `src/shared.ts` for the full implementation with detailed comments.

## Configuration

See `openclaw.plugin.json` for full config schema. Key settings:
- `maxSessions` (5) — concurrent session limit
- `fallbackChannel` — default notification target
- `idleTimeoutMinutes` (30) — auto-kill for idle multi-turn sessions
- `maxAutoResponds` (10) — agent auto-respond limit per session
- `permissionMode` (bypassPermissions) — Claude Code permission mode

## Sharded Docs

- [Coding Standards](architecture/coding-standards.md)
- [Tech Stack](architecture/tech-stack.md)
- [Source Tree](architecture/source-tree.md)
