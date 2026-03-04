import { sessionManager, pluginConfig, resolveOriginChannel } from "../shared";

export function registerClaudeCommand(api: any): void {
  api.registerCommand({
    name: "claude",
    description: "Launch a Claude Code session or respond to active session. Usage: /claude [--name|-n <name>] [--workdir|-C <path>] <prompt>",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      let args = (ctx.args ?? "").trim();

      // Parse optional --name / -n flag
      const hasNameFlag = args.match(/^(?:--name|-n)\s+(\S+)\s+/);

      if (!hasNameFlag) {
        // === MODE 1: Respond to active session ===
        const channelId = resolveOriginChannel(ctx);
        const session = sessionManager.findMostRecentSessionForChannel(channelId);

        if (!session) {
          if (!args) {
            return { text: "No active session. Use `/claude --name <name> <prompt>` to start one." };
          }
          // If user provided args but no --name, they probably wanted to start a session
          // but forgot the --name flag. Give helpful error.
          return {
            text: [
              "No active session in this channel.",
              "",
              "To respond to a session: use `/claude <message>` when a session is running.",
              "To start a new session: use `/claude --name <name> <prompt>`",
            ].join("\n"),
          };
        }

        if (!args) {
          // No message provided, show current session status
          const statusEmoji = session.status === 'running' ? '🟢' : '🟡';
          return {
            text: [
              `${statusEmoji} Active session: ${session.name} [${session.id}]`,
              `   Status: ${session.status}`,
              `   Use: /claude <message> to respond`,
            ].join("\n"),
          };
        }

        // Send message to session
        try {
          await session.sendMessage(args);
          session.resetAutoRespond();
          return { text: `💬 Sent to ${session.name}` };
        } catch (err: any) {
          return { text: `Error: ${err.message}` };
        }
      }

      // === MODE 2: Launch new session ===
      if (!args) {
        return { text: "Usage: /claude --name <name> [--workdir <path>] <prompt>" };
      }

      // Check for existing running session in this channel
      const channelId = resolveOriginChannel(ctx);
      if (sessionManager.hasRunningSessionForChannel(channelId)) {
        return {
          text: [
            "⚠️ This channel already has a running Claude Code session.",
            "",
            "To run multiple sessions simultaneously, use:",
            "- A different chat/group",
            "- A different topic/thread (for Telegram groups with topics)",
            "",
            "Use `/claude_sessions` to see current sessions.",
          ].join("\n"),
        };
      }

      let name: string | undefined;
      const nameMatch = args.match(/^(?:--name|-n)\s+(\S+)\s+/);
      if (nameMatch) {
        name = nameMatch[1];
        args = args.slice(nameMatch[0].length).trim();
      }

      // Parse optional --workdir / -C flag (supports quoted paths with spaces)
      let workdir: string | undefined;
      const workdirMatch = args.match(/^(?:--workdir|-C)\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*/);
      if (workdirMatch) {
        workdir = workdirMatch[1] || workdirMatch[2] || workdirMatch[3];
        args = args.slice(workdirMatch[0].length).trim();
      }

      const prompt = args;
      if (!prompt) {
        return { text: "Usage: /claude --name <name> [--workdir <path>] <prompt>" };
      }

      try {
        const session = sessionManager.spawn({
          prompt,
          name,
          workdir: workdir || pluginConfig.defaultWorkdir || process.cwd(),
          model: pluginConfig.defaultModel,
          maxBudgetUsd: pluginConfig.defaultBudgetUsd ?? 5,
          originChannel: resolveOriginChannel(ctx),
        });

        const promptSummary =
          prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt;

        return {
          text: [
            `Session launched.`,
            `  Name: ${session.name}`,
            `  ID: ${session.id}`,
            `  Prompt: "${promptSummary}"`,
            `  Status: ${session.status}`,
          ].join("\n"),
        };
      } catch (err: any) {
        return { text: `Error: ${err.message}` };
      }
    },
  });
}
