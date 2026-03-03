# OpenClaw Claude Code CLI Plugin (中文)

> **⚠️ 重要声明**：本项目是从 [alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin) fork 而来。**本 fork 中 99.99999% 的代码更改都是由 Claude Code（Anthropic 的 AI 编程助手）开发的**。本 fork 主要将架构从基于 SDK 改为基于 CLI 的实现，几乎所有实现工作都由 Claude Code 完成。

通过 Telegram、Discord 等聊天频道，远程控制 Claude Code 执行开发任务。

<div align="center">

[English](README.md) | 简体中文

</div>

<div align="center">

[![Demo Video](https://img.youtube.com/vi/vbX1Y0Nx4Tc/maxresdefault.jpg)](https://youtube.com/shorts/vbX1Y0Nx4Tc)

*两个并行的 Claude Code 代理同时在 Telegram 中构建 X 克隆和 Instagram 克隆。*

</div>

---

## 🔄 关于本项目

### Fork 来源

本项目是从 [alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin) fork 而来，原作者为 **alizarion**。

### 核心差异：基于 CLI 的架构

**原项目 (@alizarion/openclaw-claude-code-plugin)**

- 使用 `@anthropic-ai/claude-agent-sdk` npm 包
- SDK 嵌入在插件内部
- 仅支持 Anthropic 官方 Claude API

**本项目 (@dukepan2005/openclaw-claude-code-cli-plugin)**

- **通过 `child_process.spawn` 启动 Claude Code CLI 子进程**
- 通过 stdin/stdout 以 stream-json 格式与 CLI 通信
- **兼容任何 Claude 协议的模型服务**（Anthropic API、OpenRouter、自定义端点等）

### 为什么选择这种方式？

✅ **模型灵活性**：无需修改插件代码即可使用任何兼容 Claude 的服务

✅ **配置复用**：直接使用 `claude` CLI 的现有配置（`~/.claude/config.json`）

✅ **自动更新**：自动受益于 Claude Code CLI 的更新

✅ **无 SDK 依赖**：消除了 SDK 版本兼容性问题

### 🙏 致谢

**特别感谢 [@alizarion](https://github.com/alizarion)** 创建了原始的 [openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin) 项目。本 fork 建立在原项目优秀的架构和基础之上。

### 安装方式

由于是 fork 项目，建议从源码安装：

```bash
# 克隆仓库
git clone https://github.com/dukepan2005/openclaw-claude-code-cli-plugin.git
cd openclaw-claude-code-cli-plugin

# 安装依赖并构建
npm install
npm run build

# 本地安装插件（开发模式）
openclaw plugins link .
openclaw gateway restart
```

---

## 🚀 快速开始（5 分钟上手）

### 第 1 步：安装插件

```bash
# 从本地源码安装（推荐，用于此 fork 项目）
git clone https://github.com/dukepan2005/openclaw-claude-code-cli-plugin.git
cd openclaw-claude-code-cli-plugin
npm install
npm run build
openclaw plugins link .
openclaw gateway restart

# 或从 npm 安装（发布后）
openclaw plugins install @dukepan2005/openclaw-claude-code-cli-plugin
openclaw gateway restart
```

### 第 2 步：配置通知

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "fallbackChannel": "telegram|my-agent-id|your-chat-id",
          "maxSessions": 5
        }
      }
    }
  }
}
```

重启 Gateway：
```bash
openclaw gateway restart
```

### 第 3 步：启动第一个会话

在 Telegram 中发送：

```
/claude -name hello-world 创建一个 hello world 程序
```

> **⚠️ 重要提示**：`-name` 参数是**必需的**，用于启动新会话。
> - 不带 `-name`：向最近的活动会话发送消息
> - 带 `-name`：创建指定名称的新会话

---

## 📖 完整文档

| 文档 | 描述 |
|------|------|
| **[用户使用指南 📘](docs/USER_GUIDE_CN.md)** | 快速上手、命令详解、常见场景、故障排除 |
| **[多代理设置指南 🤖](docs/AGENT_CHANNELS_CN.md)** | agentChannels 和 fallbackChannel 详细配置说明 |
| [API 文档](docs/API.md) | 工具、命令和 RPC 方法完整参数表 |
| [架构文档](docs/ARCHITECTURE.md) | 架构概览和组件说明 |
| [开发指南](docs/DEVELOPMENT.md) | 开发者文档 |

---

## ⚡ 快速使用示例

### 启动会话

```bash
/claude -name fix-auth 修复认证问题
```

### 查看会话

```bash
/claude_sessions                    # 列出所有会话
/claude_output fix-auth               # 查看会话输出
```

### 与会话交互

```bash
# 快速发送消息（发送到当前频道最近的活动会话）
/claude 添加单元测试

