# Commands Development Instructions

This document guides implementation of OpenClaw commands in `src/commands/`.

## Pattern Overview

Every command follows the **registration function pattern**: export `register<CommandName>Command(api: any)` that calls `api.registerCommand()` with a handler.

```typescript
export function registerClaudeXxxCommand(api: any): void {
  api.registerCommand({
    name: "claude_xxx",
    description: "Short description",
    acceptsArgs: true,  // or false
    requireAuth: true,
    handler: async (ctx: any) => {
      // implementation
      return { text: "response" };
    }
  });
}
```

## Required Structure

### 1. Registration Function Signature
```typescript
export function register<CommandName>Command(api: any): void {
  api.registerCommand({ ... });
}
```

- Export name must match the pattern: `register<CommandName>Command`
- Always takes an `api` parameter (OpenClaw's command registration API)
- No return value (void)

### 2. Command Metadata
```typescript
api.registerCommand({
  name: string;              // Slash command name (e.g., "claude", "claude_fg")
  description: string;       // Help text shown to users
  acceptsArgs: boolean;      // Whether the command accepts arguments/options
  requireAuth: boolean;      // Always true for safety
  handler: (ctx: any) => TResponse;
});
```

**Naming convention**:
- Command names use lowercase + underscores: `claude`, `claude_fg`, `claude_sessions`, `claude_respond`
- Registration function names use camelCase: `registerClaudeFgCommand`, `registerClaudeSessionsCommand`

### 3. Handler Function
The handler is called when a user invokes the command. It receives a context object:

**Context object (`ctx`)**:
```typescript
ctx.args?:         string        // Raw arguments after command name
ctx.channel?:      string        // Channel platform (e.g., "telegram", "discord")
ctx.chatId?:       string        // Chat/channel ID
ctx.senderId?:     string        // User ID of command sender
ctx.accountId?:    string        // Account ID (for multi-account channels)
ctx.messageThreadId?: string     // Thread/topic ID (if applicable)
ctx.to?:           string        // Resolved destination (e.g., "telegram:123456")
// Plus other OpenClaw fields
```

**Handler signature**:
```typescript
// Synchronous (for simple queries, no session operations)
handler: (ctx: any) => { text: string }

// Asynchronous (when calling async session methods like sendMessage(), interrupt())
handler: async (ctx: any) => { text: string }
```

Use `async` only when your handler calls session methods or other async operations. Keep simple commands synchronous.

### 4. Handler Implementation Pattern

**Step 1: Check SessionManager**
```typescript
if (!sessionManager) {
  return {
    text: "Error: SessionManager not initialized. The claude-code service must be running.",
  };
}
```

**Step 2: Parse Arguments** (if `acceptsArgs: true`)
Commands can accept:
- Simple space-separated args: `args = ctx.args?.trim()`
- Flags with values: `--flag value` or `-f value`
- Optional values with fallbacks

**Step 3: Resolve Context**
Use helper functions from `src/shared.ts`:
- `resolveOriginChannel(ctx)` → Normalized channel string (e.g., "telegram|123456")

**Step 4: Session Lookup**
```typescript
const session = sessionManager.resolve(ref);  // By name or ID
if (!session) {
  return { text: `Error: Session "${ref}" not found.` };
}
```

or for finding by channel:
```typescript
const channelId = resolveOriginChannel(ctx);
const session = sessionManager.findMostRecentSessionForChannel(channelId);
if (!session) {
  return { text: "No active session in this channel." };
}
```

**Step 5: Validate State**
Check session status before operations:
```typescript
if (session.status !== "running") {
  return {
    text: `Error: Session is not running (status: ${session.status}).`,
  };
}
```

**Step 6: Execute Operation**
Perform the command's main action (send message, kill session, etc.).

**Step 7: Return Response**
Always return a response object with user-friendly text:
```typescript
return { text: "✅ Operation completed." };
```

### 5. Error Handling
- Always check `sessionManager` initialization first
- Provide actionable error messages
- Return errors in the same response format, never throw
- Guide users on next steps when operations fail

**Pattern**:
```typescript
return {
  text: [
    "Error: <problem>.",
    "",
    "To resolve:",
    "- Step 1: ...",
    "- Step 2: ...",
  ].join("\n"),
};
```

### 6. User Feedback
Commands should provide clear, emojified feedback:
- `🟢` Running session
- `🟡` Starting/waiting session
- `❌` Failed/error
- `✅` Success/completed
- `⏹️` Interrupted/stopped
- `💬` Message sent
- `📋` Information/listing

Examples:
```typescript
return { text: "✅ Session started: my-task [abc123]" };
return { text: "No active session. Use `/claude --name <name> <prompt>` to start one." };
```

### 7. Multi-Mode Commands
Some commands have multiple modes (e.g., `/claude` with and without `--name`):

```typescript
// Mode detection
const hasNameFlag = args.match(/^(?:--name|-n)\s+(\S+)\s+/);

if (hasNameFlag) {
  // Mode 1: Launch new session
} else {
  // Mode 2: Respond to active session
}
```

Always explain which mode the user is in and guide them to alternatives.

## Common Imports
Every command typically imports:
```typescript
import { sessionManager, formatDuration, resolveOriginChannel, formatSessionListing } from "../shared";
```

## SessionManager Integration
Commands interact with sessions via `sessionManager`:
- `sessionManager.resolve(nameOrId)` → Session or undefined
- `sessionManager.list(filter)` → Array of sessions
- `sessionManager.findMostRecentSessionForChannel(channelId)` → Session or undefined
- `sessionManager.hasRunningSessionForChannel(channelId)` → boolean
- Session object methods: `sendMessage()`, `interrupt()`, `kill()`, etc.

Refer to `src/session-manager.ts` for complete API.

## Command Registration in index.ts
Commands are registered in the `register()` function in `index.ts`:

```typescript
import { registerClaudeXxxCommand } from "./src/commands/claude-xxx";

// ... in register() ...
registerClaudeXxxCommand(api);
```

## When Adding a New Command
1. Create `src/commands/<command-name>.ts`
2. Export `register<CommandName>Command(api: any)`
3. Call `api.registerCommand({ name, description, acceptsArgs, requireAuth, handler })`
4. Implement handler with full error checking and user guidance
5. Import and call the register function in `index.ts`
6. Consider whether a corresponding tool (`src/tools/`) should exist (most do)

## Relationship Between Commands and Tools
- **Commands** are user-facing slash commands (`/claude`, `/claude_fg`, etc.)
- **Tools** are AI agent callable functions (`claude_launch`, `claude_fg`, etc.)
- Many commands have a corresponding tool with the same functionality
- Tools have stricter parameter validation (via typebox schemas)
- Commands have more user-friendly error messages and multi-mode support

A command often directly calls the sessionManager, while a tool wraps operations for structured AI access.

## Key Pitfalls
- **Do not** throw exceptions; always return error responses
- **Do not** assume sessionManager is initialized; always check
- **Do not** hardcode channel strings; use `resolveOriginChannel(ctx)`
- **Do not** parse arguments manually unless you have good reason (use existing patterns)
- **Do not** forget to return a response object; handlers must always return `{ text: string }`
- **Do not** break the naming convention: `register<CommandName>Command`
- **Do not** make commands require authentication to privileged operations; rely on `requireAuth: true` and OpenClaw's sender validation
