# 开发指南

## 项目结构

```
claude-code/
├── index.ts                    # 插件入口点（register 函数）
├── openclaw.plugin.json        # 插件清单和配置模式
├── package.json                # 依赖
├── src/
│   ├── types.ts                # TypeScript 接口
│   ├── shared.ts               # 全局状态、辅助函数、格式化
│   ├── session.ts              # Session 类（SDK 包装器）
│   ├── session-manager.ts      # 会话池管理
│   ├── notifications.ts        # NotificationRouter
│   ├── gateway.ts              # RPC 方法注册
│   ├── tools/
│   │   ├── claude-launch.ts    # claude_launch 工具
│   │   ├── claude-sessions.ts  # claude_sessions 工具
│   │   ├── claude-output.ts    # claude_output 工具
│   │   ├── claude-fg.ts        # claude_fg 工具
│   │   ├── claude-bg.ts        # claude_bg 工具
│   │   ├── claude-kill.ts      # claude_kill 工具
│   │   ├── claude-respond.ts   # claude_respond 工具
│   │   └── claude-stats.ts     # claude_stats 工具
│   └── commands/
│       ├── claude.ts           # /claude 命令
│       ├── claude-sessions.ts  # /claude_sessions 命令
│       ├── claude-fg.ts        # /claude_fg 命令
│       ├── claude-bg.ts        # /claude_bg 命令
│       ├── claude-kill.ts      # /claude_kill 命令
│       ├── claude-resume.ts    # /claude_resume 命令
│       ├── claude-respond.ts   # /claude_respond 命令
│       └── claude-stats.ts     # /claude_stats 命令
├── skills/
│   └── claude-code-orchestration/
│       └── SKILL.md            # 编排技能定义
└── docs/
    ├── TOOLS_REFERENCE.md      # 完整 API 参考
    ├── ARCHITECTURE.md         # 架构概览
    ├── MESSAGE_ROUTING.md      # 消息路由详情
    └── DEVELOPMENT.md          # 本文件
```

---

## 依赖

| 包 | 用途 |
|---|---|
| `@sinclair/typebox` | JSON Schema 类型构建器，用于工具参数定义 |
| `nanoid` | 生成短唯一会话 ID（8 个字符） |

---

## 关键设计决策

1. **前台是按频道的，不是按会话的。** 多个频道可以同时观看同一个会话，一个频道可以有多个会话处于前台。

2. **多轮使用 stdin stream-json。** Session 类以 stream-json 格式将用户消息写入 Claude Code CLI 的 stdin，使会话在多个轮次间保持活动。

3. **持久化会话在 GC 后存活。** 当会话被垃圾回收（完成后 1 小时），其 Claude 会话 ID 保留在单独的 `persistedSessions` 映射中，以便稍后恢复。条目存储在三个键下（内部 ID、名称、Claude UUID）以实现灵活查找。

4. **通知使用 CLI 外壳。** 由于插件 API 不暴露运行时 `sendMessage` 方法，出站通知通过 `child_process.execFile` 使用 `openclaw message send`。

5. **指标仅存在于内存中。** 会话指标在 `SessionManager` 中聚合，并在服务重启时重置。它们不会持久化到磁盘。成本数据在内部跟踪，但不在任何面向用户的输出中暴露。

6. **等待输入使用双重检测。** 轮次结束检测（当多轮结果解析时）是主要信号，由 15 秒安全网计时器支持用于边缘情况。`waitingForInputFired` 标志防止重复唤醒事件。

7. **频道 "unknown" 会穿透。** 如果 `channelId` 是 `"unknown"`，通知系统会显式穿透到 `fallbackChannel`，而不是尝试传递到无效目的地。

---

## 核心概念：Session 和 Channel

### Session（会话）

`Session` 是对 Claude Code CLI 进程的封装。每个 Session 管理一个通过 `child_process.spawn()` 启动的子进程。

```
Session (src/session-cli.ts)
  ├── childProcess        ← Claude Code CLI 子进程
  ├── foregroundChannels  ← Set<string> 实时监听的频道集合
  ├── outputBuffer        ← 输出历史（最多 200 行）
  ├── status              ← "starting" | "running" | "completed" | "failed" | "killed"
  └── callbacks           ← onOutput, onToolUse, onComplete, onWaitingForInput
```

