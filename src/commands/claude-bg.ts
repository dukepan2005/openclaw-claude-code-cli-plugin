import { sessionManager, resolveOriginChannel } from "../shared";

export function registerClaudeBgCommand(api: any): void {
  api.registerCommand({
    name: "claude_bg",
    description: "Send a foreground session to background. Usage: /claude_bg [name-or-id]",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      const channelId = resolveOriginChannel(ctx);
      const ref = ctx.args?.trim();
      let session;

      if (!ref) {
        // Default to last active session in current channel
        session = sessionManager.findMostRecentSessionForChannel(channelId);
        if (!session) {
          return {
            text: [
              "No active session in this channel.",
              "",
              "To send a session to background: /claude_bg <name-or-id>",
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

      // Check if actually in foreground
      if (!session.foregroundChannels.has(channelId)) {
        return { text: `Session ${session.name} [${session.id}] is not in foreground.` };
      }

      session.saveFgOutputOffset(channelId);
      session.foregroundChannels.delete(channelId);
      return {
        text: `Session ${session.name} [${session.id}] moved to background.`,
      };
    },
  });
}
