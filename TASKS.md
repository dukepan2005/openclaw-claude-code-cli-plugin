# OpenClaw Claude Code Plugin - Task List

---

## Bug Fix Branch: `fix/session-lifecycle-bugs`

> 代码审查（2026-03-04）发现的 Session 生命周期 Bug，需逐一修复。

---

### Bug 1 — idle 超时杀死 Session 完全无通知 🔴 关键

**文件**: `src/session-cli.ts` — `resetIdleTimer()`  
**状态**: `[x] 已修复`

**问题描述**:  
多轮 Session 的 idle 超时 timer 直接调用 `this.kill()`（`Session.kill()`），而该方法只设置 `status = 'killed'`，不触发任何回调。`process.on('exit')` 发现 status 已非 `starting|running`，跳过 `onComplete`。

**后果**:
- `persistSession()` 未执行 → Session 无法 resume
- `recordSessionMetrics()` 未执行 → 统计数据缺失
- `triggerAgentEvent()` 未执行 → 用户完全不知道 Session 已被超时杀死
- `notificationRouter.onSessionComplete()` 未执行 → 无 Telegram 通知

**根因**:  
`Session.kill()` 本身不调用 `onComplete`，设计上由 `SessionManager.kill()` 显式处理。但 idle timer 绕过了 SessionManager，直接调用了 Session 内部方法。

**解决方案**:  
在 `Session` 内保存一个 `onKilled?: () => void` 回调，或在 `Session.kill()` 末尾调用 `this.onComplete?.(this)`；推荐方案是让 idle timer 改为发布一个 `onIdleTimeout` 事件，由 SessionManager 订阅并走 `SessionManager.kill(id)` 完整路径。

---

### Bug 2 — `start()` 早期失败不调 `onComplete` 🔴 关键

**文件**: `src/session-cli.ts` — `start()` 方法  
**状态**: `[x] 已修复`

**问题描述**:  
`start()` 中存在多个早退路径（workdir 不存在、workdir 不是目录、catch 块），均只设置 `status = 'failed'` 后 `return`，没有调用 `this.onComplete?.(this)`。`process.on('error')` 也有同样问题（`claude` 不在 PATH 时只赋 `this.error`，未调 `onComplete`）。

**后果**:  
- 用户在 Telegram 收到「🚀 Launched」后，再也等不到任何后续消息
- Session 停留在 `failed` 状态，无法被自动 GC 通知路径处理
- SessionManager 从不知道有 Session 失败了

**根因**:  
`session.start()` 在 `SessionManager.spawn()` 中是未 await 的 fire-and-forget 调用，早退路径缺少回调。

**解决方案**:  
在每个早退路径的 `return` 前加 `this.onComplete?.(this)`。  
同时在 `process.on('error')` 中也补加 `this.onComplete?.(this)`。

---

### Bug 3 — 单轮模式 (`multiTurn: false`) 进程挂死 🟡 中等

**文件**: `src/session-cli.ts` — `start()` 方法  
**状态**: `[x] 已修复`

**问题描述**:  
`--input-format stream-json` 无条件追加到 CLI args，但 `sendInitialPrompt()` 只在 `multiTurn === true` 时调用：

```typescript
if (this.multiTurn) {
  this.sendInitialPrompt();
}
```

当 `multiTurn: false` 时，CLI 以 stream-json 输入模式启动后等待 stdin 输入，但永远收不到任何内容，进程永久挂起，Session 卡死在 `starting` 状态。

**根因**:  
`multiTurn: false` 的设计意图是"单轮执行后退出"，但 stdin 需要关闭才能触发 CLI 执行。

**解决方案**:  
对 `multiTurn: false` 的 Session，在 spawn 后立即发送 prompt 并关闭 stdin（`process.stdin.end()`），让 CLI 完成单轮后正常退出。或直接不传 `--input-format stream-json`，改为通过 CLI 参数传递初始 prompt。

---

### Bug 4 — startup 阶段无超时保护 🟡 中等

**文件**: `src/session-cli.ts` — `start()` 方法  
**状态**: `[x] 已修复`

**问题描述**:  
safety-net timer 和 idle timer 均在 `handleMessage()` 被第一次调用后才启动。若 `claude` CLI 启动后完全没有任何 stdout 输出（如认证弹窗、网络超时、进程僵死），Session 永远停留在 `starting` 状态，没有任何超时机制触发。

**后果**:  
- Session 卡死，占用 maxSessions 名额
- 用户无法收到任何通知或错误反馈
- 若不手动 `/claude_kill`，该 Session 永远不会自动清理

**解决方案**:  
在 `start()` 中 spawn 进程后，启动一个 **startup timeout timer**（建议 60 秒），若 Session 仍处于 `starting` 状态则自动 kill 并通知用户。在收到 `init` 消息（`status` 切换为 `running`）时取消该 timer。

---

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
