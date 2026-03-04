import { spawn, ChildProcess } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import type { SessionConfig, SessionStatus, PermissionMode } from './types';
import { pluginConfig } from './shared';
import { nanoid } from 'nanoid';

const OUTPUT_BUFFER_MAX = 200;

/**
 * Session class using Claude Code CLI (via child_process) instead of SDK.
 * Supports:
 * - Multi-turn conversations via --input-format=stream-json
 * - Interrupt via ESC character (\x1B)
 * - Stream-json output parsing for event tracking
 * - Uses Claude Code CLI's own configuration for API endpoint and keys
 */
export class Session {
  readonly id: string;
  name: string;
  claudeSessionId?: string;

  // Config
  readonly prompt: string;
  readonly workdir: string;
  readonly model?: string;
  readonly maxBudgetUsd: number;
  private readonly systemPrompt?: string;
  private readonly allowedTools?: string[];
  private readonly permissionMode: PermissionMode;

  // Resume/fork config
  readonly resumeSessionId?: string;
  readonly forkSession?: boolean;

  // Multi-turn config
  readonly multiTurn: boolean;
  private process?: ChildProcess;

  // Safety-net idle timer: fires only if NO messages (text, tool_use, result) arrive
  // for 15 seconds. The primary "waiting for input" signal is the multi-turn
  // end-of-turn result handler — this timer is a rare fallback for edge cases
  // (e.g. Claude stuck waiting for permission/clarification without a result event).
  private safetyNetTimer?: ReturnType<typeof setTimeout>;
  private static readonly SAFETY_NET_IDLE_MS = 15_000;

  // Startup timeout: fires if no init message arrives within 60s after spawn.
  // Guards against CLI hangs (auth dialogs, network issues, PATH errors that
  // bypass spawn error events, etc.).
  private startupTimer?: ReturnType<typeof setTimeout>;
  private static readonly STARTUP_TIMEOUT_MS = 60_000;

  // State
  status: SessionStatus = 'starting';
  error?: string;
  startedAt: number;
  completedAt?: number;

  // Activity tracking for auto-routing
  lastActivityAt: number = Date.now();

  // Output
  outputBuffer: string[] = [];

  // Stderr buffer for error diagnostics
  private stderrBuffer: string[] = [];

  // Result from CLI
  result?: {
    subtype: string;
    duration_ms: number;
    total_cost_usd: number;
    num_turns: number;
    result?: string;
    is_error: boolean;
    session_id: string;
  };

  // Cost tracking
  costUsd: number = 0;

  // Foreground channels
  foregroundChannels: Set<string> = new Set();

  // Per-channel output offset: tracks the outputBuffer index last seen while foregrounded.
  // Used by claude_fg to send "catchup" of missed output when re-foregrounding.
  private fgOutputOffsets: Map<string, number> = new Map();

  // Origin channel -- the channel that launched this session (for background notifications)
  originChannel?: string;

  // Origin agent ID -- the agent that launched this session (for targeted wake events)
  readonly originAgentId?: string;

  // Flags
  budgetExhausted: boolean = false;
  private waitingForInputFired: boolean = false;

  /** True if session is waiting for user input (after end-of-turn) */
  get isWaitingForInput(): boolean {
    return this.status === 'running' && this.waitingForInputFired;
  }

  // Auto-respond safety cap: tracks consecutive agent-initiated responds
  autoRespondCount: number = 0;

  // Event callbacks
  onOutput?: (text: string) => void;
  onToolUse?: (toolName: string, toolInput: any) => void;
  onBudgetExhausted?: (session: Session) => void;
  onComplete?: (session: Session) => void;
  onWaitingForInput?: (session: Session) => void;
  /**
   * Fired when the idle timer expires (multi-turn session received no follow-up
   * within idleTimeoutMinutes). SessionManager subscribes to this and calls
   * SessionManager.kill(id) so the full lifecycle path runs (persistence,
   * metrics, notifications).
   */
  onIdleTimeout?: (session: Session) => void;

