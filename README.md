# OpenClaw Claude Code CLI Plugin

> **⚠️ Important Attribution**: This project is a fork of [alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin). **99.99999% of the code changes in this fork were developed by Claude Code** (Anthropic's AI coding assistant). This fork primarily changes the architecture from SDK-based to CLI-based implementation, with almost all implementation work done by Claude Code.

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

## 🔄 About This Project

### Fork Source

This project is a fork of [alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin), created by **alizarion**.

### Key Difference: CLI-based Architecture

**Original Project (@alizarion/openclaw-claude-code-plugin)**

- Uses `@anthropic-ai/claude-agent-sdk` (npm package)
- Embeds the SDK directly in the plugin
- Limited to Anthropic's official Claude API

**This Fork (@dukepan2005/openclaw-claude-code-cli-plugin)**

- **Spawns Claude Code CLI as a child process** using `child_process.spawn`
- Communicates with CLI via stream-json format over stdin/stdout
- **Works with any Claude-compatible model service** (Anthropic API, OpenRouter, custom endpoints, etc.)

### Why This Approach?

✅ **Model Flexibility**: Use any Claude-compatible service without modifying plugin code

✅ **Configuration**: Use existing `claude` CLI config (`~/.claude/config.json`) for API endpoints

✅ **Updates**: Benefit from Claude Code CLI updates automatically

✅ **No SDK Dependency**: Eliminates compatibility issues with SDK versions

### 🙏 Acknowledgments

**Huge thanks to [@alizarion](https://github.com/alizarion)** for creating the original [openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin) project. This fork is built upon the excellent foundation and architecture of the original project.

### Installation

Since this is a forked package, install from source:

```bash
# Clone the repository
git clone https://github.com/dukepan2005/openclaw-claude-code-cli-plugin.git
cd openclaw-claude-code-cli-plugin

# Install dependencies and build
npm install
npm run build

# Install the plugin locally (development mode)
openclaw plugins link .
openclaw gateway restart
```

---

## 🚀 Quick Start

### 1. Install Plugin

```bash
# From local source (recommended for this fork)
git clone https://github.com/dukepan2005/openclaw-claude-code-cli-plugin.git
cd openclaw-claude-code-cli-plugin
npm install
npm run build
openclaw plugins link .
openclaw gateway restart

# Or install from npm (when published)
openclaw plugins install @dukepan2005/openclaw-claude-code-cli-plugin
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
/claude -name hello-world Create a hello world program
```

> **⚠️ Important**: The `-name` parameter is **required** to launch a new session.
> - Without `-name`: Sends message to the most recent active session
> - With `-name`: Creates a new session with the specified name

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
/claude -name fix-auth Fix authentication issue
```

### View Sessions

```bash
/claude_sessions                    # List all sessions
/claude_output fix-auth               # View session output
```

### Interact with Session

```bash
# Quick way to send a message (to the most recent session in this channel)
/claude Add unit tests

# Specify which session to message
/claude_respond fix-auth Add unit tests

# Interrupt and redirect
/claude_respond --interrupt fix-auth Stop! Try different approach

# Quick interrupt (sends ESC to stop current response)
/claude_esc                    # Interrupt most recent session
/c_esc fix-auth                # Interrupt specific session
```

> **Note**:
> - `/claude <message>` without `-name` sends to the most recent active session in the current channel
> - `/claude_esc` or `/c_esc` sends ESC to interrupt Claude mid-response
> - Use `/claude_respond <name> <message>` to target a specific session

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
| `/claude -name <name> <prompt>` | Start a new Claude Code session |
| `/claude <message>` | Send message to most recent active session in current channel |
| `/claude_sessions` | List all sessions with status and duration |
| `/claude_respond <name> <message>` | Send follow-up message to a specific session |
| `/claude_respond --interrupt <name> <msg>` | Interrupt session then send message |
| `/claude_fg <name>` | Bring session to foreground (stream output in real-time) |
| `/claude_bg` | Send current foreground session to background |
| `/claude_watch <name>` | Subscribe to session's real-time output (no catchup) |
| `/claude_unwatch <name>` | Unsubscribe from session's real-time output |
| `/claude_kill <name>` | Terminate a running session |
| `/claude_output <name>` | Read buffered output from a session |
| `/claude_resume <name>` | Resume a previous session or fork to new conversation |
| `/claude_stats` | Show usage metrics (counts, durations, costs) |
| `/claude_esc` | Send ESC to interrupt current Claude response |
| `/c_esc <name>` | Send ESC to interrupt specific session (short alias) |

All commands are **chat commands** that work in Telegram, Discord, and other OpenClaw-supported channels.

> Full parameter tables and response schemas: [docs/API.md](docs/API.md)

---

## 🔔 Notifications

The plugin sends real-time notifications to your chat based on session lifecycle events:

| Emoji | Event | Description |
|-------|-------|-------------|
| 🚀 | Launched | Session started successfully |
| 🔔 | Claude asks | Session is waiting for user input — includes output preview |
| 💬 | Responded | Follow-up message delivered to session |
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

> **💡 Coding Plan Services**: If your AI service provider offers a **Coding Plan** (non-token-based billing or fixed-price subscription), you can set a much higher budget value (e.g., `100` or `1000`) to prevent sessions from being killed due to budget exhaustion. This is particularly useful for development-focused plans that don't charge per token.

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
