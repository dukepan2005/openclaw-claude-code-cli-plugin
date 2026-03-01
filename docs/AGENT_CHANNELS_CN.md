# Agent Channels — 多代理通知路由

## 什么是 `agentChannels`？

`agentChannels` 是一个配置映射，将**工作目录**绑定到**通知频道**。当 Claude Code 会话完成、遇到错误或需要用户输入时，插件必须知道向**哪里**发送通知。在单代理设置中，硬编码的回退频道就足够了，但当你运行**多个代理**时——每个代理都有自己的 Telegram bot、聊天和项目目录——你需要一种方法将通知路由到正确的位置。

`agentChannels` 解决了这个问题：它将每个代理的工作目录映射到一个 `channel|accountId|chatId` 字符串，这样插件可以自动将每个通知路由到正确的 bot 和聊天，**而无需代理传递频道参数**。

### 为什么需要它？

如果没有 `agentChannels`，插件无法知道哪个 Telegram bot 或聊天应该接收给定会话的通知。如果找不到会话 `workdir` 的映射，`claude_launch` 工具将**完全阻止启动**。这是有意为之的——启动一个通知消失在虚空中会话比拒绝启动更糟糕。

---

## 配置

`agentChannels` 位于 `~/.openclaw/openclaw.json` 中的 `plugins.entries["openclaw-claude-code-plugin"].config` 下：

```jsonc
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "agentChannels": {
            "/home/user/agent-seo":  "telegram|seo-bot|123456789",
            "/home/user/agent-main": "telegram|main-bot|9876543210",
            "/home/user/shared":     "telegram|ops-bot|5555555555"
          },
          "fallbackChannel": "telegram|default-bot|123456789"
        }
      }
    }
  }
}
```

### 键 — 工作目录路径

每个键是表示代理工作区（或任何项目目录）的**绝对目录路径**。在比较之前会去除尾部斜杠，因此 `/home/user/agent-seo` 和 `/home/user/agent-seo/` 是等效的。

### 值 — 频道字符串

值是一个由管道符分隔的字符串，包含 2 或 3 个段：

| 格式 | 示例 | 含义 |
|---|---|---|
| `channel\|accountId\|target` | `telegram\|seo-bot\|123456789` | 通过 `seo-bot` Telegram bot 账户路由到聊天 `123456789` |
| `channel\|target` | `telegram\|123456789` | 通过默认 bot 路由到聊天 `123456789`（无特定账户） |

当每个代理使用不同的 bot 账户时，3 段格式是多代理设置所必需的。

### TypeScript 类型

```ts
agentChannels?: Record<string, string>;
// 键：   绝对工作目录路径
// 值： "channel|accountId|chatId" 或 "channel|chatId"
```

---

## `resolveAgentChannel` — 最长前缀匹配

`src/shared.ts` 中的函数 `resolveAgentChannel(workdir)` 解析给定工作目录映射到哪个频道字符串。

### 算法

1. **规范化** 输入 `workdir`，去除尾部斜杠。
2. **排序** 所有 `agentChannels` 条目，按键（路径）长度**降序**排列——最长路径在前。
3. **迭代** 排序后的条目，返回第一个匹配项：
   - `workdir === entry.path`（精确匹配），**或**
   - `workdir.startsWith(entry.path + "/")`（前缀匹配 —— workdir 是子目录）。
4. 如果没有条目匹配，返回 `undefined`。

### 为什么使用最长前缀？

给定此配置：

```json
{
  "/home/user/projects":         "telegram|general-bot|111",
  "/home/user/projects/seo-app": "telegram|seo-bot|222"
}
```

在 `/home/user/projects/seo-app/backend` 中启动的会话匹配**两个**条目。最长前缀规则确保它解析为 `telegram|seo-bot|222`（更具体的匹配），而不是通用的 `/home/user/projects` 捕获所有。

### 解析示例

