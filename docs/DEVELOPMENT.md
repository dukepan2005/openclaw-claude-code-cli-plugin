# Development

## Project Structure

```
claude-code/
├── index.ts                    # Plugin entry point (register function)
├── openclaw.plugin.json        # Plugin manifest and config schema
├── package.json                # Dependencies
├── src/
│   ├── types.ts                # TypeScript interfaces
│   ├── shared.ts               # Global state, helpers, formatting
│   ├── session.ts              # Session class (SDK wrapper)
│   ├── session-manager.ts      # Session pool management
│   ├── notifications.ts        # NotificationRouter
│   ├── gateway.ts              # RPC method registration
│   ├── tools/
│   │   ├── claude-launch.ts    # claude_launch tool
│   │   ├── claude-sessions.ts  # claude_sessions tool
│   │   ├── claude-output.ts    # claude_output tool
│   │   ├── claude-fg.ts        # claude_fg tool
│   │   ├── claude-bg.ts        # claude_bg tool
│   │   ├── claude-kill.ts      # claude_kill tool
│   │   ├── claude-respond.ts   # claude_respond tool
│   │   └── claude-stats.ts     # claude_stats tool
│   └── commands/
│       ├── claude.ts           # /claude command
│       ├── claude-sessions.ts  # /claude_sessions command
│       ├── claude-fg.ts        # /claude_fg command
│       ├── claude-bg.ts        # /claude_bg command
│       ├── claude-kill.ts      # /claude_kill command
│       ├── claude-resume.ts    # /claude_resume command
│       ├── claude-respond.ts   # /claude_respond command
│       └── claude-stats.ts     # /claude_stats command
├── skills/
│   └── claude-code-orchestration/
│       └── SKILL.md            # Orchestration skill definition
└── docs/
    ├── API.md                  # Full API reference
    ├── ARCHITECTURE.md         # Architecture overview
    ├── NOTIFICATIONS.md        # Notification system details
    └── DEVELOPMENT.md          # This file
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `@sinclair/typebox` | JSON Schema type builder for tool parameter definitions. |
| `nanoid` | Generates short unique session IDs (8 characters). |

---

## Key Design Decisions

1. **Foreground is per-channel, not per-session.** Multiple channels can watch the same session simultaneously, and one channel can have multiple sessions in foreground.

2. **Multi-turn uses stdin stream-json.** The Session class writes user messages to the Claude Code CLI's stdin in stream-json format, keeping the session alive across turns.

3. **Persisted sessions survive GC.** When a session is garbage-collected (1 hour after completion), its Claude session ID is retained in a separate `persistedSessions` map so it can be resumed later. Entries are stored under three keys (internal ID, name, Claude UUID) for flexible lookup.

4. **Notifications use CLI shelling.** Since the plugin API doesn't expose a runtime `sendMessage` method, outbound notifications go through `openclaw message send` via `child_process.execFile`.

5. **Metrics are in-memory only.** Session metrics are aggregated in the `SessionManager` and reset on service restart. They are not persisted to disk. Cost data is tracked internally but not exposed in any user-facing output.

6. **Waiting-for-input uses dual detection.** End-of-turn detection (when a multi-turn result resolves) is the primary signal, backed by a 15-second safety-net timer for edge cases. A `waitingForInputFired` flag prevents duplicate wake events.

7. **Channel `"unknown"` falls through.** If `channelId` is `"unknown"`, the notification system explicitly falls through to `fallbackChannel` rather than attempting delivery to an invalid destination.

---

## Core Concepts: Session and Channel

### Session

A `Session` is a wrapper around a Claude Code CLI process. Each session manages one subprocess spawned via `child_process.spawn()`.

```
Session (src/session-cli.ts)
  ├── childProcess        ← Claude Code CLI subprocess
  ├── foregroundChannels  ← Set<string> of channels watching in real-time
  ├── outputBuffer        ← Output history (max 200 lines)
  ├── status              ← "starting" | "running" | "completed" | "failed" | "killed"
  └── callbacks           ← onOutput, onToolUse, onComplete, onWaitingForInput