  // Idle timer for multi-turn sessions
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor(config: SessionConfig, name: string) {
    this.id = nanoid(8);
    this.name = name;
    this.prompt = config.prompt;
    this.workdir = config.workdir;
    this.model = config.model;
    this.maxBudgetUsd = config.maxBudgetUsd;
    this.systemPrompt = config.systemPrompt;
    this.allowedTools = config.allowedTools;
    this.permissionMode = config.permissionMode ?? pluginConfig.permissionMode ?? 'bypassPermissions';
    this.originChannel = config.originChannel;
    this.originAgentId = config.originAgentId;
    this.resumeSessionId = config.resumeSessionId;
    this.forkSession = config.forkSession;
    this.multiTurn = config.multiTurn ?? true;
    this.startedAt = Date.now();
  }

  async start(): Promise<void> {
    try {
      // Validate workdir
      if (!existsSync(this.workdir)) {
        this.status = 'failed';
        this.error = `Working directory does not exist: ${this.workdir}`;
        this.completedAt = Date.now();
        console.error(`[Session ${this.id}] ${this.error}`);
        this.onComplete?.(this);
        return;
      }
      if (!statSync(this.workdir).isDirectory()) {
        this.status = 'failed';
        this.error = `Working directory is not a directory: ${this.workdir}`;
        this.completedAt = Date.now();
        console.error(`[Session ${this.id}] ${this.error}`);
        this.onComplete?.(this);
        return;
      }
      // Warn if workdir is root (likely a misconfiguration)
      if (this.workdir === '/' || this.workdir === process.cwd()) {
        console.warn(`[Session ${this.id}] Warning: workdir is "${this.workdir}" — this may not be a valid project directory. Consider setting defaultWorkdir in plugin config.`);
      }

      // Build CLI arguments
      const args = [
        '--print',
        '--verbose',  // Required for --output-format=stream-json
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '--input-format', 'stream-json',  // Enable multi-turn via stdin
        '--model', this.model || 'sonnet',
        '--max-budget-usd', String(this.maxBudgetUsd),
        '--permission-mode', this.permissionMode,
      ];

      // Add optional parameters
      if (this.allowedTools && this.allowedTools.length > 0) {
        args.push('--allowedTools', this.allowedTools.join(','));
      }

      if (this.systemPrompt) {
        args.push('--system-prompt', this.systemPrompt);
      }

      if (this.resumeSessionId) {
        args.push('--resume', this.resumeSessionId);
        if (this.forkSession) {
          args.push('--fork-session');
        }
      }

      // Spawn the CLI process
      this.process = spawn('claude', args, {
        cwd: this.workdir,
        env: process.env,  // Use parent environment (includes Claude Code CLI config)
        // Use buffer mode to handle binary data if needed
        encoding: 'buffer',
      });

      // Setup stdout handler for parsing output
      this.process.stdout?.on('data', (data: Buffer) => {
        this.parseOutput(data.toString('utf-8'));
      });

      // Setup stderr handler (for debugging and error capture)
      this.process.stderr?.on('data', (data: Buffer) => {
        const stderrText = data.toString('utf-8');
        console.error(`[Session ${this.id} stderr]:`, stderrText);
        // Buffer stderr for error reporting
        this.stderrBuffer.push(stderrText);
        if (this.stderrBuffer.length > 20) {
          this.stderrBuffer.shift();
        }
      });

      // Handle process exit
      this.process.on('exit', (code: number | null) => {
        if (this.status === 'starting' || this.status === 'running') {
          this.status = code === 0 ? 'completed' : 'failed';
          this.completedAt = Date.now();
          this.clearSafetyNetTimer();
          if (this.startupTimer) { clearTimeout(this.startupTimer); this.startupTimer = undefined; }
          if (this.idleTimer) clearTimeout(this.idleTimer);

          // Capture stderr as error message if process failed
          if (code !== 0 && !this.error && this.stderrBuffer.length > 0) {
            this.error = this.stderrBuffer.join('\n').trim().slice(-500);
          }

          if (this.onComplete) {
            this.onComplete(this);
          }
        }
      });

      // Handle process errors
      this.process.on('error', (err: Error) => {
        console.error(`[Session ${this.id} process error]:`, err);
        if (this.status === 'starting' || this.status === 'running') {
          this.status = 'failed';
          // Provide more helpful error message for common cases
          if (err.message.includes('ENOENT')) {
            this.error = `claude CLI not found. Please ensure Claude Code CLI is installed and in PATH.`;
          } else {
            this.error = err.message;
          }
          this.completedAt = Date.now();
          this.clearSafetyNetTimer();
          if (this.idleTimer) clearTimeout(this.idleTimer);
          this.onComplete?.(this);
        }
      });

      // Always send initial prompt via stdin (required by --input-format stream-json)
      this.sendInitialPrompt();

      // For single-turn sessions, close stdin immediately after sending the prompt.
      // This signals the CLI that no further input is coming, so it can execute
      // and exit cleanly instead of hanging forever waiting for more stdin data.
      if (!this.multiTurn && this.process?.stdin) {
        this.process.stdin.end();
      }

      // Start the startup timeout timer — cancelled when the init message arrives.
      // If the CLI never sends an init event (auth hang, network issue, etc.),
      // we kill the session and notify the user.
      this.startupTimer = setTimeout(() => {
        this.startupTimer = undefined;
        if (this.status === 'starting') {
          console.error(`[Session ${this.id}] Startup timeout (${Session.STARTUP_TIMEOUT_MS / 1000}s): no init message received — killing`);
          this.status = 'failed';
          this.error = `Session startup timed out after ${Session.STARTUP_TIMEOUT_MS / 1000}s. The claude CLI may be hanging (check auth, network, or PATH).`;
          this.completedAt = Date.now();
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          this.onComplete?.(this);
        }
      }, Session.STARTUP_TIMEOUT_MS);

    } catch (err: any) {
      this.status = 'failed';
      this.error = err?.message ?? String(err);
      this.completedAt = Date.now();
      this.onComplete?.(this);
    }
  }

