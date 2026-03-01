# Claude Code Plugin User Guide

Control Claude Code development tasks remotely through chat channels like Telegram/Discord.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Plugin

```bash
openclaw plugins install @betrue/openclaw-claude-code-plugin
openclaw gateway restart
```

### Step 2: Configure Notifications

Edit `~/.openclaw/openclaw.json`:

```json
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

Restart Gateway:
```bash
openclaw gateway restart
```

### Step 3: Launch Your First Session

In Telegram, send:
```
/claude Create a hello world program
```

Wait for completion, and you'll receive a notification.

---

## 💡 Core Concepts

### Session

A session is a Claude Code instance running in the background to execute tasks.

| Feature | Description |
|---------|-------------|
| **Background** | Runs in background, doesn't block your chat |
| **Multi-turn** | Continue sending messages to the same session |
| **State Tracking** | Monitor progress in real-time |
| **Resume** | Continue from where you left off |

### Session States

| State | Meaning | Available Actions |
|-------|---------|-------------------|
| `starting` | Initializing | Wait |
| `running` | Executing | Send messages, view output |
| `completed` | Finished successfully | Resume session, view results |
| `failed` | Failed with error | View error |
| `killed` | Terminated | None |

---

## 📋 Command Reference

### 1. `/claude` - Start New Session

**Basic:**
```
/claude <task description>
```

**Examples:**
```
/claude Fix login page bug

/claude Add user registration feature

/claude Refactor database layer using Repository pattern
```

**With custom name:**
```
/claude --name <name> <task>
```

**Example:**
```
/claude --name fix-auth Fix authentication issue
```

---

### 2. `/claude_sessions` - List All Sessions

**Usage:**
```
/claude_sessions
```

**Output:**
```
📋 All Sessions:

fix-auth [abc123]
  Status: RUNNING | Duration: 5m 23s
  💬 "Fix authentication issue..."
  📁 /home/user/project

add-upload [xyz789]
  Status: COMPLETED | Duration: 12m 45s
  💬 "Add file upload feature"
  📁 /home/user/project
```

---

### 3. `/claude_respond` - Send Message to Session

**Usage:**
```
/claude_respond <session name or ID> <message>
```

**Examples:**
```
/claude_respond fix-auth Use JWT token instead

/claude_respond abc123 Add unit tests

/claude_respond fix-auth Stop! Try a different approach
```

**Interrupt current task:**
```
/claude_respond --interrupt fix-auth Stop! Use another approach
```

---

### 4. `/claude_output` - View Session Output

**Usage:**
```
/claude_output <session name or ID>
```

**Last 50 lines (default):**
```
/claude_output fix-auth
```

**More lines:**
```
/claude_output fix-auth --lines 100
```

**All output:**
```
/claude_output fix-auth --full
```

---

### 5. `/claude_fg` - Real-time View (Foreground Mode)

**Usage:**
```
/claude_fg <session name or ID>
```

**Effect:**
- Session output streams in real-time to chat
- See what Claude is doing live
- Like "live streaming" mode

**Stop streaming:**
```
/claude_bg
```

---

### 6. `/claude_bg` - Stop Real-time View

**Usage:**
```
/claude_bg                    # Stop all foreground sessions
/claude_bg <session name>     # Stop specific session
```

---

### 7. `/claude_kill` - Terminate Session

**Usage:**
```
/claude_kill <session name or ID>
```

**Examples:**
```
/claude_kill fix-auth

/claude_kill abc123
```

---

### 8. `/claude_resume` - Resume Completed Session

**List resumable sessions:**
```
/claude_resume --list
```

**Resume and continue:**
```
/claude_resume <session name> <new task>
```

**Examples:**
```
/claude_resume fix-auth Add error handling

/claude_resume fix-auth Continue optimizing
```

**Fork session:**
```
/claude_resume --fork fix-auth Try completely different approach
```

---

### 9. `/claude_stats` - View Statistics

**Usage:**
```
/claude_stats
```

**Output:**
```
📊 Claude Code Usage Stats:

Total sessions: 15
Total cost: $1.23
Avg duration: 8m 30s

By status:
  ✅ Completed: 12
  ❌ Failed: 2
  ⚠️  Killed: 1
```

---

## 🎯 Common Use Cases

### Scenario 1: Fix Bug

```
# 1. Start session
/claude Fix null pointer exception in login page

# 2. Check progress later
/claude_sessions

# 3. See Claude's question or suggestion
/claude_output fix-login

# 4. Answer Claude's question
/claude_respond fix-login Yes, use try-catch

# 5. See final result
/claude_output fix-login --full
```

---

### Scenario 2: Add Feature

```
# 1. Start feature development
/claude --name add-upload Implement file upload feature