| `workdir` | 解析的频道 |
|---|---|
| `/home/user/projects/seo-app` | `telegram\|seo-bot\|222`（精确匹配） |
| `/home/user/projects/seo-app/backend` | `telegram\|seo-bot\|222`（前缀匹配） |
| `/home/user/projects/other-app` | `telegram\|general-bot\|111`（前缀匹配） |
| `/tmp/scratch` | `undefined`（无匹配） |

---

## `fallbackChannel`

`fallbackChannel` 是 `plugins.entries["openclaw-claude-code-plugin"].config` 下的一个单独字段，由 `resolveOriginChannel()` 使用 —— **而不是**由 `resolveAgentChannel()` 使用。

当插件无法从命令/工具上下文确定来源频道（没有 `ctx.channel`、`ctx.chatId` 等）且未提供显式频道时，它会回退到 `pluginConfig.fallbackChannel`。如果也未设置，则返回 `"unknown"`。

### 格式

值遵循与 `agentChannels` 相同的管道分隔格式：

```text
platform|accountId|targetId
```

| 段 | 示例 | 描述 |
|---------|---------|-------------|
| **平台** | `telegram`, `discord` | 消息平台类型 |
| **账户 ID** | `seo-bot`, `main-bot` | OpenClaw 代理标识符（必须与 `openclaw.json → agents.list[].id` 匹配） |
| **目标 ID (chatId)** | `123456789`, `-1009876543210` | 接收通知的聊天 ID |

> **重要提示：** **账户 ID** 是你的 OpenClaw 代理标识符（例如 `seo-bot`），**不是** Telegram bot 用户名（不要包含 `@` 符号）。它必须与 `openclaw.json → agents.list` 配置中的 `id` 字段匹配。

**目标 ID (chatId)** 是接收通知的 Telegram 聊天标识符。它可以是：
- **个人聊天 ID**：正数（例如 `123456789`）
- **群组/频道 ID**：以 `-100` 开头的负数（例如 `-1009876543210`）

### 配置示例

```jsonc
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "fallbackChannel": "telegram|my-default-bot|123456789"
        }
      }
    }
  }
}
```

### 如何获取 Telegram chatId

**对于个人聊天：**
1. 向你的 Telegram Bot 发送任意消息
2. 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在返回的 JSON 中找到 `chat.id`

**对于群组/频道：**
1. 将你的 Bot 添加到群组或频道
2. 在群组中发送消息（例如 `/start`）
3. 使用相同的 getUpdates API 检索 `chat.id`

群组/频道的 chatId 将是一个类似 `-1009876543210` 的负数。

### 使用场景

- **测试/开发**：在开发期间设置固定的测试频道用于通知
- **非代理上下文**：当从没有 OpenClaw 上下文的脚本调用工具时
- **安全网**：确保上下文解析失败时通知有目的地

> **重要提示：** `fallbackChannel` **不会**挽救缺失的 `agentChannels` 映射。`claude_launch` 启动前守卫会独立检查 `resolveAgentChannel(workdir)` —— 如果返回 `undefined`，无论 `fallbackChannel` 如何，启动都会被阻止。

---

## 相关辅助函数

### `extractAgentId(channelStr)`

从 3 段频道字符串中提取**中间段**（账户/代理 ID）。

```text
"telegram|seo-bot|123456789"  →  "seo-bot"
"telegram|123456789"          →  undefined  （只有 2 段）
```

### `resolveAgentId(workdir)`

结合 `resolveAgentChannel` 和 `extractAgentId` 来获取给定工作区的代理账户 ID：

```text
resolveAgentId("/home/user/agent-seo")  →  "seo-bot"
```

这由心跳守卫使用，用于在 `openclaw.json → agents.list` 中查找代理的条目。

---

## `claude_launch` 中的启动前守卫

`claude_launch` 工具在生成会话之前运行**四个顺序守卫**。如果任何守卫失败，启动将被阻止并显示错误和代理修复问题的说明。

### 守卫 1 — 自主技能

检查 `<agentWorkspace>/skills/claude-code-autonomy/SKILL.md` 是否存在。此文件定义代理如何处理 Claude Code 交互（自动响应、询问用户等）。