```

**Key behaviors:**
- `foregroundChannels.add(channelId)` — Enables real-time output streaming to that channel
- `foregroundChannels.delete(channelId)` — Stops streaming; session runs in background for that channel
- One session can be watched by multiple channels simultaneously

### Channel

A `channel` is a string identifier for a message destination (Telegram chat, Discord channel, etc.). It represents "where the user sent the command from."

**Internal format (uses `|` as separator):**
- `telegram|123456789` — 2 segments: channel type + chat ID
- `telegram|my-agent|123456789` — 3 segments: with account
- `telegram|my-agent|-1001234567890|42` — 4 segments: with topic/thread

**OpenClaw input format (uses `:` as separator):**
- `ctx.to` format: `telegram:-1003889434099` (converted to internal format by `resolveOriginChannel()`)

**Resolution flow:**
```
User sends command from Telegram group
  → ctx.to = "telegram:-1003889434099"
  → resolveOriginChannel(ctx) converts to "telegram|-1003889434099"
  → channelId stored in session.foregroundChannels
```

### Foreground vs Background

- **Foreground** (channel in `foregroundChannels`): Real-time output streaming (debounced 500ms)
- **Background** (channel not in `foregroundChannels`): Minimal notifications only (questions, completion)

Commands like `/claude_watch` and `/claude_unwatch` manage which channels are in the foreground set.

**Output flow:**
```
CLI outputs text
  → Session.onOutput callback
  → NotificationRouter.onAssistantText()
  → Iterate through session.foregroundChannels
  → Push to each channel
```

---

## Adding a New Tool or Command

1. Create a new file under `src/tools/` or `src/commands/`.
2. Export a `registerXxxTool(api)` or `registerXxxCommand(api)` function.
3. Import and call it in `index.ts` inside the `register()` function.

---

## Service Lifecycle

- **`start()`** — Creates `SessionManager` and `NotificationRouter`, wires them together, starts the long-running reminder check interval (60s), and starts a GC interval (5 min).
- **`stop()`** — Stops the notification router, kills all active sessions, clears intervals, and nulls singletons.

---

## OpenClaw Context Fields

When OpenClaw calls a command handler, it provides a rich context object. Here are the available fields:

```typescript
interface OpenClawCommandContext {
  // Sender information
  senderId: string;           // "5948095689" - User ID who sent the command

  // Channel information
  channel: string;            // "telegram" | "discord" | "whatsapp" | ...
  channelId: string;          // Internal channel identifier

  // Routing information (key for replies)
  from: string;               // "telegram:group:-1003889434099:topic:2"
  to: string;                 // "telegram:-1003889434099" (target chat)
  accountId: string;          // "default" - Channel account ID
  messageThreadId: number;    // 2 - Topic/Thread ID (for forum topics)

  // Command content
  args: string;               // Command arguments (without command name)
  commandBody: string;        // Full command text: "/claude your prompt"

  // Authorization
  isAuthorizedSender: boolean;

  // Configuration
  config: Record<string, any>;
}
```

### Example Context

```json
{
  "senderId": "5948095689",
  "channel": "telegram",
  "channelId": "...",
  "isAuthorizedSender": true,
  "args": "your prompt here",
  "commandBody": "/claude your prompt here",
  "config": {},
  "from": "telegram:group:-1003889434099:topic:2",
  "to": "telegram:-1003889434099",
  "accountId": "default",
  "messageThreadId": 2
}
```

### Using Context for Replies

The `resolveOriginChannel()` function in `src/shared.ts` extracts reply information from the context:

```typescript
// Channel format: "channel|account|chatId|threadId"
// Example: "telegram|default|-1003889434099|2"

const originChannel = resolveOriginChannel(ctx);
// Returns: "telegram|default|-1003889434099|2"
```

This channel string is then used with `openclaw message send`:

```bash
openclaw message send \
  --channel telegram \
  --account default \
  --target -1003889434099 \
  --thread-id 2 \
  -m "Reply message"
```