  /**
   * Send the initial prompt to the CLI via stdin
   */
  private sendInitialPrompt(): void {
    if (!this.process || !this.process.stdin) return;

    const initialMsg = {
      type: 'user',
      message: {
        role: 'user',
        content: this.prompt
      },
      parent_tool_use_id: null,
      session_id: ''  // Will be set after init message
    };

    try {
      this.process.stdin.write(JSON.stringify(initialMsg) + '\n');
    } catch (err) {
      console.error(`[Session ${this.id}] Failed to send initial prompt:`, err);
    }
  }

  /**
   * Parse stream-json output from the CLI
   */
  private parseOutput(data: string): void {
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch (err) {
        // Not a JSON line, might be debug output or partial data
        // Ignore non-JSON output
      }
    }
  }

  /**
   * Handle a single message from the CLI
   */
  private handleMessage(msg: any): void {
    // Update activity timestamp for auto-routing
    this.lastActivityAt = Date.now();
    // Reset the safety-net timer on every incoming message
    this.resetSafetyNetTimer();

    if (msg.type === 'system' && msg.subtype === 'init') {
      this.claudeSessionId = msg.session_id;
      this.status = 'running';
      // Cancel the startup timeout — CLI is alive and running
      if (this.startupTimer) {
        clearTimeout(this.startupTimer);
        this.startupTimer = undefined;
      }
      this.resetIdleTimer();
    }
    else if (msg.type === 'assistant') {
      this.waitingForInputFired = false;
      const contentBlocks = msg.message?.content ?? [];
      console.log(`[Session] ${this.id} assistant message received, blocks=${contentBlocks.length}, fgChannels=${JSON.stringify([...this.foregroundChannels])}`);

      for (const block of contentBlocks) {
        if (block.type === 'text') {
          const text: string = block.text;
          this.outputBuffer.push(text);
          if (this.outputBuffer.length > OUTPUT_BUFFER_MAX) {
            this.outputBuffer.splice(
              0,
              this.outputBuffer.length - OUTPUT_BUFFER_MAX
            );
          }
          if (this.onOutput) {
            console.log(`[Session] ${this.id} calling onOutput, textLen=${text.length}`);
            this.onOutput(text);
          } else {
            console.log(`[Session] ${this.id} onOutput callback NOT set`);
          }
        } else if (block.type === 'tool_use') {
          // Emit tool_use event for compact foreground display
          if (this.onToolUse) {
            console.log(`[Session] ${this.id} calling onToolUse, tool=${block.name}`);
            this.onToolUse(block.name, block.input);
          } else {
            console.log(`[Session] ${this.id} onToolUse callback NOT set`);
          }
        }
      }
    }
    else if (msg.type === 'result') {
      this.result = {
        subtype: msg.subtype,
        duration_ms: msg.duration_ms,
        total_cost_usd: msg.total_cost_usd,
        num_turns: msg.num_turns,
        result: msg.result,
        is_error: msg.is_error,
        session_id: msg.session_id,
      };
      this.costUsd = msg.total_cost_usd;

      // In multi-turn mode, a "success" result means end-of-turn, not end-of-session.
      // The session stays running so the user can send follow-up messages.
      // Only close on errors (budget exhaustion, actual failures, etc.).
      const isMultiTurnEndOfTurn = this.multiTurn && msg.subtype === 'success';

      if (isMultiTurnEndOfTurn) {
        // Keep session alive — just update cost and result, stay in "running" status
        console.log(`[Session] ${this.id} multi-turn end-of-turn (turn ${msg.num_turns}), staying open`);
        this.clearSafetyNetTimer();
        this.resetIdleTimer();

        // Notify that the session is now waiting for user input
        if (this.onWaitingForInput && !this.waitingForInputFired) {
          console.log(`[Session] ${this.id} calling onWaitingForInput`);
          this.waitingForInputFired = true;
          this.onWaitingForInput(this);
        }
      } else {
        // Session is truly done — either single-turn, or multi-turn with error/budget
        this.clearSafetyNetTimer();
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.status = msg.subtype === 'success' ? 'completed' : 'failed';
        this.completedAt = Date.now();

        // Detect budget exhaustion
        if (msg.subtype === 'error_max_budget_usd') {
          this.budgetExhausted = true;
          const spent = msg.total_cost_usd?.toFixed(2) ?? 'unknown';
          console.error(`[Session ${this.id}] 💰 Budget exhausted: spent $${spent} of $${this.maxBudgetUsd} limit`);
          if (this.onBudgetExhausted) {
            this.onBudgetExhausted(this);
          }
        }

        if (this.onComplete) {
          console.log(`[Session] ${this.id} calling onComplete, status=${this.status}`);
          this.onComplete(this);
        } else {
          console.log(`[Session] ${this.id} onComplete callback NOT set`);
        }
      }
    }
  }

  /**
   * Reset the safety-net idle timer. Called on EVERY incoming message
   * (text, tool_use, result). If no message of any kind arrives for
   * SAFETY_NET_IDLE_MS (15s), we assume the session is stuck waiting
   * for user input (e.g. a permission prompt without a result event).
   *
   * The primary "waiting for input" signal is the multi-turn end-of-turn
   * result handler — this timer is a rare fallback for edge cases only.
   */
  private resetSafetyNetTimer(): void {
    this.clearSafetyNetTimer();
    this.safetyNetTimer = setTimeout(() => {
      this.safetyNetTimer = undefined;
      if (this.status === 'running' && this.onWaitingForInput && !this.waitingForInputFired) {
        console.log(`[Session] ${this.id} no messages for ${Session.SAFETY_NET_IDLE_MS / 1000}s — firing onWaitingForInput (safety-net)`);
        this.waitingForInputFired = true;
        this.onWaitingForInput(this);
      }
    }, Session.SAFETY_NET_IDLE_MS);
  }

  /**
   * Cancel the safety-net idle timer.
   */
  private clearSafetyNetTimer(): void {
    if (this.safetyNetTimer) {
      clearTimeout(this.safetyNetTimer);
      this.safetyNetTimer = undefined;
    }
  }

  /**
   * Reset (or start) the idle timer for multi-turn sessions.
   * If no sendMessage() call arrives within the configured idle timeout, the
   * session is automatically killed to avoid zombie sessions stuck in "running"
   * forever. Timeout is read from pluginConfig.idleTimeoutMinutes (default 30).
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.multiTurn) return;
    const idleTimeoutMs = (pluginConfig.idleTimeoutMinutes ?? 30) * 60 * 1000;
    this.idleTimer = setTimeout(() => {
      if (this.status === 'running') {
        console.log(`[Session] ${this.id} idle timeout reached (${pluginConfig.idleTimeoutMinutes ?? 30}min), firing onIdleTimeout`);
        if (this.onIdleTimeout) {
          // Delegate to SessionManager.kill() so persistence/metrics/notifications run
          this.onIdleTimeout(this);
        } else {
          // Fallback: direct kill (no SessionManager wired)
          this.kill();
        }
      }
    }, idleTimeoutMs);
  }

  /**
   * Interrupt the current response by sending ESC character.
   * This mimics pressing the ESC key in interactive Claude Code.
   */
  async interrupt(): Promise<void> {
    if (this.status !== 'running' || !this.process?.stdin) {
      return;
    }

    console.log(`[Session] ${this.id} sending ESC (\\x1B) to interrupt current turn`);

    // Send ESC character (ASCII 27, \x1B)
    this.process.stdin.write('\x1B');

    // Wait a bit for the interrupt to take effect
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  /**
   * Send a follow-up message to a running multi-turn session.
   * Writes to the process stdin in stream-json format.
   */
  async sendMessage(text: string, interrupt: boolean = false): Promise<void> {
    if (this.status !== 'running') {
      throw new Error(`Session is not running (status: ${this.status})`);
    }

    if (!this.process?.stdin) {
      throw new Error('Process stdin not available');
    }

    this.lastActivityAt = Date.now();
    this.resetIdleTimer();
    this.waitingForInputFired = false;

    // If interrupt is requested, send ESC first
    if (interrupt) {
      await this.interrupt();
    }

    // Construct stream-json format user message
    const userMsg = {
      type: 'user',
      message: {
        role: 'user',
        content: text
      },
      parent_tool_use_id: null,
      session_id: this.claudeSessionId ?? ''
    };

    try {
      this.process.stdin.write(JSON.stringify(userMsg) + '\n');
    } catch (err) {
      console.error(`[Session] ${this.id} failed to send message:`, err);
      throw err;
    }
  }

  /**
   * Kill the session.
   * First tries Ctrl+C, then forces kill after 2 seconds.
   */
  kill(): void {
    if (this.status !== 'starting' && this.status !== 'running') return;

    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.clearSafetyNetTimer();
    if (this.startupTimer) { clearTimeout(this.startupTimer); this.startupTimer = undefined; }
    this.status = 'killed';
    this.completedAt = Date.now();

    if (this.process) {
      // Try graceful shutdown with Ctrl+C first
      if (this.process.stdin) {
        this.process.stdin.write('\x03');  // Ctrl+C
      }

      // Force kill after 2 seconds if not dead
      const killTimer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log(`[Session] ${this.id} force killing after timeout`);
          this.process.kill('SIGKILL');
        }
      }, 2000);

      // Clear timer if process exits gracefully
      this.process.once('exit', () => clearTimeout(killTimer));
    }
  }

  getOutput(lines?: number): string[] {
    if (lines === undefined) {
      return this.outputBuffer.slice();
    }
    return this.outputBuffer.slice(-lines);
  }

  /**
   * Get all output produced since this channel was last foregrounded (or since launch).
   * Returns the missed output lines. If this is the first time foregrounding,
   * returns the full buffer (same as getOutput()).
   */
  getCatchupOutput(channelId: string): string[] {
    const lastOffset = this.fgOutputOffsets.get(channelId) ?? 0;
    const available = this.outputBuffer.length;
    if (lastOffset >= available) {
      return []; // Already caught up
    }
    return this.outputBuffer.slice(lastOffset);
  }

  /**
   * Record that this channel has seen all current output (call when foregrounding).
   * Sets the offset to the current end of the buffer.
   */
  markFgOutputSeen(channelId: string): void {
    this.fgOutputOffsets.set(channelId, this.outputBuffer.length);
  }

  /**
   * Save the current output position for a channel (call when backgrounding).
   * This records where they left off so catchup can resume from here.
   */
  saveFgOutputOffset(channelId: string): void {
    this.fgOutputOffsets.set(channelId, this.outputBuffer.length);
  }

  /**
   * Increment the auto-respond counter (called on each agent-initiated claude_respond tool call).
   */
  incrementAutoRespond(): void {
    this.autoRespondCount++;
  }

  /**
   * Reset the auto-respond counter (called when the user sends a message via /claude_respond command).
   */
  resetAutoRespond(): void {
    this.autoRespondCount = 0;
  }

  get duration(): number {
    return (this.completedAt ?? Date.now()) - this.startedAt;
  }
}
