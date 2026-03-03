# PluginCommandContext Reference

This document describes the `PluginCommandContext` object used in OpenClaw plugin commands.

## Definition

**Location:** `src/plugins/types.ts:146-169`

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

## Common Properties

| Property | Type | Description |
|----------|------|-------------|
| `senderId` | `string?` | Platform-specific sender identifier |
| `channel` | `string` | Channel surface name (e.g., `"telegram"`, `"discord"`, `"slack"`) |
| `channelId` | `ChannelId?` | Provider-specific channel ID object |
| `isAuthorizedSender` | `boolean` | Whether sender passed pairing/allowlist check |
| `args` | `string?` | Command arguments after command name |
| `commandBody` | `string` | Full command text including slash |
| `config` | `OpenClawConfig` | Current OpenClaw configuration |
| `from` | `string?` | Source address for routing (see below) |
| `to` | `string?` | Destination address for routing |
| `accountId` | `string?` | Account ID for multi-account channels |
| `messageThreadId` | `number?` | Thread/topic ID if applicable |

---

# Telegram

## Direct Message (DM)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Telegram user ID | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:{chatId}` | `"telegram:123456789"` |
| `to` | `telegram:{chatId}` | `"telegram:123456789"` |
| `messageThreadId` | `undefined` | - |

**Example:**
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

