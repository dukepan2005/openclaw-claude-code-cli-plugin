# PluginCommandContext 参考

本文档介绍 OpenClaw 插件命令中使用的 `PluginCommandContext` 对象。

## 定义

**位置:** `src/plugins/types.ts:146-169`

```typescript
export type PluginCommandContext = {
  senderId?: string;
  channel: string;
  channelId?: ChannelId;
  isAuthorizedSender: boolean;
  args?: string;
  commandBody: string;
  config: OpenClawConfig;
  from?: string;
  to?: string;
  accountId?: string;
  messageThreadId?: number;
};
```

## 通用属性

| 属性 | 类型 | 说明 |
|----------|------|-------------|
| `senderId` | `string?` | 平台特定的发送者标识符 |
| `channel` | `string` | 渠道名称（如 `"telegram"`, `"discord"`, `"slack"`） |
| `channelId` | `ChannelId?` | 渠道特定的 ID 对象 |
| `isAuthorizedSender` | `boolean` | 发送者是否通过配对/白名单检查 |
| `args` | `string?` | 命令名后的参数部分 |
| `commandBody` | `string` | 完整的命令文本（包含斜杠） |
| `config` | `OpenClawConfig` | 当前的 OpenClaw 配置 |
| `from` | `string?` | 消息来源地址（用于路由，见下文） |
| `to` | `string?` | 消息目标地址（用于路由） |
| `accountId` | `string?` | 多账户渠道的账户 ID |
| `messageThreadId` | `number?` | 线程/主题 ID（如适用） |

---

# Telegram

## 私聊 (Direct Message)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Telegram 用户 ID | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:{chatId}` | `"telegram:123456789"` |
| `to` | `telegram:{chatId}` | `"telegram:123456789"` |
| `messageThreadId` | `undefined` | - |

**示例:**
```typescript
{
  senderId: "123456789",
  channel: "telegram",
  from: "telegram:123456789",
  to: "telegram:123456789",
  isAuthorizedSender: true,
  commandBody: "/status",
  args: undefined,
  config: { ... }
}
```

## 群聊 (Group Chat)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Telegram 用户 ID（实际发送者） | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:group:{chatId}` | `"telegram:group:-1001234567890"` |
| `to` | `telegram:{chatId}` | `"telegram:-1001234567890"` |
| `messageThreadId` | `undefined` | - |

**示例:**
```typescript
{
  senderId: "123456789",  // 发送命令的用户
  channel: "telegram",
  from: "telegram:group:-1001234567890",
  to: "telegram:-1001234567890",
  isAuthorizedSender: true,
  commandBody: "/phone arm 30s",
  args: "arm 30s",
  config: { ... }
}
```

## 论坛主题 (Forum Topic)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Telegram 用户 ID（实际发送者） | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:group:{chatId}:topic:{threadId}` | `"telegram:group:-1003889434099:topic:2"` |
| `to` | `telegram:{chatId}` | `"telegram:-1003889434099"` |
| `messageThreadId` | 主题/线程 ID | `2` |

**示例:**
```typescript
{
  senderId: "123456789",  // 发送命令的用户
  channel: "telegram",
  from: "telegram:group:-1003889434099:topic:2",
  to: "telegram:-1003889434099",
  messageThreadId: 2,
  isAuthorizedSender: true,
  commandBody: "/status",
  args: undefined,
  config: { ... }
}
```

### 理解 Telegram 主题中的 `from` 与 `to`

当用户在 Telegram 论坛主题中发送消息时：
- **`from`** = **会话来源地址**，包含主题 ID 以在群组内唯一标识该线程
- **`to`** = **投递目标地址**，即群组本身（不含主题后缀）

这种设计允许：
1. 同一群组的不同主题可以拥有独立的会话
2. 响应能够正确路由回特定的主题

**为什么 `from` 看起来像"目标"：** `from` 字段表示消息来源的会话上下文，而不是发送消息的人。对于主题，"来源"是特定的主题线程，因此格式为 `telegram:group:{chatId}:topic:{threadId}`。

---

# Discord

## 私聊 (Direct Message)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Discord 用户 ID | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `to` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `messageThreadId` | `undefined` | - |

**示例:**
```typescript
{
  senderId: "987654321",
  channel: "discord",
  from: "discord:123456789012345678",
  to: "discord:123456789012345678",
  isAuthorizedSender: true,
  commandBody: "/status",
  args: undefined,
  config: { ... }
}
```

## 服务器频道 (Guild Channel)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Discord 用户 ID（实际发送者） | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:channel:{channelId}` | `"discord:channel:123456789012345678"` |
| `to` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `messageThreadId` | `undefined` | - |

**示例:**
```typescript
{
  senderId: "987654321",
  channel: "discord",
  from: "discord:channel:123456789012345678",
  to: "discord:123456789012345678",
  isAuthorizedSender: true,
  commandBody: "/model gpt-4",
  args: "gpt-4",
  config: { ... }
}
```

