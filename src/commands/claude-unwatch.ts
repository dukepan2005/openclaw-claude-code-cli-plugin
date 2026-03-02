import { sessionManager, resolveOriginChannel } from "../shared";

/**
 * /claude_unwatch <name-or-id>
 *
 * Unsubscribe from a session's real-time output.
 * Stops streaming output to the current channel.
 */
export function registerClaudeUnwatchCommand(api: any): void {
  api.registerCommand({
    name: "claude_unwatch",
    description: "Unsubscribe from a session's real-time output",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      const ref = ctx.args?.trim();
      if (!ref) {
        return { text: "Usage: /claude_unwatch <name-or-id>" };
      }

      const session = sessionManager.resolve(ref);
      if (!session) {
        return { text: `Error: Session "${ref}" not found.` };
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