# 指定要发送消息的会话
/claude_respond fix-auth 添加单元测试

# 中断并重定向
/claude_respond --interrupt fix-auth 停下！用另一个方案

# 快速中断（发送 ESC 停止当前响应）
/claude_esc                    # 中断最近的会话
/c_esc fix-auth                # 中断指定会话
```

> **提示**：
> - 不带 `-name` 的 `/claude <消息>` 会发送到当前频道最近的活动会话
> - `/claude_esc` 或 `/c_esc` 发送 ESC 来中断 Claude 的响应
> - 使用 `/claude_respond <名称> <消息>` 可以指定特定会话

### 实时监控

```bash
/claude_fg fix-auth                   # 实时查看输出
/claude_bg                            # 停止实时查看
```

### 会话生命周期

```bash
/claude_kill fix-auth                   # 终止会话
/claude_resume fix-auth 继续优化         # 恢复会话
/claude_resume --fork fix-auth 尝试不同方案  # Fork 会话
```

---

## ✨ 功能特性

- **多会话管理** - 并发运行多个会话，每个都有唯一 ID 和可读名称
- **前台/后台模式** - 默认后台运行；可将任何会话带到前台实时流式输出
- **实时通知** - 在完成、失败或 Claude 提问时收到通知
- **多轮对话** - 发送后续消息、中断或迭代运行中的代理
- **会话恢复和分支** - 恢复任何已完成的会话或分支到新对话
- **4 项启动前安全检查** - 自主技能、心跳配置、HEARTBEAT.md、频道映射
- **多代理支持** - 通过基于工作区的频道映射路由通知
- **自动清理** - 完成的会话在 1 小时后垃圾回收；ID 保持可用于恢复

---

## 🔧 配置选项

在 `~/.openclaw/openclaw.json` 的 `plugins.entries["openclaw-claude-code-plugin"].config` 下设置值。

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `agentChannels` | `object` | — | 工作目录路径 → 通知频道的映射 |
| `fallbackChannel` | `string` | — | 默认通知频道 |
| `maxSessions` | `number` | `5` | 最大并发会话数 |
| `maxAutoResponds` | `number` | `10` | 连续自动响应前的最大次数 |
| `defaultBudgetUsd` | `number` | `5` | 每个会话的默认预算（美元） |
| `permissionMode` | `string` | `"bypassPermissions"` | 权限模式 |
| `skipSafetyChecks` | `boolean` | `false` | 跳过所有启动前安全守卫（仅用于开发/测试） |

### 配置示例

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
          "fallbackChannel": "telegram|my-main-agent|123456789",
          "agentChannels": {
            "/home/user/agent-seo": "telegram|seo-agent|123456789",
            "/home/user/agent-main": "telegram|my-main-agent|123456789"
          }
        }
      }
    }
  }
}
```

---

## 📋 所有命令

