import { sessionManager, resolveOriginChannel } from "../shared";

/**
 * /claude_esc [name-or-id] or /c_esc [name-or-id]
 *
 * Interrupt the current Claude Code response by sending ESC character.
 * If no argument provided, defaults to the last active session in the current channel.
 *
 * This is useful when you want to stop Claude mid-response and provide new instructions.
 */
export function registerClaudeInterruptCommand(api: any): void {
  const handler = async (ctx: any) => {
    if (!sessionManager) {
      return {
        text: "Error: SessionManager not initialized. The claude-code service must be running.",
      };
    }

    const ref = ctx.args?.trim();
    let session;

    if (!ref) {
      // Default to last active session in current channel
      const channelId = resolveOriginChannel(ctx);
      session = sessionManager.findMostRecentSessionForChannel(channelId);
      if (!session) {
        return {
          text: [
            "No active session in this channel.",
            "",
            "To interrupt a session: /c_esc [name-or-id]",
            "Use /claude_sessions to list all sessions.",
          ].join("\n"),
        };
      }
    } else {
      session = sessionManager.resolve(ref);
      if (!session) {
        return { text: `Error: Session "${ref}" not found.` };
      }
    }

    // Check if session is running
    if (session.status !== "running") {
      return {
        text: `Session ${session.name} [${session.id}] is not running (status: ${session.status}).`,
      };
    }

    try {
      await session.interrupt();
      return {
        text: `⏹️ Interrupted ${session.name} [${session.id}]\n\nUse /claude <message> to send new instructions.`,
      };
    } catch (err: any) {
      return { text: `Error: ${err.message}` };
    }
  };

  // Register as claude_esc
  api.registerCommand({
    name: "claude_esc",
    description: "Send ESC to interrupt Claude. Usage: /claude_esc [name-or-id]",
    acceptsArgs: true,
    requireAuth: true,
    handler,
  });

  // Register short alias as c_esc
  api.registerCommand({
    name: "c_esc",
    description: "Send ESC to interrupt Claude (short alias). Usage: /c_esc [name-or-id]",
    acceptsArgs: true,
    requireAuth: true,
    handler,
  });
}
