# Message Routing — OpenClaw Claude Code Plugin

This document explains how Claude Code session output is routed to messaging channels (Telegram, Discord, etc.).

## Overview

The plugin uses a **hybrid routing model** — messages are sent to channels associated with the session's origin, not broadcast globally.

```
┌─────────────────────────────────────────────────────────────────┐
│                  Channel Source (Priority Order)                │
├─────────────────────────────────────────────────────────────────┤
│ 1. ctx.messageChannel + ctx.agentAccountId (tool context)       │
│ 2. agentChannels[workdir] config (workspace → channel mapping)  │
│ 3. fallbackChannel config (default target)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              session.originChannel (session remembers source)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  NotificationRouter.sendMessage()               │
│                              ↓                                  │
│                     Message Queue (rate limit)                  │
│                              ↓                                  │
│              openclaw message send CLI                          │
└─────────────────────────────────────────────────────────────────┘
```

## Channel Format

Channels are represented as pipe-separated strings:

| Format | Example | Description |
|--------|---------|-------------|
| 2-segment | `telegram\|123456789` | Channel + target |
| 3-segment | `telegram\|my-agent\|123456789` | Channel + account + target |
| 4-segment | `telegram\|my-agent\|-1001234567890\|42` | With thread/topic ID |

## Channel Resolution

### Priority Chain

When a session is launched via `claude_launch`, the origin channel is resolved in this order:

```typescript
// 1. Tool context with account injection
if (ctx.messageChannel && ctx.agentAccountId) {
  const parts = ctx.messageChannel.split("|");
  if (parts.length >= 2) {
    channel = `${parts[0]}|${ctx.agentAccountId}|${parts.slice(1).join("|")}`;
  }
}

// 2. Workspace-based lookup from agentChannels config
if (!channel && ctx.workspaceDir) {
  channel = resolveAgentChannel(ctx.workspaceDir);
}

// 3. Direct context channel (already has |)
if (!channel && ctx.messageChannel?.includes("|")) {
  channel = ctx.messageChannel;
}

// 4. Fallback from config
if (!channel) {
  channel = pluginConfig.fallbackChannel; // may be "unknown"
}
```

### Fallback Behavior

When `originChannel` is `"unknown"`:
- The plugin uses `fallbackChannel` from config
- If no `fallbackChannel` is configured, the message is **not sent** (logged warning)

## Notification Levels

### Level 1 — Session Lifecycle (Always Sent)

Sent by SessionManager via `openclaw message send` (fire-and-forget).

| Emoji | Event | When | Agent Wake |
|-------|-------|------|------------|
| 🚀 | Launched | Session started | No |
| 🔔 | Claude asks | Waiting for input | Yes — `claude_respond` |
| 💬 | Responded | Agent replied | No |
| ✅ | Completed | Session finished | Yes — `claude_output` + summarize |
| ❌ | Failed | Session error | No |
| ⛔ | Killed | Session terminated | No |

### Level 2 — Foreground Streaming (Optional)

Sent by NotificationRouter when `claude_fg` is active. Real-time tool calls, reasoning, read/write.

### Level 3 — Agent Behavior (Not Plugin Responsibility)

The plugin is agent-agnostic. How agents react to 🔔 and ✅ is configured in their `HEARTBEAT.md` / `AGENTS.md`.

## Session Modes

### Foreground Mode

Real-time streaming to subscribed channels.

| Event | Behavior |
|-------|----------|
| Assistant text | Debounced stream (500ms) to all `foregroundChannels` |
| Tool call | Compact indicator (immediate, flushes pending text) |
| Waiting for input | Notification to all `foregroundChannels` |
| Completion | Notification to all `foregroundChannels` |

Multiple channels can watch the same session simultaneously.

### Background Mode

Minimal notifications only.

| Event | Behavior |
|-------|----------|
| Assistant text | Buffered (not sent) |
| Tool call | Not sent |
| Waiting for input | 🔔 notification to `originChannel` + wake agent |
| Completion | Silent (agent handles via wake event) |
| Long-running (>10min) | One-time reminder to `originChannel` |

## Wake Mechanism

When a session needs agent attention (waiting for input or completed), the plugin uses a two-tier wake system:

### Tier 1 — Primary: Detached Spawn

```bash
spawn("openclaw", ["agent", "--agent", id, "--message", text, "--deliver", ...], { detached: true })
```

- Non-blocking, agent response routed to Telegram via `--deliver`
- Used for 🔔 waiting and ✅ completed events
- **No heartbeat dependency** — works independently

### Tier 2 — Fallback: System Event

```bash
openclaw system event --mode now
```

- Triggers immediate heartbeat with `reason="wake"`
- Only used when `originAgentId` is missing
- **Requires heartbeat to be configured** on the agent
- **Known bug [#14527](https://github.com/openclaw/openclaw/issues/14527)**: Skipped silently if `HEARTBEAT.md` is empty or contains only comments

## Implementation Details

### sendMessage Callback

Located in `index.ts`, the `sendMessage` function:

1. Parses channel string into components (channel, account, target, threadId)
2. Handles fallback when channel is `"unknown"` or invalid
3. Queues messages to avoid rate limiting
4. Calls `openclaw message send` CLI

```typescript
// CLI invocation
execFile("openclaw", [
  "message", "send",
  "--channel", channel,
  "--account", account,      // optional
  "--thread-id", threadId,   // optional
  "--target", target,
  "-m", text
]);
```

### Key Files

| File | Purpose |
|------|---------|
| [src/shared.ts](../src/shared.ts) | `resolveOriginChannel()`, `resolveAgentChannel()` |
| [src/session-manager.ts](../src/session-manager.ts) | `deliverToTelegram()`, `wakeAgent()` |
| [src/notifications.ts](../src/notifications.ts) | `NotificationRouter` class |
| [index.ts](../index.ts) | `sendMessage` callback, message queue |

## Configuration

### agentChannels

Maps workspace directories to notification channels:

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "config": {
          "agentChannels": {
            "/home/user/projects/my-app": "telegram|my-agent|123456789",
            "/home/user/projects/another": "telegram|my-agent|987654321"
          }
        }
      }
    }
  }
}
```

### fallbackChannel

Default target when origin cannot be resolved:

```json
{
  "fallbackChannel": "telegram|my-agent|123456789"
}
```

## Summary

- **Not a broadcast system** — messages target session-associated channels
- **Session remembers origin** — `originChannel` is set at launch
- **Foreground = subscribe model** — multiple channels can watch
- **Background = origin only** — minimal notifications to source
- **Two-tier wake** — primary (detached spawn) + fallback (system event)
- **Fallback for safety** — `fallbackChannel` catches unresolved cases

## See Also

- **[AGENT_CHANNELS.md](AGENT_CHANNELS.md)** — Detailed `agentChannels` configuration and multi-agent setup guide