# 2. Monitor progress in real-time
/claude_fg add-upload
# (See Claude working in real-time)
# (Done)
/claude_bg

# 3. Add more requirements
/claude_respond add-upload Add file size limit

# 4. Wait for completion
```

---

### Scenario 3: Refactor Code

```
# 1. Start refactoring task
/claude --name refactor-db Refactor database layer using Repository pattern

# 2. Check later
/claude_sessions

# 3. Change direction
/claude_respond --interrupt refactor-db Stop! Just refactor user module first

# 4. Continue with other modules
/claude_resume refactor-db Now refactor order module
```

---

### Scenario 4: Multiple Parallel Tasks

```
# Start multiple sessions
/claude --name fix-auth Fix authentication
/claude --name add-search Add search functionality
/claude --name refactor-ui Optimize UI

# Check all sessions
/claude_sessions

# Interact with each separately
/claude_respond fix-auth Use OAuth
/claude_respond add-search Support fuzzy search
/claude_respond refactor-ui Use Tailwind CSS
```

---

## ⚙️ Configuration Options

Edit plugin config in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "maxSessions": 5,
          "defaultBudgetUsd": 5,
          "defaultModel": "sonnet",
          "permissionMode": "bypassPermissions",
          "fallbackChannel": "telegram|bot|chat-id",
          "idleTimeoutMinutes": 30
        }
      }
    }
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxSessions` | 5 | Maximum concurrent sessions |
| `defaultBudgetUsd` | 5 | Default budget per session (USD) |
| `defaultModel` | - | Default model (sonnet/opus) |
| `permissionMode` | bypassPermissions | Permission mode |
| `fallbackChannel` | - | Default notification channel |
| `idleTimeoutMinutes` | 30 | Idle timeout (auto-kill after N minutes) |

---

## 🔔 Notifications

You'll receive notifications when session state changes:

| Icon | Event | Description |
|------|-------|-------------|
| ↩️ | Launched | Session started successfully |
| 🔔 | Claude asks | Session waiting for your input |
| ↩️ | Responded | Message delivered to session |
| ✅ | Completed | Session finished successfully |
| ❌ | Failed | Session encountered error |
| ⛔ | Killed | Session was terminated |

Foreground sessions stream full output in real-time. Background sessions only send lifecycle notifications.

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
/claude Add null check in src/auth.ts login function to handle null user

❌ Vague:
/claude Fix bug
```

### 3. Set Appropriate Budget

```
Small task (1-2 min):
/claude Add simple logging  # Budget ~$0.01-0.05

Medium task (5-10 min):
/claude Implement user registration  # Budget ~$0.5-2

Large task (30+ min):
/claude Refactor entire data layer  # Budget $5-10+
```

### 4. Use Foreground Mode for Important Tasks

```
# Start task
/claude --name deploy-api Deploy API to production

# Monitor in real-time
/claude_fg deploy-api
# (Watch output, ensure everything OK)
/claude_bg
```

### 5. Clean Up Completed Sessions

```
# Check sessions
/claude_sessions

# Terminate unwanted sessions
/claude_kill old-session
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
# Check service status
openclaw gateway status

# Restart Gateway
openclaw gateway restart
```

---

### Problem 3: Session Stuck in "starting"

**Cause:** Claude Code CLI not installed or wrong path

**Solution:**
```bash
# Check CLI availability
which claude

# Install Claude Code if missing
npm install -g @anthropic-ai/claude-code
```

---

### Problem 4: Not Receiving Notifications

**Cause:** `fallbackChannel` misconfigured

**Solution:**
1. Get your Telegram Chat ID:
   - Send message to `@userinfobot` in Telegram
   - It returns your User ID

2. Update config:
   ```json
   {
     "fallbackChannel": "telegram|bot-name|your-chat-id"
   }
   ```

3. Restart Gateway:
   ```bash
   openclaw gateway restart
   ```

---

### Problem 5: Session Terminated Unexpectedly

**Cause:** Budget exhausted or idle timeout

**Solution:**
- Increase budget: Set `defaultBudgetUsd: 10` in config
- Increase timeout: Set `idleTimeoutMinutes: 60`

---

## 📚 More Resources

- [API Documentation](./API.md) - Detailed tool and command parameters
- [Architecture](./ARCHITECTURE.md) - In-depth plugin architecture
- [Development Guide](./DEVELOPMENT.md) - Developer documentation
- [Safety Guide](./safety.md) - Safety checks and best practices

---

## 🆘 Getting Help

Having issues?

1. Check the Troubleshooting section above
2. Check Gateway logs: `openclaw logs`
3. Open an issue on GitHub: [github.com/alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin)

---

**Happy Coding! 🚀**
