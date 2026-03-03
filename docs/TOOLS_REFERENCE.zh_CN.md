# 工具参考

OpenClaw Claude Code 插件提供的所有工具。每个工具通过 OpenClaw 工具系统暴露给代理。

> **真实来源：** `src/tools/`

---

## 工具摘要

| 工具 | 描述 | 关键参数 |
|------|------|----------|
| `claude_launch` | 启动 Claude Code 会话 | `prompt`, `workdir`, `name`, `model`, `resume_session_id` |
| `claude_respond` | 向运行中的会话发送后续消息 | `session`, `message`, `interrupt`, `userInitiated` |
| `claude_fg` | 将会话带到前台进行流式输出 | `session`, `lines` |
| `claude_bg` | 将会话发送到后台 | `session`（可选） |
| `claude_kill` | 终止会话 | `session` |
| `claude_output` | 显示会话输出（只读） | `session`, `lines`, `full` |
| `claude_sessions` | 列出所有会话 | `status` |
| `claude_stats` | 显示使用指标 | *(无)* |

> **注意：** 没有单独的 `claude_resume` 工具。要恢复之前的会话，使用带有 `resume_session_id` 参数的 `claude_launch`。

---

## claude_launch

在后台启动 Claude Code 会话以执行开发任务。默认为多轮会话（它们保持打开以通过 `claude_respond` 接收后续消息）。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `prompt` | string | **是** | — | 要执行的任务提示 |
| `name` | string | 否 | 自动生成 | 短 kebab-case 名称（例如 `fix-auth`）。省略时从提示自动生成 |
| `workdir` | string | 否 | 代理工作区 / cwd | 会话的工作目录 |
| `model` | string | 否 | 插件默认 | 要使用的模型名称 |
| `max_budget_usd` | number | 否 | `5` | 最大预算（美元） |
| `system_prompt` | string | 否 | — | 注入会话的额外系统提示 |
| `allowed_tools` | string[] | 否 | — | Claude 会话允许的工具列表 |
| `resume_session_id` | string | 否 | — | 要恢复的 Claude 会话 ID（来自之前会话的 `claudeSessionId`）。接受名称、内部 ID 或 Claude UUID —— 插件会解析它 |
| `fork_session` | boolean | 否 | `false` | 恢复时，分支到新会话而不是继续现有会话。与 `resume_session_id` 一起使用 |
| `multi_turn_disabled` | boolean | 否 | `false` | 禁用多轮模式。设为 `true` 用于不接受后续消息的一次性会话 |
| `permission_mode` | enum | 否 | 插件配置 / `bypassPermissions` | 以下之一：`default`、`plan`、`acceptEdits`、`bypassPermissions` |

### 预启动守卫

在生成之前，`claude_launch` 运行 [4 个强制安全检查](PRELAUNCH_GUARDS_CN.md)。如果任何检查失败，启动会被阻止并显示可操作的错误消息。其他工具和网关 RPC 跳过这些守卫。

### 示例

```
claude_launch(
  prompt: "修复 src/auth.ts 中的认证 bug — 用户刷新后被登出",
  name: "fix-auth-bug",
  workdir: "/home/user/my-project",
  max_budget_usd: 3
)
```

### 恢复之前的会话

```
claude_launch(
  prompt: "从你离开的地方继续 — 还要为修复添加测试",
  resume_session_id: "abc12345",
  name: "fix-auth-continued"
)
```

### 分支会话

```
claude_launch(
  prompt: "尝试使用 JWT 的替代方案",
  resume_session_id: "abc12345",
  fork_session: true,
  name: "fix-auth-jwt-approach"
)
```

---

## claude_respond

向运行中的多轮 Claude Code 会话发送后续消息。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `session` | string | **是** | — | 会话名称或 ID |
| `message` | string | **是** | — | 要发送的消息 |
| `interrupt` | boolean | 否 | `false` | 在发送前中断当前轮次。用于在响应中途重定向会话 |
| `userInitiated` | boolean | 否 | `false` | 当消息来自用户（非自动生成）时设为 `true`。重置自动响应计数器 |

### 自动响应安全上限

插件跟踪代理自动响应会话的次数。当计数器达到 `maxAutoResponds`（默认：10）时，进一步的代理发起的响应会被阻止。这防止无限的代理-会话循环。

- **代理响应**增加计数器
- **用户发起的响应**（`userInitiated: true`）将计数器重置为 0
- 被阻止时，代理被指示询问用户输入

### 示例

```
claude_respond(
  session: "fix-auth-bug",
  message: "是的，使用存储在 httpOnly cookies 中的 refresh token"
)
```

### 中断并重定向

```
claude_respond(
  session: "fix-auth-bug",
  message: "停下 — 不要修改数据库 schema。只改变 token 逻辑。",
  interrupt: true
)
```

---

## claude_fg