**被阻止？** 代理必须询问用户的自主偏好并创建技能目录。

### 守卫 2 — 心跳配置

使用 `resolveAgentId(workdir)` 查找代理 ID，然后检查 `~/.openclaw/openclaw.json → agents.list` 中是否有匹配的条目且具有 `heartbeat` 属性。心跳启用自动"等待输入"通知。

**被阻止？** 代理必须在 `openclaw.json` 中的代理条目中添加 `"heartbeat": {"every": "5s", "target": "last"}` 并重启 Gateway。

### 守卫 3 — HEARTBEAT.md

检查 `<agentWorkspace>/HEARTBEAT.md` 是否存在并包含真实内容（不仅仅是注释、空行或空格）。此文件告诉代理在心跳周期期间做什么。

**被阻止？** 代理必须创建 `HEARTBEAT.md`，其中包含检查等待 Claude Code 会话的说明。

### 守卫 4 — 代理频道映射

调用 `resolveAgentChannel(workdir)`。如果返回 `undefined`，会话的工作区没有频道映射，通知将无法传递。

**被阻止？** 代理必须在 `openclaw.json` 中将工作区添加到 `agentChannels`：

```bash
jq '.plugins.entries["openclaw-claude-code-plugin"].config.agentChannels["/path/to/workspace"] = "telegram|my-agent|123456789"' \
  ~/.openclaw/openclaw.json > /tmp/openclaw-updated.json && \
  mv /tmp/openclaw-updated.json ~/.openclaw/openclaw.json
```

然后重启 Gateway（`openclaw gateway restart`）。

---

## `claude_launch` 中的频道解析优先级

当 `claude_launch` 确定新会话的 `originChannel` 时，它使用此优先级链：

```text
1. ctx.messageChannel + ctx.agentAccountId  （由工厂注入，3 段构建）
2. resolveAgentChannel(ctx.workspaceDir)    （来自工厂上下文的基于工作区的查找）
3. ctx.messageChannel as-is                 （如果已经是管道分隔的）
4. resolveAgentChannel(workdir)             （来自参数的 workdir，可能与工厂不同）
5. pluginConfig.fallbackChannel             （最后手段，通过 resolveOriginChannel）
6. "unknown"                                （绝对回退）
```

实际上，对于大多数多代理设置，步骤 2 或 4 是解析的 —— `agentChannels` 配置完成了繁重的工作。

---

## 多代理设置 — 分步指南

本指南将指导你设置两个代理（`seo-bot` 和 `dev-bot`），它们各自启动 Claude Code 会话并在单独的 Telegram 聊天中接收通知。

### 前提条件

- OpenClaw Gateway 正在运行
- `openclaw-claude-code-plugin` 已安装
- 在 OpenClaw 中配置了两个 Telegram bot 账户（`seo-bot`、`dev-bot`）
- 两个 Telegram 聊天 ID（每个代理一个）

### 步骤 1 — 创建代理工作区

```bash
mkdir -p /home/user/agent-seo
mkdir -p /home/user/agent-dev
```

### 步骤 2 — 在 `openclaw.json` 中配置 `agentChannels`

编辑 `~/.openclaw/openclaw.json`：

```jsonc
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "maxSessions": 5,
          "defaultBudgetUsd": 5,
          "agentChannels": {
            "/home/user/agent-seo": "telegram|seo-bot|1111111111",
            "/home/user/agent-dev": "telegram|dev-bot|2222222222"
          },
          "fallbackChannel": "telegram|seo-bot|1111111111"
        }
      }
    }
  }
}
```

### 步骤 3 — 为每个代理配置心跳

在同一个 `openclaw.json` 中，确保每个代理都有心跳条目：

```jsonc
{
  "agents": {
    "list": [
      {
        "id": "seo-bot",
        "heartbeat": { "every": "5s", "target": "last" }
      },
      {
        "id": "dev-bot",
        "heartbeat": { "every": "5s", "target": "last" }
      }
    ]
  }
}
```

### 步骤 4 — 创建自主技能

