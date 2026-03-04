import { sessionManager } from "../shared";

export function registerClaudeRespondCommand(api: any): void {
  api.registerCommand({
    name: "claude_respond",
    description:
      "Send a follow-up message to a running Claude Code session. Usage: /claude_respond <id-or-name> <message> | --interrupt <id-or-name> to stop session (then resume)",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: any) => {
      if (!sessionManager) {
        return {
          text: "Error: SessionManager not initialized. The claude-code service must be running.",
        };
      }

      const args = (ctx.args ?? "").trim();
      if (!args) {
        return {
          text: "Usage: /claude_respond <id-or-name> <message>\n       /claude_respond --interrupt <id-or-name> — stop session (then use /claude_resume to continue)",
        };
      }

      // Parse optional --interrupt flag
      let interrupt = false;
      let remaining = args;
      if (remaining.startsWith("--interrupt ")) {
        interrupt = true;
        remaining = remaining.slice("--interrupt ".length).trim();
      }

      // Parse: first word is the session ref, rest is the message
      const spaceIdx = remaining.indexOf(" ");
      if (spaceIdx === -1) {
        return {
          text: "Error: Missing message. Usage: /claude_respond <id-or-name> <message>",
        };
      }

      const ref = remaining.slice(0, spaceIdx);
      const message = remaining.slice(spaceIdx + 1).trim();

      if (!message) {
        return {
          text: "Error: Empty message. Usage: /claude_respond <id-or-name> <message>",
        };
      }

      const session = sessionManager.resolve(ref);
      if (!session) {
        return { text: `Error: Session "${ref}" not found.` };
      }

      if (session.status !== "running") {
        return {
          text: `Error: Session ${session.name} [${session.id}] is not running (status: ${session.status}).`,
        };
      }

      try {
        if (interrupt) {
          // SIGINT kills the CLI process — we cannot write to stdin afterwards.
          // Interrupt first, then instruct the user to resume with their message.
          await session.interrupt();
          const resumeHint = `/claude_resume ${ref} ${message}`;
          return {
            text: [
              `⏹️ Interrupted session ${session.name} [${session.id}].`,
              ``,
              `The session has been stopped (SIGINT). To continue with your message, run:`,
              resumeHint,
            ].join("\n"),
          };
        }

        await session.sendMessage(message);

        // Reset auto-respond counter (user-initiated)
        session.resetAutoRespond();

        // Level 1: Send 💬 Responded notification to Telegram
        if (sessionManager) {
          const respondMsg = [
            `💬 [${session.name}] Responded:`,
            message.length > 200 ? message.slice(0, 200) + "..." : message,
          ].join("\n");
          sessionManager.deliverToTelegram(session, respondMsg, "responded");
        }

        const msgSummary =
          message.length > 80 ? message.slice(0, 80) + "..." : message;

        return {
          text: [
            `Message sent to ${session.name} [${session.id}].`,
            interrupt ? `  (interrupted current turn)` : "",
            `  "${msgSummary}"`,
          ]
            .filter(Boolean)
            .join("\n"),
        };
      } catch (err: any) {
        return { text: `Error: ${err.message}` };
      }
    },
  });
}