将 Claude Code 会话带到前台。显示缓冲输出并开始将新输出流式传输到当前频道。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `session` | string | **是** | — | 会话名称或 ID |
| `lines` | number | 否 | `30` | 要显示的最近缓冲行数 |

### 追赶输出

当会话被带到前台时，插件检查"追赶"输出 —— 在频道处于后台时产生的行。如果存在追赶输出，会显示它而不是通用的最后 N 行。

### 示例

```
claude_fg(session: "fix-auth-bug", lines: 50)
```

**输出：**
```
Session fix-auth-bug [a1b2c3d4] now in foreground.
Status: RUNNING | Duration: 2m 15s
────────────────────────────────────────────────────────────
📋 Catchup (3 missed outputs):
...
────────────────────────────────────────────────────────────
Streaming new output... Use claude_bg to detach.
```

---

## claude_bg

将 Claude Code 会话发送回后台（停止流式输出）。保存当前输出偏移量，以便 `claude_fg` 稍后可以显示追赶内容。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `session` | string | 否 | — | 会话名称或 ID。如果省略，分离当前在此频道处于前台的所有会话 |

### 示例

```
# 将特定会话发送到后台
claude_bg(session: "fix-auth-bug")

# 将当前前台的内容发送到后台
claude_bg()
```

---

## claude_kill

终止运行中的 Claude Code 会话。无法杀死已处于终止状态的会话（`completed`、`failed`、`killed`）。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `session` | string | **是** | — | 要终止的会话名称或 ID |

### 示例

```
claude_kill(session: "fix-auth-bug")
```

---

## claude_output

显示 Claude Code 会话的最近输出。只读 —— 不改变前台状态或影响流式传输。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `session` | string | **是** | — | 会话名称或 ID |
| `lines` | number | 否 | `50` | 要显示的最近行数 |
| `full` | boolean | 否 | `false` | 显示所有可用输出（最多 200 行缓冲区） |

### 示例

```
claude_output(session: "fix-auth-bug", lines: 100)
```

**输出：**
```
Session: fix-auth-bug [a1b2c3d4] | Status: RUNNING | Duration: 5m 30s
────────────────────────────────────────────────────────────
[session output lines...]
```

---

## claude_sessions

列出所有 Claude Code 会话及其状态和进度。当由具有工作区上下文的代理调用时，会话被过滤为仅显示该代理的会话（通过 `originChannel` 匹配）。

### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `status` | enum | 否 | `all` | 按状态过滤：`all`、`running`、`completed`、`failed` |

### 代理感知过滤

当代理调用 `claude_sessions` 时，插件从 `agentChannels` 配置解析代理的频道，并按 `originChannel` 过滤会话。这确保每个代理只看到自己的会话。如果找不到频道映射，则回退显示所有会话。

### 示例

```
claude_sessions(status: "running")
```

**输出：**
```
🟢 fix-auth-bug [a1b2c3d4] — RUNNING (2m 15s) multi-turn
   Prompt: "修复 src/auth.ts 中的认证 bug..."
   Claude Session ID: 550e8400-e29b-41d4-a716-446655440000

🏁 setup-heartbeat [e5f6g7h8] — COMPLETED (45s) single-turn
   Prompt: "重启网关以激活心跳..."
   Claude Session ID: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
```

---

## claude_stats

显示 Claude Code 插件使用指标：按状态统计的会话数、总成本、平均持续时间，以及最昂贵的会话。

### 参数

*(无)*

### 示例

```
claude_stats()
```

**输出：**
```
Total launched: 12
Completed: 8 | Failed: 2 | Killed: 2
Total cost: $4.23
Average duration: 3m 45s
Most expensive: fix-auth-bug ($1.20) — "修复认证 bug..."
```

---

## 会话生命周期

```
claude_launch  ──►  STARTING  ──►  RUNNING  ──►  COMPLETED
                                     │              ▲
                                     │              │
                                     ▼              │
                               claude_respond ──────┘
                               claude_fg / claude_bg
                               claude_output
                                     │
                                     ▼
                               claude_kill  ──►  KILLED

                               (errors)    ──►  FAILED
```

- **STARTING** — 会话正在初始化（构建 SDK 选项，连接中）
- **RUNNING** — 会话处于活动状态并接受消息
- **COMPLETED** — 会话成功完成
- **FAILED** — 会话出错
- **KILLED** — 会话通过 `claude_kill` 被终止

---

## 会话解析

大多数工具接受 `session` 参数，可以是**会话名称**（例如 `fix-auth-bug`）或**会话 ID**（例如 `a1b2c3d4`）。插件首先按 ID 解析，然后回退到名称匹配。

对于带有 `resume_session_id` 的 `claude_launch`，插件还会检查持久化会话（已从内存垃圾回收但元数据仍存储的会话）。它接受内部 ID、会话名称或 Claude UUID。
