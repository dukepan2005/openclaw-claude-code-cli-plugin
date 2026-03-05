# Tools Development Instructions

This document guides implementation of OpenClaw tools in `src/tools/`.

## Pattern Overview

Every tool follows the **factory function pattern**: export `make<ToolName>Tool(ctx?: OpenClawPluginToolContext)` that returns a tool object.

```typescript
export function makeClaudeXxxTool(ctx?: OpenClawPluginToolContext) {
  // Setup channel/context from factory context
  // Return tool object: { name, description, parameters, execute }
}
```

## Required Structure

### 1. Factory Function Signature
```typescript
export function make<ToolName>Tool(ctx?: OpenClawPluginToolContext) {
  // optional ctx: { agentId, workspaceDir, messageChannel, agentAccountId, sandboxed, sessionKey }
  return { name, description, parameters, execute }
}
```

### 2. Parameter Schema (using `@sinclair/typebox`)
- Import `Type` from `"@sinclair/typebox"`
- Define `parameters: Type.Object({ ... })` with required and optional fields
- Each field must have a meaningful `description`
- Use `Type.Optional()` for optional parameters
- Leverage `Type.Union()`, `Type.Literal()` for constrained options

**Example**:
```typescript
parameters: Type.Object({
  session: Type.String({ description: "Session name or ID" }),
  interrupt: Type.Optional(Type.Boolean({ description: "..." })),
})
```

### 3. Channel Resolution
When a tool needs to notify or route back to a channel, use the `resolveToolContextChannel()` helper from `src/shared.ts`:

```typescript
import { resolveToolContextChannel } from "../shared";

export function makeClaudeXxxTool(ctx?: OpenClawPluginToolContext) {
  const channel = resolveToolContextChannel(ctx);
  // channel is now "telegram|account|chat-id" or undefined

  return {
    name: "claude_xxx",
    // ... parameters ...
    async execute(_id: string, params: any) {
      if (channel) {
        // Send notification to channel
        notificationRouter?.notify(channel, ...);
      }
    }
  };
}
```

**Resolution priority** (automatic, no manual handling needed):
1. `ctx.messageChannel` + `ctx.agentAccountId` (inject account into channel string)
2. `agentChannels` config lookup via `ctx.workspaceDir`
3. `ctx.messageChannel` as-is (if it already contains `|`)
4. `undefined` (no routing info available)

### 4. Execute Function
```typescript
async execute(_id: string, params: any): Promise<ToolResponse> {
  // Always check sessionManager initialization
  if (!sessionManager) {
    return { content: [{ type: "text", text: "Error: SessionManager not initialized..." }] };
  }

  // Resolve session if needed
  const session = sessionManager.resolve(params.session);
  if (!session) {
    return { content: [{ type: "text", text: `Error: Session "${params.session}" not found.` }] };
  }

  // Validate state if needed (e.g., session.status !== "running")
  // ... implementation ...

  // Return response with consistent structure
  return { content: [{ type: "text", text: "..." }] };
}
```

### 5. Return Format
All tools return:
```typescript
{
  content: [
    { type: "text", text: string },
    // Optional additional content objects
  ]
}
```

## Error Handling
- Check `sessionManager` existence before use
- Use session resolution (`sessionManager.resolve(nameOrId)`) rather than direct lookups
- Provide actionable error messages that state the problem and next step
- Return error in the same content format, no exceptions

**Pattern**:
```typescript
return {
  content: [
    {
      type: "text",
      text: `Error: <problem>. <suggestion>.`
    }
  ]
};
```

## Console Logging
Use tool-name prefixed logs for debugging:
```typescript
console.log(`[<tool-name>] <message>`);
```

## Tool Registration
Tools are registered in `index.ts` using the factory pattern:
```typescript
api.registerTool((ctx) => makeClaudeXxxTool(ctx));
```

The plugin automatically provides `ctx` to each factory function.

## Common Imports
Every tool typically imports:
```typescript
import { Type } from "@sinclair/typebox";
import { sessionManager, pluginConfig, resolveToolContextChannel, notificationRouter } from "../shared";
import type { OpenClawPluginToolContext } from "../types";
```

## Session Manager Integration
Tools interact with sessions via `sessionManager`:
- `sessionManager.resolve(nameOrId)` → Session or undefined
- `sessionManager.Sessions()` → Map of all sessions
- Session object has: `id`, `name`, `status`, `workdir`, `output`, etc.

Refer to `src/session-manager.ts` for full API.

## When Adding a New Tool
1. Create `src/tools/<tool-name>.ts`
2. Follow the factory pattern exactly
3. Use `@sinclair/typebox` for parameters
4. Handle channels via the priority chain above
5. Return consistent error format
6. Import and register in `index.ts`
7. Add corresponding command or RPC method if user-facing

## Key Pitfalls
- **Do not** break the factory pattern; always export `make<Name>Tool(ctx?)`
- **Do not** use dynamic imports or top-level async code
- **Do not** throw exceptions; return error content instead
- **Do not** hardcode channel strings; use `resolveToolContextChannel(ctx)` helper
- **Do not** assume sessionManager is initialized; always check
- **Do not** mutate context; use it for read-only setup

## Suggested Next Steps
While new tools should use `resolveToolContextChannel()` immediately, existing tools in `src/tools/` still contain inline channel-resolution logic. Consider a follow-up refactoring pass to consolidate them:

1. Update `src/tools/claude-fg.ts` to use `resolveToolContextChannel(ctx)`
2. Update `src/tools/claude-bg.ts` to use `resolveToolContextChannel(ctx)`
3. Update `src/tools/claude-respond.ts` to use `resolveToolContextChannel(ctx)`
4. Update other tools as needed

This will reduce duplication and make the pattern clearer to future maintainers.