## Group Chat

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Telegram user ID (the actual sender) | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:group:{chatId}` | `"telegram:group:-1001234567890"` |
| `to` | `telegram:{chatId}` | `"telegram:-1001234567890"` |
| `messageThreadId` | `undefined` | - |

**Example:**
```typescript
{
  senderId: "123456789",  // The user who sent the command
  channel: "telegram",
  from: "telegram:group:-1001234567890",
  to: "telegram:-1001234567890",
  isAuthorizedSender: true,
  commandBody: "/phone arm 30s",
  args: "arm 30s",
  config: { ... }
}
```

## Forum Topic (Group with Topics)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Telegram user ID (the actual sender) | `"123456789"` |
| `channel` | `"telegram"` | - |
| `from` | `telegram:group:{chatId}:topic:{threadId}` | `"telegram:group:-1003889434099:topic:2"` |
| `to` | `telegram:{chatId}` | `"telegram:-1003889434099"` |
| `messageThreadId` | Topic/thread ID | `2` |

**Example:**
```typescript
{
  senderId: "123456789",  // The user who sent the command
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

### Understanding `from` vs `to` in Telegram Topics

When a user sends a message in a Telegram forum topic:
- **`from`** = The **conversation source address**, which includes the topic ID to uniquely identify the thread within the group
- **`to`** = The **delivery target address**, which is the group itself (without topic suffix)

This design allows:
1. Different topics in the same group to have separate sessions
2. Responses to be correctly routed back to the specific topic

**Why `from` looks like a "target":** The `from` field represents where the message originated from in terms of conversation context, not the person who sent it. For topics, the "source" is the specific topic thread, hence `telegram:group:{chatId}:topic:{threadId}`.

---

# Discord

## Direct Message (DM)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Discord user ID | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `to` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `messageThreadId` | `undefined` | - |

**Example:**
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

## Guild Channel (Server Channel)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Discord user ID (the actual sender) | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:channel:{channelId}` | `"discord:channel:123456789012345678"` |
| `to` | `discord:{channelId}` | `"discord:123456789012345678"` |
| `messageThreadId` | `undefined` | - |

**Example:**
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

## Thread (in Guild Channel)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Discord user ID (the actual sender) | `"987654321"` |
| `channel` | `"discord"` | - |
| `from` | `discord:thread:{threadId}` | `"discord:thread:987654321098765432"` |
| `to` | `discord:{threadId}` | `"discord:987654321098765432"` |
| `messageThreadId` | Thread ID (as string converted to number if numeric) | `987654321098765432` |

**Note:** Discord thread IDs are snowflake IDs (large integers), stored as strings internally.

---

# Slack

## Direct Message (DM)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Slack user ID | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:{channelId}` | `"slack:D12345678"` |
| `to` | `slack:{channelId}` | `"slack:D12345678"` |
| `messageThreadId` | `undefined` | - |

**Example:**
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

## Channel (Public/Private)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Slack user ID (the actual sender) | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:channel:{channelId}` | `"slack:channel:C12345678"` |
| `to` | `slack:{channelId}` | `"slack:C12345678"` |
| `messageThreadId` | Thread timestamp (as number) | `1234567890.123456` |

**Example:**
```typescript
{
  senderId: "U12345678",
  channel: "slack",
  from: "slack:channel:C12345678",
  to: "slack:C12345678",
  messageThreadId: 1234567890.123456,  // Thread timestamp
  isAuthorizedSender: true,
  commandBody: "/think high",
  args: "high",
  config: { ... }
}
```

## Group DM (MPIM)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Slack user ID (the actual sender) | `"U12345678"` |
| `channel` | `"slack"` | - |
| `from` | `slack:group:{channelId}` | `"slack:group:G12345678"` |
| `to` | `slack:{channelId}` | `"slack:G12345678"` |
| `messageThreadId` | `undefined` | - |

---

# WhatsApp

## Direct Message (DM)

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Phone number (E.164 format) | `"+1234567890"` |
| `channel` | `"whatsapp"` | - |
| `from` | `whatsapp:{jid}` | `"whatsapp:1234567890@s.whatsapp.net"` |
| `to` | `whatsapp:{jid}` | `"whatsapp:1234567890@s.whatsapp.net"` |
| `messageThreadId` | `undefined` | - |

## Group Chat

| Property | Value | Example |
|----------|-------|---------|
| `senderId` | Phone number (E.164 format) | `"+1234567890"` |
| `channel` | `"whatsapp"` | - |
| `from` | `whatsapp:group:{jid}` | `"whatsapp:group:123456789-1234567890@g.us"` |
| `to` | `whatsapp:{jid}` | `"whatsapp:123456789-1234567890@g.us"` |
| `messageThreadId` | `undefined` | - |

---

# Key Concepts

## `senderId` vs `from`

- **`senderId`**: Always represents the **actual person** who sent the message (user ID, phone number, etc.)
- **`from`**: Represents the **conversation source address** for routing purposes

In group/topic contexts, `from` includes the group/topic identifiers because:
1. It identifies which conversation the message belongs to
2. It enables per-thread/per-topic session isolation
3. It routes responses back to the correct location

## `from` vs `to`

- **`from`**: Source address with full context (includes topic/thread ID when applicable)
- **`to`**: Delivery target (usually the base channel/group without thread suffix)

This separation allows:
- Session isolation by topic/thread
- Proper response routing
- Support for thread-bound sessions

## Address Format Summary

| Channel | DM Format | Group Format | Topic/Thread Format |
|---------|-----------|--------------|---------------------|
| Telegram | `telegram:{chatId}` | `telegram:group:{chatId}` | `telegram:group:{chatId}:topic:{threadId}` |
| Discord | `discord:{channelId}` | `discord:channel:{channelId}` | `discord:thread:{threadId}` |
| Slack | `slack:{channelId}` | `slack:channel:{channelId}` | Thread via `messageThreadId` |
| WhatsApp | `whatsapp:{jid}` | `whatsapp:group:{jid}` | N/A |

---

# Usage in Plugin Commands

When implementing a plugin command handler:

```typescript
import type { PluginCommandContext, PluginCommandResult } from "openclaw/plugin-sdk";

export default {
  name: "mycommand",
  description: "My custom command",
  handler: async (ctx: PluginCommandContext): Promise<PluginCommandResult> => {
    // Access command arguments
    const args = ctx.args;

    // Check authorization
    if (!ctx.isAuthorizedSender) {
      return { text: "Unauthorized" };
    }

    // Identify the channel
    if (ctx.channel === "telegram") {
      // Telegram-specific logic
    }

    // Access configuration
    const myConfig = ctx.config.plugins?.myplugin;

    // Route based on conversation
    const conversationKey = ctx.from;  // Use for session isolation

    return { text: "Command executed successfully" };
  },
};
```