| 命令 | 描述 |
|------|------|
| `/claude -name <名称> <提示词>` | 启动新的 Claude Code 会话 |
| `/claude <消息>` | 向当前频道最近的活动会话发送消息 |
| `/claude_sessions` | 列出所有会话及其状态和时长 |
| `/claude_respond <名称> <消息>` | 向指定会话发送后续消息 |
| `/claude_respond --interrupt <名称> <消息>` | 中断会话然后发送消息 |
| `/claude_fg <名称>` | 将会话带到前台（实时流式输出） |
| `/claude_bg` | 将当前前台会话发送到后台 |
| `/claude_watch <名称>` | 订阅会话的实时输出（无追赶） |
| `/claude_unwatch <名称>` | 取消订阅会话的实时输出 |
| `/claude_kill <名称>` | 终止运行中的会话 |
| `/claude_output <名称>` | 读取会话的缓冲输出 |
| `/claude_resume <名称>` | 恢复之前的会话或分支到新对话 |
| `/claude_stats` | 显示使用指标（次数、时长、成本） |
| `/claude_esc` | 发送 ESC 中断当前的 Claude 响应 |
| `/c_esc <名称>` | 发送 ESC 中断指定会话（简写） |

所有命令都是可在 Telegram、Discord 和其他 OpenClaw 支持的频道中使用的**聊天命令**。

> 完整参数表和响应模式：[docs/API.md](docs/API.md)

---

## 🔔 通知说明

插件会根据会话生命周期事件发送实时通知：

| 图标 | 事件 | 描述 |
|------|------|------|
| 🚀 | Launched | 会话成功启动 |
| 🔔 | Claude asks | 会话正在等待用户输入 — 包含输出预览 |
| 💬 | Responded | 后续消息已发送到会话 |
| ✅ | Completed | 会话成功完成 |
| ❌ | Failed | 会话遇到错误 |
| ⛔ | Killed | 会话被手动终止 |

前台会话实时流式传输完整输出。后台会话仅发送生命周期通知。

> 通知架构和传递模型：[docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)

---

## 💪 最佳实践

### 1. 给会话起有意义的名字

```
✅ 好的命名:
/claude --name fix-auth-bug 修复认证
/claude --name add-user-profile 添加用户资料

❌ 避免:
/claude --name task1 修复认证
/claude --name test 添加功能
```

### 2. 明确描述任务

```
✅ 好的描述:
/claude 在 src/auth.ts 的 login 函数中添加空值检查

❌ 模糊描述:
/claude 修复 bug
```

### 3. 合理设置预算

```
小任务（1-2分钟）: 预算约 $0.01-0.05
中等任务（5-10分钟）: 预算约 $0.5-2
大任务（30分钟+）: 预算 $5-10+
```

> **💡 Coding Plan 服务**：如果你的 AI 服务提供商提供 **Coding Plan**（非按 token 计费或固定价格订阅），你可以设置一个更大的预算值（例如 `100` 或 `1000`），以防止会话因预算耗尽而被终止。这对于不按 token 收费的面向开发的计划特别有用。

### 4. 使用前台模式监控重要任务

```
/claude --name deploy-api 部署 API 到生产环境
/claude_fg deploy-api    # 实时监控
/claude_bg              # 停止监控
```

### 5. 及时清理完成的会话

```
/claude_sessions         # 查看会话
/claude_kill old-session # 终止不需要的会话
```

---

## 🐛 故障排除

### 问题 1：命令没有反应

**原因：** Gateway 没有运行

**解决：**
```bash
openclaw gateway restart
```

---

### 问题 2："SessionManager not initialized" 错误

**原因：** 插件服务未启动

**解决：**
```bash
openclaw gateway status
openclaw gateway restart
```

---

### 问题 3：会话一直卡在 "starting"

**原因：** Claude Code CLI 未安装

**解决：**
```bash
which claude
npm install -g @anthropic-ai/claude-code
```

---

### 问题 4：没有收到通知

**原因：** `fallbackChannel` 或 `agentChannels` 配置错误

**解决：**