**关键行为：**
- `foregroundChannels.add(channelId)` — 启用向该频道实时推送输出
- `foregroundChannels.delete(channelId)` — 停止推送；会话在该频道进入后台运行
- 一个会话可以同时被多个频道监听

### Channel（频道）

`channel` 是消息目的地的字符串标识符（Telegram 聊天、Discord 频道等）。它表示"用户从哪里发送命令"。

**内部格式（使用 `|` 作为分隔符）：**
- `telegram|123456789` — 2 段：频道类型 + 聊天 ID
- `telegram|my-agent|123456789` — 3 段：带账户
- `telegram|my-agent|-1001234567890|42` — 4 段：带话题/线程

**OpenClaw 输入格式（使用 `:` 作为分隔符）：**
- `ctx.to` 格式：`telegram:-1003889434099`（由 `resolveOriginChannel()` 转换为内部格式）

**解析流程：**
```
用户从 Telegram 群组发送命令
  → ctx.to = "telegram:-1003889434099"
  → resolveOriginChannel(ctx) 转换为 "telegram|-1003889434099"
  → channelId 存储在 session.foregroundChannels 中
```

### 前台 vs 后台

- **前台**（频道在 `foregroundChannels` 中）：实时输出流（500ms 防抖）
- **后台**（频道不在 `foregroundChannels` 中）：仅最小通知（提问、完成）

`/claude_watch` 和 `/claude_unwatch` 等命令管理哪些频道在前台集合中。

**输出流程：**
```
CLI 输出文本
  → Session.onOutput 回调
  → NotificationRouter.onAssistantText()
  → 遍历 session.foregroundChannels
  → 推送到每个频道
```

---

## 添加新工具或命令

1. 在 `src/tools/` 或 `src/commands/` 下创建新文件。
2. 导出 `registerXxxTool(api)` 或 `registerXxxCommand(api)` 函数。
3. 在 `index.ts` 的 `register()` 函数中导入并调用它。

---

## 服务生命周期

- **`start()`** — 创建 `SessionManager` 和 `NotificationRouter`，将它们连接在一起，启动长时间运行提醒检查间隔（60秒），并启动 GC 间隔（5分钟）。
- **`stop()`** — 停止通知路由器，杀死所有活动会话，清除间隔，并将单例置空。

---

## OpenClaw 上下文字段

当 OpenClaw 调用命令处理程序时，它提供丰富的上下文对象。以下是可用字段：

```typescript
interface OpenClawCommandContext {
  // 发送者信息
  senderId: string;           // "5948095689" - 发送命令的用户 ID

  // 频道信息
  channel: string;            // "telegram" | "discord" | "whatsapp" | ...
  channelId: string;          // 内部频道标识符

  // 路由信息（用于回复的关键）
  from: string;               // "telegram:group:-1003889434099:topic:2"
  to: string;                 // "telegram:-1003889434099" (目标聊天)
  accountId: string;          // "default" - 频道账户 ID
  messageThreadId: number;    // 2 - 话题/线程 ID（用于论坛话题）

  // 命令内容
  args: string;               // 命令参数（不含命令名）
  commandBody: string;        // 完整命令文本: "/claude your prompt"

  // 授权
  isAuthorizedSender: boolean;

  // 配置
  config: Record<string, any>;
}
```

### 上下文示例

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

### 使用上下文进行回复

`src/shared.ts` 中的 `resolveOriginChannel()` 函数从上下文中提取回复信息：

```typescript
// 频道格式: "channel|account|chatId|threadId"
// 示例: "telegram|default|-1003889434099|2"

const originChannel = resolveOriginChannel(ctx);
// 返回: "telegram|default|-1003889434099|2"
```

然后此频道字符串与 `openclaw message send` 一起使用：

```bash
openclaw message send \
  --channel telegram \
  --account default \
  --target -1003889434099 \
  --thread-id 2 \
  -m "回复消息"
```
