import { sessionManager, resolveOriginChannel } from "../shared";

/**
 * /claude_unwatch [name-or-id]
 *
 * Unsubscribe from a session's real-time output.
 * If no argument provided, defaults to the last active session in the current channel.
 */
export function registerClaudeUnwatchCommand(api: any): void {
  api.registerCommand({
    name: "claude_unwatch",
    description: "Unsubscribe from a session's real-time output. Usage: /claude_unwatch [name-or-id]",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx: any) => {
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
              "To unwatch a session: /claude_unwatch <name-or-id>",
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

      const channelId = resolveOriginChannel(ctx);

      // Check if actually watching
      if (!session.foregroundChannels.has(channelId)) {
        return { text: `Not watching ${session.name} [${session.id}]` };
      }

      // Remove from foreground channels
      session.foregroundChannels.delete(channelId);

      // Save the current output position for potential catchup later
      session.saveFgOutputOffset(channelId);

      return {
        text: `👋 Stopped watching ${session.name} [${session.id}]`,
      };
    },
  });
}