## 线程 (Thread)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Discord 用户 ID（实际发送者） | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:thread:{threadId}` | `"discord:thread:987654321098765432"` |
| `to` | `discord:{threadId}` | `"discord:987654321098765432"` |
| `messageThreadId` | 线程 ID（如果是数字则转换为 number） | `987654321098765432` |

**注意：** Discord 线程 ID 是雪花 ID（大整数），内部以字符串形式存储。

---

# Slack

## 私聊 (Direct Message)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Slack 用户 ID | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:{channelId}` | `"slack:D12345678"` |
| `to` | `slack:{channelId}` | `"slack:D12345678"` |
| `messageThreadId` | `undefined` | - |

**示例:**
```typescript
{
  senderId: "U12345678",
  channel: "slack",
  from: "slack:D12345678",
  to: "slack:D12345678",
  isAuthorizedSender: true,
  commandBody: "/status",
  args: undefined,
  config: { ... }
}
```

## 频道 (Channel)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Slack 用户 ID（实际发送者） | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:channel:{channelId}` | `"slack:channel:C12345678"` |
| `to` | `slack:{channelId}` | `"slack:C12345678"` |
| `messageThreadId` | 线程时间戳（作为 number） | `1234567890.123456` |

**示例:**
```typescript
{
  senderId: "U12345678",
  channel: "slack",
  from: "slack:channel:C12345678",
  to: "slack:C12345678",
  messageThreadId: 1234567890.123456,  // 线程时间戳
  isAuthorizedSender: true,
  commandBody: "/think high",
  args: "high",
  config: { ... }
}
```

## 群组私聊 (Group DM)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | Slack 用户 ID（实际发送者） | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:group:{channelId}` | `"slack:group:G12345678"` |
| `to` | `slack:{channelId}` | `"slack:G12345678"` |
| `messageThreadId` | `undefined` | - |

---

# WhatsApp

## 私聊 (Direct Message)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | 电话号码（E.164 格式） | `"+1234567890"` |
| `channel` | `"whatsapp"` | - |
| `from` | `whatsapp:{jid}` | `"whatsapp:1234567890@s.whatsapp.net"` |
| `to` | `whatsapp:{jid}` | `"whatsapp:1234567890@s.whatsapp.net"` |
| `messageThreadId` | `undefined` | - |

## 群聊 (Group Chat)

| 属性 | 值 | 示例 |
|----------|-------|---------|
| `senderId` | 电话号码（E.164 格式） | `"+1234567890"` |
| `channel` | `"whatsapp"` | - |
| `from` | `whatsapp:group:{jid}` | `"whatsapp:group:123456789-1234567890@g.us"` |
| `to` | `whatsapp:{jid}` | `"whatsapp:123456789-1234567890@g.us"` |
| `messageThreadId` | `undefined` | - |

---

# 核心概念

## `senderId` 与 `from` 的区别

- **`senderId`**: 始终代表**实际发送消息的人**（用户 ID、电话号码等）
- **`from`**: 代表用于路由的**会话来源地址**

在群组/主题场景中，`from` 包含群组/主题标识符，因为：
1. 它标识消息属于哪个会话
2. 它支持按线程/主题进行会话隔离
3. 它将响应路由回正确的位置

## `from` 与 `to` 的区别

- **`from`**: 包含完整上下文的来源地址（如适用则包含主题/线程 ID）
- **`to`**: 投递目标（通常是基础渠道/群组，不含线程后缀）

这种分离允许：
- 按主题/线程进行会话隔离
- 正确的响应路由
- 支持线程绑定的会话

## 地址格式总结

| 渠道 | 私聊格式 | 群聊格式 | 主题/线程格式 |
|---------|-----------|--------------|---------------------|
| Telegram | `telegram:{chatId}` | `telegram:group:{chatId}` | `telegram:group:{chatId}:topic:{threadId}` |
| Discord | `discord:{channelId}` | `discord:channel:{channelId}` | `discord:thread:{threadId}` |
| Slack | `slack:{channelId}` | `slack:channel:{channelId}` | 通过 `messageThreadId` 标识线程 |
| WhatsApp | `whatsapp:{jid}` | `whatsapp:group:{jid}` | N/A |

---

# 在插件命令中的使用

实现插件命令处理器时：

```typescript
import type { PluginCommandContext, PluginCommandResult } from "openclaw/plugin-sdk";

export default {
  name: "mycommand",
  description: "我的自定义命令",
  handler: async (ctx: PluginCommandContext): Promise<PluginCommandResult> => {
    // 访问命令参数
    const args = ctx.args;

    // 检查授权
    if (!ctx.isAuthorizedSender) {
      return { text: "未授权" };
    }

    // 识别渠道
    if (ctx.channel === "telegram") {
      // Telegram 特定逻辑
    }

    // 访问配置
    const myConfig = ctx.config.plugins?.myplugin;

    // 基于会话路由
    const conversationKey = ctx.from;  // 用于会话隔离

    return { text: "命令执行成功" };
  },
};
```
