import { sessionManager, resolveOriginChannel, formatDuration } from "../shared";

export function registerClaudeResumeCommand(api: any): void {
  api.registerCommand({
    name: "claude_resume",
    description:
      "Resume a previous Claude Code session. Usage: /claude_resume [id-or-name] [prompt] | --fork [id-or-name] [prompt] | --list",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      let args = (ctx.args ?? "").trim();

      // Handle --list flag
      if (args === "--list" || args === "-l") {
        const persisted = sessionManager.listPersistedSessions();
        if (persisted.length === 0) {
          return { text: "No resumable sessions found. Sessions are persisted after completion." };
        }

        const lines = persisted.map((info) => {
          const promptSummary =
            info.prompt.length > 60
              ? info.prompt.slice(0, 60) + "..."
              : info.prompt;
          const completedStr = info.completedAt
            ? `completed ${formatDuration(Date.now() - info.completedAt)} ago`
            : info.status;
          return [
            `  ${info.name} — ${completedStr}`,
            `    Claude ID: ${info.claudeSessionId}`,
            `    📁 ${info.workdir}`,
            `    📝 "${promptSummary}"`,
          ].join("\n");
        });

        return {
          text: `Resumable sessions:\n\n${lines.join("\n\n")}`,
        };
      }

      const config = ctx.config ?? {};
      const channelId = resolveOriginChannel(ctx);

      // Handle --fork flag
      let fork = false;
      if (args.startsWith("--fork ")) {
        fork = true;
        args = args.slice("--fork ".length).trim();
      }

      // Determine session ref and prompt
      let ref: string;
      let prompt: string;

      if (!args) {
        // No args: auto-resume the most recent session in this channel
        const recentSession = sessionManager.findMostRecentPersistedSessionForChannel(channelId);
        if (!recentSession) {
          return {
            text: [
              "No resumable session in this channel.",
              "",
              "Usage:",
              "  /claude_resume [prompt]                 Resume most recent session",
              "  /claude_resume <id-or-name> [prompt]    Resume specific session",
              "  /claude_resume --fork <id-or-name> [prompt] — fork instead of continuing",
              "  /claude_resume --list                   List resumable sessions",
            ].join("\n"),
          };
        }
        ref = recentSession.name;
        prompt = "Continue where you left off.";
      } else {
        // Try to parse first word as session ref
        const spaceIdx = args.indexOf(" ");
        const firstWord = spaceIdx === -1 ? args : args.slice(0, spaceIdx);
        const rest = spaceIdx === -1 ? "" : args.slice(spaceIdx + 1).trim();

        // Check if first word resolves to a persisted session (not active session)
        const testPersisted = sessionManager.getPersistedSession(firstWord);
        if (testPersisted) {
          // First word is a valid persisted session ref
          ref = firstWord;
          prompt = rest || "Continue where you left off.";
        } else {
          // First word is not a session ref, treat entire args as prompt
          const recentSession = sessionManager.findMostRecentPersistedSessionForChannel(channelId);
          if (!recentSession) {
            return {
              text: [
                "No resumable session in this channel.",
                "",
                "Usage:",
                "  /claude_resume [prompt]                 Resume most recent session",
                "  /claude_resume <id-or-name> [prompt]    Resume specific session",
                "  /claude_resume --fork <id-or-name> [prompt] — fork instead of continuing",
                "  /claude_resume --list                   List resumable sessions",
              ].join("\n"),
            };
          }
          ref = recentSession.name;
          prompt = args;
        }
      }

      // Resolve the Claude session ID
      const claudeSessionId = sessionManager.resolveClaudeSessionId(ref);
      if (!claudeSessionId) {
        return {
          text: `Error: Could not find a Claude session ID for "${ref}".\nUse /claude_resume --list to see available sessions.`,
        };
      }

      // Look up persisted info for workdir
      const persisted = sessionManager.getPersistedSession(ref);
      const workdir = persisted?.workdir ?? process.cwd();

      try {
        const session = sessionManager.spawn({
          prompt,
          workdir,
          model: persisted?.model ?? config.defaultModel,
          maxBudgetUsd: config.defaultBudgetUsd ?? 5,
          resumeSessionId: claudeSessionId,
          forkSession: fork,
          originChannel: channelId,
        });

        const promptSummary =
          prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt;

        return {
          text: [
            `Session resumed${fork ? " (forked)" : ""}.`,
            `  Name: ${session.name}`,
            `  ID: ${session.id}`,
            `  Resume from: ${claudeSessionId}`,
            `  Dir: ${workdir}`,
            `  Prompt: "${promptSummary}"`,
          ].join("\n"),
        };
      } catch (err: any) {
        return { text: `Error: ${err.message}` };
      }
    },
  });
}
