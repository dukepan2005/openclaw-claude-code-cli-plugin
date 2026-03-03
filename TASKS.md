# OpenClaw Claude Code Plugin - Task List

## In Progress

### 2026-03-02: Session Output Subscription Feature

**Completed:**
- [x] Add `/claude_watch <session-id>` command - subscribe to real-time output without catchup
- [x] Add `/claude_unwatch <session-id>` command - unsubscribe from session output
- [x] Add message queue to serialize Telegram sends (fix concurrent send failures)

**Pending:**
- [ ] Test `/claude_watch` in Telegram (restart gateway first)
- [ ] Verify message queue fixes the concurrent send failures
- [ ] Check logs: `openclaw logs | grep "queue="`

**Commits:**
- `b381fe0` feat: add claude_watch/claude_unwatch subscription commands
- `c6725cb` fix: add message queue to serialize Telegram sends

**Context:**
- Background sessions don't stream output to Telegram in real-time
- `/claude_watch` allows users to subscribe to a session's output without showing history
- Concurrent message sends were failing with exitCode=1 due to rate limiting
- Message queue serializes sends with 100ms delay between messages

## Future Ideas

- [ ] Add `/claude_status` command to show subscription status
- [ ] Add option to auto-watch sessions launched from same channel
