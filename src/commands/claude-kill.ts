import { sessionManager, resolveOriginChannel } from "../shared";

export function registerClaudeKillCommand(api: any): void {
  api.registerCommand({
    name: "claude_kill",
    description: "Kill Claude Code session(s). Usage: /claude_kill [name-or-id] | -all (kill all sessions)",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      const args = ctx.args?.trim() || "";

      // Handle -all flag to kill all sessions
      if (args === "-all" || args === "--all") {
        const running = sessionManager.list("running");
        if (running.length === 0) {
          return { text: "No running sessions to kill." };
        }
        const count = running.length;
        sessionManager.killAll();
        return { text: `Killed ${count} session(s).` };
      }

      let session;
      if (!args) {
        // No argument: kill the current channel's most recent running session
        const channelId = resolveOriginChannel(ctx);
        session = sessionManager.findMostRecentSessionForChannel(channelId);
        if (!session) {
          return { text: "No active session in this channel. Use /claude_sessions to see all sessions." };
        }
      } else {
        session = sessionManager.resolve(args);
        if (!session) {
          return { text: `Error: Session "${args}" not found.` };
        }
      }

      if (
        session.status === "completed" ||
        session.status === "failed" ||
        session.status === "killed"
      ) {
        return {
          text: `Session ${session.name} [${session.id}] is already ${session.status}. No action needed.`,
        };
      }

      sessionManager.kill(session.id);

      return { text: `Session ${session.name} [${session.id}] has been terminated.` };
    },
  });
}
