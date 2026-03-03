# 消息路由机制 — OpenClaw Claude Code 插件

本文档说明 Claude Code 会话输出如何路由到消息频道（Telegram、Discord 等）。

## 概述

插件采用**混合路由模型** —— 消息发送到与会话来源关联的频道，而非全局广播。

```
┌─────────────────────────────────────────────────────────────────┐
│                    频道来源 (优先级从高到低)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. ctx.messageChannel + ctx.agentAccountId (工具调用上下文)      │
│ 2. agentChannels[workdir] 配置 (工作目录 → 频道映射)             │
│ 3. fallbackChannel 配置 (默认目标)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              session.originChannel (会话记住来源频道)            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  NotificationRouter.sendMessage()               │
│                              ↓                                  │
│                     消息队列 (防限流)                           │
│                              ↓                                  │
│              openclaw message send CLI                          │
└─────────────────────────────────────────────────────────────────┘
```

## 频道格式

频道使用管道符分隔的字符串表示：

| 格式 | 示例 | 说明 |
|------|------|------|
| 2段 | `telegram\|123456789` | 频道 + 目标 |
| 3段 | `telegram\|my-agent\|123456789` | 频道 + 账户 + 目标 |
| 4段 | `telegram\|my-agent\|-1001234567890\|42` | 包含话题/线程 ID |

## 频道解析

### 优先级链

当通过 `claude_launch` 启动会话时，来源频道按以下顺序解析：

```typescript
// 1. 工具上下文 + 账户注入
if (ctx.messageChannel && ctx.agentAccountId) {
  const parts = ctx.messageChannel.split("|");
  if (parts.length >= 2) {
    channel = `${parts[0]}|${ctx.agentAccountId}|${parts.slice(1).join("|")}`;
  }
}

// 2. 基于 agentChannels 配置的工作目录查找
if (!channel && ctx.workspaceDir) {
  channel = resolveAgentChannel(ctx.workspaceDir);
}

// 3. 直接使用上下文频道（已包含 |）
if (!channel && ctx.messageChannel?.includes("|")) {
  channel = ctx.messageChannel;
}

// 4. 配置中的兜底频道
if (!channel) {
  channel = pluginConfig.fallbackChannel; // 可能是 "unknown"
}
```

### 兜底行为

当 `originChannel` 为 `"unknown"` 时：
- 插件使用配置中的 `fallbackChannel`
- 如果未配置 `fallbackChannel`，消息**不会被发送**（记录警告日志）

## 通知层级

### Level 1 — 会话生命周期（始终发送）

由 SessionManager 通过 `openclaw message send` 发送（即发即忘）。

| 表情 | 事件 | 时机 | 唤醒代理 |
|------|------|------|----------|
| ↩️ | 已启动 | 会话开始 | 否 |
| 🔔 | Claude 询问 | 等待输入 | 是 — `claude_respond` |
| ↩️ | 已回复 | 代理回复了 | 否 |
| ✅ | 已完成 | 会话结束 | 是 — `claude_output` + 总结 |
| ❌ | 失败 | 会话出错 | 否 |
| ⛔ | 已终止 | 会话被杀 | 否 |

### Level 2 — 前台流式输出（可选）

当 `claude_fg` 激活时，由 NotificationRouter 发送。实时工具调用、推理、读写。

### Level 3 — 代理行为（非插件职责）

插件与代理无关。代理如何响应 🔔 和 ✅ 由其 `HEARTBEAT.md` / `AGENTS.md` 配置决定。

## 会话模式

### 前台模式

实时流式输出到已订阅的频道。

| 事件 | 行为 |
|------|------|
| 助手文本 | 防抖流式发送 (500ms) 到所有 `foregroundChannels` |
| 工具调用 | 紧凑指示器（立即发送，先刷新待发送文本） |
| 等待输入 | 通知所有 `foregroundChannels` |
| 完成 | 通知所有 `foregroundChannels` |

多个频道可以同时观看同一个会话。

### 后台模式

仅发送最小通知。

| 事件 | 行为 |
|------|------|
| 助手文本 | 缓冲（不发送） |
| 工具调用 | 不发送 |
| 等待输入 | 🔔 通知到 `originChannel` + 唤醒代理 |
| 完成 | 静默（代理通过唤醒事件处理） |
| 运行超时 (>10分钟) | 一次性提醒到 `originChannel` |

## 唤醒机制

当会话需要代理关注（等待输入或已完成）时，插件使用两级唤醒系统：

### Tier 1 — 主要：分离进程

```bash
spawn("openclaw", ["agent", "--agent", id, "--message", text, "--deliver", ...], { detached: true })
```

- 非阻塞，代理响应通过 `--deliver` 路由到 Telegram
- 用于 🔔 等待和 ✅ 完成事件
- **无心跳依赖** — 独立工作

### Tier 2 — 备用：系统事件

```bash
openclaw system event --mode now
```

- 触发立即心跳，`reason="wake"`
- 仅当 `originAgentId` 缺失时使用
- **需要代理配置心跳**
- **已知缺陷 [#14527](https://github.com/openclaw/openclaw/issues/14527)**：如果 `HEARTBEAT.md` 为空或仅包含注释，会静默跳过

## 实现细节

### sendMessage 回调

位于 `index.ts`，`sendMessage` 函数负责：

1. 将频道字符串解析为组件（channel、account、target、threadId）
2. 处理频道为 `"unknown"` 或无效时的兜底
3. 消息入队以避免限流
4. 调用 `openclaw message send` CLI

```typescript
// CLI 调用
execFile("openclaw", [
  "message", "send",
  "--channel", channel,
  "--account", account,      // 可选
  "--thread-id", threadId,   // 可选
  "--target", target,
  "-m", text
]);
```

### 关键文件

| 文件 | 用途 |
|------|------|
| [src/shared.ts](../src/shared.ts) | `resolveOriginChannel()`、`resolveAgentChannel()` |
| [src/session-manager.ts](../src/session-manager.ts) | `deliverToTelegram()`、`wakeAgent()` |
| [src/notifications.ts](../src/notifications.ts) | `NotificationRouter` 类 |
| [index.ts](../index.ts) | `sendMessage` 回调、消息队列 |

## 配置

### agentChannels

将工作目录映射到通知频道：

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

无法解析来源时的默认目标：

```json
{
  "fallbackChannel": "telegram|my-agent|123456789"
}
```

## 总结

- **非广播系统** —— 消息定向发送到与会话关联的频道
- **会话记住来源** —— `originChannel` 在启动时设置
- **前台 = 订阅模型** —— 多个频道可同时观看
- **后台 = 仅来源** —— 最小通知发送到来源频道
- **两级唤醒** —— 主要（分离进程）+ 备用（系统事件）
- **兜底保障** —— `fallbackChannel` 处理无法解析的情况

## 相关文档

- **[AGENT_CHANNELS_CN.md](AGENT_CHANNELS_CN.md)** — 详细的 `agentChannels` 配置和多代理设置指南