为每个代理创建自主技能目录和文件：

```bash
# SEO 代理
mkdir -p /home/user/agent-seo/skills/claude-code-autonomy
cat > /home/user/agent-seo/skills/claude-code-autonomy/SKILL.md << 'EOF'
# Claude Code Autonomy
自动处理所有 Claude Code 交互。
响应问题、批准编辑，并在完成时通知用户。
EOF

# Dev 代理
mkdir -p /home/user/agent-dev/skills/claude-code-autonomy
cat > /home/user/agent-dev/skills/claude-code-autonomy/SKILL.md << 'EOF'
# Claude Code Autonomy
在批准架构更改之前询问用户。
自动响应例行问题。在完成和错误时通知。
EOF
```

### 步骤 5 — 为每个代理创建 HEARTBEAT.md

```bash
cat > /home/user/agent-seo/HEARTBEAT.md << 'EOF'
# Heartbeat — SEO Agent

## 检查 Claude Code 会话
1. 运行 `claude_sessions` 列出活动会话
2. 如果任何会话正在等待输入 → `claude_output(session)` 读取问题
3. 响应或升级给用户
4. 如果没有会话正在等待 → HEARTBEAT_OK
EOF

cat > /home/user/agent-dev/HEARTBEAT.md << 'EOF'
# Heartbeat — Dev Agent

## 检查 Claude Code 会话
1. 运行 `claude_sessions` 列出活动会话
2. 如果任何会话正在等待输入 → `claude_output(session)` 读取问题
3. 响应或升级给用户
4. 如果没有会话正在等待 → HEARTBEAT_OK
EOF
```

### 步骤 6 — 重启 Gateway

```bash
openclaw gateway restart
```

### 步骤 7 — 测试

从 SEO 代理的 Telegram 聊天中，发送任务。代理调用：

```text
claude_launch(prompt="Audit meta tags on example.com", name="meta-audit")
```

插件解析 `/home/user/agent-seo` → `telegram|seo-bot|1111111111` 并将所有会话通知路由回 SEO 聊天。

同时，从 Dev 代理的聊天中：

```text
claude_launch(prompt="Fix the auth middleware bug", name="fix-auth")
```

这解析 `/home/user/agent-dev` → `telegram|dev-bot|2222222222` —— 通知发送到 Dev 聊天。

两个代理都不需要指定频道 —— `agentChannels` 自动处理路由。

---

## 示例

### 单个代理管理多个项目

```json
{
  "agentChannels": {
    "/home/user/project-alpha": "telegram|my-bot|9999999999",
    "/home/user/project-beta":  "telegram|my-bot|9999999999"
  }
}
```

两个项目都路由到同一个 bot 和聊天。当一个代理管理多个仓库时很有用。

### 三个代理，专用 bot

```json
{
  "agentChannels": {
    "/home/user/agent-seo":      "telegram|seo-bot|1111111111",
    "/home/user/agent-backend":  "telegram|backend-bot|2222222222",
    "/home/user/agent-frontend": "telegram|frontend-bot|3333333333"
  }
}
```

每个代理都有自己的 bot 账户和聊天。从 `/home/user/agent-backend/services/auth` 启动的会话通过前缀匹配解析为 `telegram|backend-bot|2222222222`。

### 带有特定覆盖的捕获所有

```json
{
  "agentChannels": {
    "/home/user":                "telegram|default-bot|1111111111",
    "/home/user/critical-app":   "telegram|ops-bot|4444444444"
  }
}
```

`/home/user` 下的任何工作区都路由到 `default-bot`，**除了** `/home/user/critical-app`（及其子目录），后者路由到 `ops-bot`。最长前缀匹配确保覆盖优先。

### 两段值（无账户绑定）

```json
{
  "agentChannels": {
    "/home/user/solo-project": "telegram|9999999999"
  }
}
```

使用 2 段格式 —— 通知通过任何 Telegram bot 是默认的发送到聊天 `9999999999`。`extractAgentId` 对此格式返回 `undefined`，因此心跳代理 ID 查找不适用。
