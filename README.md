# OpenClaw Claude Code Plugin

<div align="center">

English | [简体中文](README.zh_CN.md)

</div>

<div align="center">

Orchestrate Claude Code sessions as managed background processes from any OpenClaw channel.

Launch, monitor, and interact with multiple Claude Code sessions directly from Telegram, Discord, or any OpenClaw-supported platform — without leaving your chat interface.

[![Demo Video](https://img.youtube.com/vi/vbX1Y0Nx4Tc/maxresdefault.jpg)](https://youtube.com/shorts/vbX1Y0Nx4Tc)

*Two parallel Claude Code agents building an X clone and an Instagram clone simultaneously from Telegram.*

</div>

---

## 🚀 Quick Start

### 1. Install Plugin

```bash
openclaw plugins install @betrue/openclaw-claude-code-plugin
openclaw gateway restart
```

### 2. Configure Notifications

Edit `~/.openclaw/openclaw.json`:

```jsonc
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "fallbackChannel": "telegram|your-bot|your-chat-id",
          "maxSessions": 5
        }
      }
    }
  }
}
```

### 3. Launch Your First Session

In Telegram, send:
```
/claude Create a hello world program
```

---

## 📖 Full Documentation

| Document | Description |
|----------|-------------|
| **[User Guide 📘](docs/USER_GUIDE_EN.md)** | Quick start, command reference, common scenarios, troubleshooting |
| [API Documentation](docs/API.md) | Tools, commands, and RPC methods — full parameter tables |
| [Architecture](docs/ARCHITECTURE.md) | Architecture overview and component breakdown |
| [Development Guide](docs/DEVELOPMENT.md) | Development guide for contributors |

---

## ⚡ Quick Usage Examples

### Launch Session

```bash
/claude Fix login page bug

/claude --name fix-auth Fix authentication issue
```

### View Sessions

```bash
/claude_sessions                    # List all sessions
/claude_output fix-auth               # View session output
```

### Interact with Session

```bash
/claude_respond fix-auth Add unit tests

/claude_respond --interrupt fix-auth Stop! Try different approach
```

### Real-time Monitoring

```bash
/claude_fg fix-auth                   # Stream output in real-time
/claude_bg                            # Stop streaming
```

### Session Lifecycle

```bash
/claude_kill fix-auth                           # Terminate session
/claude_resume fix-auth Continue optimizing     # Resume session
/claude_resume --fork fix-auth Try alternative   # Fork session
```

---

## ✨ Features

- **Multi-session management** — Run multiple concurrent sessions, each with unique ID and human-readable name
- **Foreground / background model** — Sessions run in background by default; bring any to foreground to stream output in real time
- **Real-time notifications** — Get notified on completion, failure, or when Claude asks a question
- **Multi-turn conversations** — Send follow-up messages, interrupt, or iterate with a running agent
- **Session resume & fork** — Resume any completed session or fork it into a new conversation branch
- **4 pre-launch safety checks** — Autonomy skill, heartbeat config, HEARTBEAT.md, and channel mapping
- **Multi-agent support** — Route notifications to the correct agent/chat via workspace-based channel mapping
- **Automatic cleanup** — Completed sessions garbage-collected after 1 hour; IDs persist for resume

---

## 🔧 Configuration Options

Set values in `~/.openclaw/openclaw.json` under `plugins.entries["openclaw-claude-code-plugin"].config`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentChannels` | `object` | — | Map workdir paths → notification channels |
| `fallbackChannel` | `string` | — | Default notification channel when no workspace match found |
| `maxSessions` | `number` | `5` | Maximum concurrent sessions |
| `maxAutoResponds` | `number` | `10` | Max consecutive auto-responds before requiring user input |
| `defaultBudgetUsd` | `number` | `5` | Default budget per session (USD) |
| `permissionMode` | `string` | `"bypassPermissions"` | Permission mode |
| `skipSafetyChecks` | `boolean` | `false` | Skip ALL pre-launch safety guards (for dev/testing only) |

### Configuration Example

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "maxSessions": 3,
          "defaultBudgetUsd": 10,
          "defaultModel": "sonnet",
          "permissionMode": "bypassPermissions",
          "fallbackChannel": "telegram|main-bot|123456789",
          "agentChannels": {
            "/home/user/agent-seo": "telegram|seo-bot|123456789",
            "/home/user/agent-main": "telegram|main-bot|123456789"
          }
        }
      }
    }
  }
}
```

---

## 📋 All Commands

| Command | Description |
|---------|-------------|
| `/claude` | Start a new Claude Code session |
| `/claude_sessions` | List all sessions |
| `/claude_respond` | Send a follow-up message to a running session |
| `/claude_fg` | Bring a session to foreground (stream output in real time) |
| `/claude_bg` | Send a session to background (stop streaming) |
| `/claude_kill` | Terminate a running session |
| `/claude_output` | Read buffered output from a session |
| `/claude_resume` | Resume a previous session or fork to new conversation |
| `/claude_stats` | Show usage metrics (counts, durations, costs) |

All tools are also available as **chat commands** (`/claude`, `/claude_fg`, etc.) and most as **gateway RPC methods**.

> Full parameter tables and response schemas: [docs/API.md](docs/API.md)

---

## 🔔 Notifications

The plugin sends real-time notifications to your chat based on session lifecycle events:

| Emoji | Event | Description |
|-------|-------|-------------|
| ↩️ | Launched | Session started successfully |
| 🔔 | Claude asks | Session is waiting for user input — includes output preview |
| ↩️ | Responded | Follow-up message delivered to session |
| ✅ | Completed | Session finished successfully |
| ❌ | Failed | Session encountered an error |
| ⛔ | Killed | Session was manually terminated |

Foreground sessions stream full output in real time. Background sessions only send lifecycle notifications.

> Notification architecture and delivery model: [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)

---

## 💪 Best Practices

### 1. Name Sessions Meaningfully

```
✅ Good:
/claude --name fix-auth-bug Fix authentication
/claude --name add-user-profile Add user profile

❌ Avoid:
/claude --name task1 Fix authentication
/claude --name test Add feature
```

### 2. Describe Tasks Clearly

```
✅ Good:
/claude Add null check in src/auth.ts login function

❌ Vague:
/claude Fix bug
```

### 3. Set Appropriate Budget

```
Small task (1-2 min): Budget ~$0.01-0.05
Medium task (5-10 min): Budget ~$0.5-2
Large task (30+ min): Budget $5-10+
```

### 4. Use Foreground Mode for Important Tasks

```
/claude --name deploy-api Deploy API to production
/claude_fg deploy-api    # Monitor in real-time
/claude_bg              # Stop monitoring
```

### 5. Clean Up Completed Sessions

```
/claude_sessions         # View sessions
/claude_kill old-session # Terminate unwanted sessions
```

---

## 🐛 Troubleshooting

### Problem 1: Commands Not Responding

**Cause:** Gateway not running

**Solution:**
```bash
openclaw gateway restart
```

---

### Problem 2: "SessionManager not initialized" Error

**Cause:** Plugin service not started

**Solution:**
```bash
openclaw gateway status
openclaw gateway restart
```

---

### Problem 3: Session Stuck in "starting"

**Cause:** Claude Code CLI not installed

**Solution:**
```bash
which claude
npm install -g @anthropic-ai/claude-code
```

---

### Problem 4: Not Receiving Notifications

**Cause:** `fallbackChannel` misconfigured

**Solution:**
1. Get your Telegram Chat ID (send message to `@userinfobot`)
2. Update `fallbackChannel` in config
3. Restart Gateway

---

### Problem 5: Session Terminated Unexpectedly

**Cause:** Budget exhausted or idle timeout

**Solution:**
- Increase budget: `defaultBudgetUsd: 10`
- Increase timeout: `idleTimeoutMinutes: 60`

---

## 📚 Documentation Guide

### For Users

**Start here →** [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md) — Complete user guide with quick start, commands, and troubleshooting

| Priority | Document | Description |
|:--------:|----------|-------------|
| 1️⃣ | [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md) | User guide and first-launch walkthrough |
| 2️⃣ | [TOOLS_REFERENCE.md](docs/TOOLS_REFERENCE.md) | All tools, commands, and RPC methods reference |
| 3️⃣ | [PRELAUNCH_GUARDS.md](docs/PRELAUNCH_GUARDS.md) | Pre-launch safety checks and troubleshooting |

### For Multi-Agent Setup

**Start here →** [AGENT_CHANNELS.md](docs/AGENT_CHANNELS.md) — Configure workspace-to-channel mappings

| Priority | Document | Description |
|:--------:|----------|-------------|
| 4️⃣ | [AGENT_CHANNELS.md](docs/AGENT_CHANNELS.md) | Multi-agent setup, notification routing, workspace mapping |
| 5️⃣ | [MESSAGE_ROUTING.md](docs/MESSAGE_ROUTING.md) | Message routing: channel resolution, notification levels, wake mechanism |

### For Developers

**Start here →** [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Understand the plugin architecture

| Priority | Document | Description |
|:--------:|----------|-------------|
| 6️⃣ | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture overview and component breakdown |
| 7️⃣ | [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development guide, project structure, build instructions |
| 8️⃣ | [OpenClaw-Context-Reference.md](docs/OpenClaw-Context-Reference.md) | OpenClaw context types (PluginCommandContext, ToolContext) |

---

## 🆘 Getting Help

Having issues?

1. Check the Troubleshooting section above
2. Check Gateway logs: `openclaw logs`
3. Open an issue on GitHub: [github.com/alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin)

---

## 📄 License

MIT — see [package.json](package.json) for details.