**方法一：使用 @userinfobot 获取 Chat ID（推荐）**
1. 在 Telegram 中搜索 `@userinfobot`
2. 发送 `/start` 命令
3. Bot 会返回你的 Chat ID（个人聊天为正数）

**方法二：使用 Bot API 获取 Chat ID**
1. 向你的 Bot 发送任意消息
2. 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在返回的 JSON 中找到 `"chat":{"id":123456789}`

**更新配置：**

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "fallbackChannel": "telegram|my-agent-id|123456789",
          "agentChannels": {
            "/你的项目路径": "telegram|my-agent-id|123456789"
          }
        }
      }
    }
  }
}
```

**频道格式说明：**
```text
telegram|OpenClaw代理ID|聊天ID
```

- **平台**：`telegram` 或 `discord`
- **OpenClaw 代理 ID**：你在 `openclaw.json → agents.list` 中配置的代理标识符（例如 `seo-bot`），**不是** Telegram bot 用户名（不要加 `@` 符号）
- **聊天 ID**：
  - 个人聊天：正数（如 `123456789`）
  - 群组/频道：负数，以 `-100` 开头（如 `-1009876543210`）

重启 Gateway：
```bash
openclaw gateway restart
```

---

### 问题 5：会话意外终止

**原因：** 预算耗尽或空闲超时

**解决：**
- 增加预算：`defaultBudgetUsd: 10`
- 增加超时：`idleTimeoutMinutes: 60`

---

## 📚 文档导航

### 普通用户

**从这里开始 →** [USER_GUIDE_CN.md](docs/USER_GUIDE_CN.md) — 完整用户指南，包含快速入门、命令详解和故障排除

| 优先级 | 文档 | 描述 |
|:------:|------|------|
| 1️⃣ | [USER_GUIDE_CN.md](docs/USER_GUIDE_CN.md) | 用户使用指南和首次启动流程 |
| 2️⃣ | [TOOLS_REFERENCE_CN.md](docs/TOOLS_REFERENCE_CN.md) | 所有工具、命令和 RPC 方法参考 |
| 3️⃣ | [PRELAUNCH_GUARDS_CN.md](docs/PRELAUNCH_GUARDS_CN.md) | 预启动安全检查和故障排除 |

### 多代理配置

**从这里开始 →** [AGENT_CHANNELS_CN.md](docs/AGENT_CHANNELS_CN.md) — 配置工作区到频道的映射

| 优先级 | 文档 | 描述 |
|:------:|------|------|
| 4️⃣ | [AGENT_CHANNELS_CN.md](docs/AGENT_CHANNELS_CN.md) | 多代理设置、通知路由、工作区映射 |
| 5️⃣ | [MESSAGE_ROUTING_CN.md](docs/MESSAGE_ROUTING_CN.md) | 消息路由：频道解析、通知层级、唤醒机制 |

### 开发者

**从这里开始 →** [ARCHITECTURE_CN.md](docs/ARCHITECTURE_CN.md) — 理解插件架构

| 优先级 | 文档 | 描述 |
| :------: | ------ | ------ |
| 6️⃣ | [ARCHITECTURE_CN.md](docs/ARCHITECTURE_CN.md) | 架构概览和组件分解 |
| 7️⃣ | [DEVELOPMENT_CN.md](docs/DEVELOPMENT_CN.md) | 开发指南、项目结构、构建说明 |
| 8️⃣ | [OpenClaw-Context-Reference.zh_CN.md](docs/OpenClaw-Context-Reference.zh_CN.md) | OpenClaw 上下文类型（PluginCommandContext、ToolContext） |

---

## 🆘 获取帮助

遇到问题？

1. 查看本文档的故障排除部分
2. 检查 Gateway 日志：`openclaw logs`
3. 在 GitHub 提 issue：[github.com/alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin)

---

## 📄 许可证

MIT — see [package.json](package.json) for details.

---

<div align="center">

**[⬆ 返回双语 README](README.md)**

</div>
