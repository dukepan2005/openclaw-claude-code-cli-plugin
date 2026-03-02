import { sessionManager, resolveOriginChannel } from "../shared";

/**
 * /claude_watch <name-or-id>
 *
 * Subscribe to a session's real-time output without showing catchup.
 * Unlike /claude_fg which displays missed output, this command silently
 * starts streaming future output to the current channel.
 *
 * This is useful when you want to monitor a background session without
 * cluttering the chat with past output.
 */
export function registerClaudeWatchCommand(api: any): void {
  api.registerCommand({
    name: "claude_watch",
    description: "Subscribe to a session's real-time output (no catchup)",
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
        return { text: "Usage: /claude_watch <name-or-id>" };
      }

      const session = sessionManager.resolve(ref);
      if (!session) {
        return { text: `Error: Session "${ref}" not found.` };
      }

      const channelId = resolveOriginChannel(ctx);

      // Check if already watching
      if (session.foregroundChannels.has(channelId)) {
        return { text: `Already watching ${session.name} [${session.id}]` };
      }

      // Add to foreground channels - this enables real-time streaming
      session.foregroundChannels.add(channelId);

      // Do NOT call markFgOutputSeen - user doesn't want catchup
      // Future output will be streamed, past output is ignored

      const statusEmoji = session.status === "running" ? "▶️" :
                          session.status === "starting" ? "⏳" : "⏹️";

      return {
        text: `${statusEmoji} Now watching ${session.name} [${session.id}] (${session.status})`,
      };
    },
  });
}
