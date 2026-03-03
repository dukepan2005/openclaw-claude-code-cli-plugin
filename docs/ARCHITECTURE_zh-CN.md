# 架构文档 — OpenClaw Claude Code 插件

## 概述

OpenClaw 插件，使 AI 代理能够从消息频道（Telegram、Discord、Rocket.Chat）编排 Claude Code 会话。代理可以将 Claude Code 作为后台开发任务来生成、监控、恢复和管理。

## 系统上下文

```
用户 (Telegram/Discord) → OpenClaw Gateway → 代理 → 插件工具 → Claude Code 会话
                                                  ↓
                                        NotificationRouter → openclaw message send → 用户
```

## 核心组件

### 1. 插件入口 (`index.ts`)
- 注册 8 个工具、8 个命令、5 个网关 RPC 方法和 1 个服务
- 在服务启动时创建 SessionManager 和 NotificationRouter
- 通过 `openclaw message send` CLI 连接出站消息

### 2. SessionManager (`src/session-manager.ts`)
- 管理 Claude Code 进程的生命周期（生成、跟踪、杀死、恢复）
- 强制执行 `maxSessions` 并发限制
- 持久化已完成的会话以供恢复（最多 `maxPersistedSessions`）
- GC 间隔每 5 分钟清理过期会话

### 3. Session (`src/session-cli.ts`)

- 通过 `child_process.spawn` 包装单个 Claude Code CLI 进程
- 处理输出缓冲、前台流式传输和多轮对话
- 实现等待输入检测，带有 15 秒安全网计时器
- 双重触发保护（`waitingForInputFired`）防止重复唤醒事件

### 4. NotificationRouter (`src/notifications.ts`)
- 根据会话状态将通知路由到适当的频道
- 防抖前台流式传输（每个频道每个会话 500ms）
- 后台模式：最小通知（仅问题和响应）
- 长时间运行会话提醒（>10分钟，每个会话一次）
- 仅在前台模式下发送完成/失败通知

### 5. 共享状态 (`src/shared.ts`)
- 模块级可变引用：`sessionManager`、`notificationRouter`、`pluginConfig`
- 在服务 `start()` 期间设置，在 `stop()` 期间置空

## 数据流

### 会话启动
```
代理调用 claude_launch → 工具验证参数 → SessionManager.spawn()
  → 使用 PTY 创建会话 → Claude Code 进程启动
  → 存储来源频道用于通知
  → 预启动安全检查（自主技能、心跳配置）
```

### 等待输入（唤醒）— 两级机制
```
会话检测到空闲（轮次结束或 15 秒计时器）
  → NotificationRouter.onWaitingForInput()
  → 后台：🔔 通知到来源频道

唤醒层级 1 — 主要（分离生成）：
  → openclaw agent --agent <id> --message <text> --deliver
  → 生成分离进程 → 直接传递消息
  → 独立于心跳配置

唤醒层级 2 — 备用（系统事件，需要心跳）：
  → openclaw system event --mode now
  → 触发立即心跳，reason="wake"
  → 仅当 originAgentId 缺失时使用
  → 需要代理配置心跳（无配置 = 静默无操作）

  → 编排代理唤醒，读取输出，转发给用户
```

#### 备用唤醒的心跳依赖

备用路径（`system event --mode now`）依赖于 OpenClaw 心跳管道：
- 它触发带有 `reason="wake"` 的立即心跳
- `"wake"` 原因**不被豁免**于 `isHeartbeatContentEffectivelyEmpty`（与 `"exec-event"` 和 `"cron:*"` 原因不同）
- **缺陷 [#14527](https://github.com/openclaw/openclaw/issues/14527)**：如果 `HEARTBEAT.md` 为空或仅包含注释，唤醒会被静默跳过 —— CLI 返回 "ok" 但代理从未被唤醒。这是已知的 OpenClaw 缺陷，空内容保护错误地应用于唤醒事件。
- 预启动检查验证心跳已配置，但不验证 `HEARTBEAT.md` 是否有有效（非空、非仅注释）内容。

### 会话完成
```
Claude Code 进程退出
  → 会话状态 → completed/failed
  → 系统事件广播
  → 编排代理检索输出，总结给用户
```

## 关键设计决策

1. **使用 CLI 发送出站消息** — 没有运行时 API 用于发送消息；使用 `openclaw message send` 子进程
2. **两级唤醒** — 主要：分离生成 `openclaw agent --message --deliver`（无心跳依赖）。备用：`openclaw system event --mode now`（需要心跳；见缺陷 [#14527](https://github.com/openclaw/openclaw/issues/14527) 关于空 HEARTBEAT.md）
3. **基于 PTY 的会话** — 完整终端仿真以兼容 Claude Code
4. **后台通知抑制** — 完成/失败在后台被抑制；编排代理处理面向用户的总结
5. **maxAutoResponds 限制** — 防止无限代理循环；在用户交互时重置（`userInitiated: true`）
6. **频道传播** — 工具接受可选的 `channel` 参数以路由到正确的用户，而不是回退到 "unknown"

## 配置

有关完整的配置模式，请参阅 `openclaw.plugin.json`。关键设置：
- `maxSessions` (5) — 并发会话限制
- `fallbackChannel` — 默认通知目标
- `idleTimeoutMinutes` (30) — 空闲多轮会话的自动杀死时间
- `maxAutoResponds` (10) — 每个会话的代理自动响应限制
- `permissionMode` (bypassPermissions) — Claude Code 权限模式

## 分片文档

- [编码规范](architecture/coding-standards.md)
- [技术栈](architecture/tech-stack.md)
- [源码树](architecture/source-tree.md)
