# 安全检查与预启动守卫

当代理调用 `claude_launch` 工具时，在生成任何会话之前会运行 **4 个强制守卫**。如果任何检查失败，启动会被阻止并显示清晰的、可操作的错误消息 —— 代理要么自动修复，要么给你一个可执行的命令。

这些检查仅在 `claude_launch` **工具**（代理调用者）上强制执行。网关 RPC 方法（`claude-code.launch`）和聊天命令（`/claude`）会跳过它们 —— 这些调用者假定已正确配置。

> **真实来源：** `src/tools/claude-launch.ts` (第 143-399 行)

### 跳过安全检查

在插件配置中设置 `skipSafetyChecks: true` 以绕过**所有**预启动守卫。启用时，插件会记录 `[claude-launch] Safety checks skipped (skipSafetyChecks=true)` 并直接进行会话启动。

```json
{
  "skipSafetyChecks": true
}
```

> **警告：** 这会禁用所有安全守卫 —— 自主技能、心跳配置、HEARTBEAT.md 和 agentChannels 映射。仅在你了解风险的开发或测试环境中使用。

---

## 守卫摘要

| # | 守卫 | 检查内容 | 可自动修复？ |
|---|------|----------|--------------|
| 1 | 自主技能 | `{workspace}/skills/claude-code-autonomy/SKILL.md` 存在 | 代理询问用户后创建 |
| 2 | 心跳配置 | `openclaw.json` 中当前代理的 `heartbeat` 字段 | 用户运行 `jq` 命令 |
| 3 | HEARTBEAT.md 内容 | `HEARTBEAT.md` 存在且包含非空内容 | 代理自动创建 |
| 4 | agentChannels 映射 | 工作目录在 `agentChannels` 配置中映射 | 用户运行 `jq` 命令 |

---

## 守卫 1：自主技能

### 检查内容

插件查找 `{agentWorkspace}/skills/claude-code-autonomy/SKILL.md`。此技能定义代理如何处理 Claude Code 交互 —— 何时自动响应、何时询问用户，以及如何格式化通知。

### 为什么重要

没有自主规则，代理不知道是自动响应 Claude Code 的问题还是升级给用户。这可能导致会话无限期停滞（如果代理从不响应）或代理做出用户希望批准的决定（如果它盲目响应所有内容）。

该技能还定义通知格式：
- `👋 [session-name]` — 转发需要用户决定的问题
- `🤖 [session-name] finished` — 总结已完成会话的操作

### 如何修复

让代理询问你。当启动被阻止时，代理会用简单的语言提示你的自主偏好：

- *"自动响应所有内容，除了架构决策"*
- *"响应前总是询问我"*
- *"自己处理一切，完成后通知我"*

然后代理创建：
1. `skills/claude-code-autonomy/SKILL.md` — 基于你回答的结构化规则
2. `skills/claude-code-autonomy/autonomy.md` — 你的原始偏好

**不要**手动创建技能 —— 让代理先询问你，以便捕获你的实际偏好。

---

## 守卫 2：心跳配置

### 检查内容

插件读取 `~/.openclaw/openclaw.json` 并验证当前代理在 `agents.list` 数组中配置了 `heartbeat` 字段。代理 ID 从上下文（`ctx.agentId`）解析，回退到从 `agentChannels` 映射中提取的 `resolveAgentId()`。

### 为什么重要

心跳是唤醒系统的安全网备用。插件的主要唤醒机制在会话需要关注时立即发送定向代理消息。但如果该消息丢失（网络问题、代理重启），心跳确保代理最终唤醒并检查等待的会话。

没有配置心跳，会话可能卡在"等待输入"状态，没有机制推动代理。

### 如何修复

运行代理提供的 `jq` 命令：

```bash
jq '.agents.list |= map(if .id == "YOUR_AGENT" then . + {"heartbeat": {"every": "60m", "target": "last"}} else . end)' \
  ~/.openclaw/openclaw.json > /tmp/openclaw-updated.json && mv /tmp/openclaw-updated.json ~/.openclaw/openclaw.json
```

然后重启网关：`openclaw gateway restart`

**推荐间隔：** `60m`。定向代理消息提供即时唤醒，所以心跳只是备用 —— 短间隔会浪费 token。

---

## 守卫 3：HEARTBEAT.md 内容

### 检查内容

插件验证 `{agentWorkspace}/HEARTBEAT.md` 存在并包含**真实内容** —— 不仅仅是空格、空行或 Markdown 标题。检查使用正则 `/^(\s|#.*)*$/` 检测实际上为空的文件。

### 为什么重要

即使配置了心跳（守卫 2），代理也需要在心跳周期期间*做什么*的指令。`HEARTBEAT.md` 文件告诉代理检查等待的 Claude Code 会话并处理它们。

空或只有标题的 `HEARTBEAT.md` 意味着心跳触发但代理没有检查会话的指令 —— 违背了安全网的目的。

### 如何修复

代理通常会自动创建此文件。如果失败，手动创建包含会话监控指令的文件：

```markdown
# 心跳

## 检查 Claude Code 会话（安全网备用）
注意：当会话需要关注时，插件会立即发送定向唤醒消息。
此心跳是 60 分钟备用，以防唤醒消息丢失。

如果有 Claude Code 会话正在等待（等待输入）：
1. `claude_sessions` 列出活动会话
2. 如果会话等待 -> `claude_output(session)` 查看问题
3. 处理或通知用户

否则 -> HEARTBEAT_OK
```

---

## 守卫 4：agentChannels 映射

### 检查内容

插件在 `agentChannels` 配置中查找会话的工作目录（位于 `~/.openclaw/openclaw.json` 的 `plugins.entries["openclaw-claude-code-plugin"].config.agentChannels`）。它使用**最长前缀匹配**并进行尾部斜杠规范化 —— 所以 `/home/user/projects` 的映射覆盖 `/home/user/projects/my-app`。

### 为什么重要

`agentChannels` 映射告诉插件将 会话事件路由到哪个通知频道（代理 + 聊天）。没有映射：
- 完成通知无法到达正确的代理
- 唤醒消息没有目的地
- `claude_sessions` 无法按代理过滤会话

### 如何修复

使用代理提供的 `jq` 命令添加工作区映射：

```bash
jq '.plugins.entries["openclaw-claude-code-plugin"].config.agentChannels["/path/to/workspace"] = "channel|accountId|chatId"' \
  ~/.openclaw/openclaw.json > /tmp/openclaw-updated.json && mv /tmp/openclaw-updated.json ~/.openclaw/openclaw.json
```

替换值：
- `/path/to/workspace` — 代理的工作目录
- `channel|accountId|chatId` — 通知目标（例如 `telegram|my-agent|123456789`）

然后重启网关：`openclaw gateway restart`

---

## 首次启动流程

**你不需要手动创建任何东西。** 安装插件并让代理运行任务。守卫会引导你完成设置：

1. **安装插件**
   ```bash
   openclaw plugins install @betrue/openclaw-claude-code-plugin
   openclaw gateway restart
   ```

2. **让代理启动会话** — 例如 *"修复 auth.ts 中的 bug"*

3. **守卫按顺序触发** — 每个被阻止的守卫给出可操作的错误：
   - 守卫 1：代理询问你的自主偏好，创建技能
   - 守卫 2：代理提供心跳配置的 `jq` 命令
   - 守卫 3：代理自动创建 `HEARTBEAT.md`
   - 守卫 4：代理提供频道映射的 `jq` 命令

4. **所有检查通过** — 会话启动。未来的启动完全跳过设置。

### 你需要做的（一次性）

| 步骤 | 操作 | 执行者 |
|------|------|--------|
| 1 | 回答自主性问题 | 你告诉代理你的偏好 |
| 2 | 运行心跳配置 `jq` 命令 | 你粘贴单行命令 |
| 3 | 运行 agentChannels `jq` 命令 | 你粘贴单行命令 |
| 4 | 重启网关 | 你运行 `openclaw gateway restart` |

### 自动创建的内容

| 文件 | 创建者 | 目的 |
|------|--------|------|
| `skills/claude-code-autonomy/SKILL.md` | 代理（询问你后） | 自动响应 vs 升级的自主规则 |
| `skills/claude-code-autonomy/autonomy.md` | 代理（询问你后） | 你的原始自主偏好 |
| `HEARTBEAT.md` | 代理（自动） | 监控会话的心跳检查清单 |

---

## 故障排除

### "Launch blocked — no autonomy skill found"
让代理询问你自主性问题并创建技能。不要手动创建。

### "Launch blocked — no heartbeat configured"
运行代理提供的 `jq` 命令，然后重启网关。

### "Launch blocked — HEARTBEAT.md missing or empty"
让代理创建它。如果已存在但为空或只包含标题，添加描述心跳周期期间要做什么的真实内容。

### "Launch blocked — no agentChannels mapping"
使用提供的 `jq` 命令添加工作区到频道的映射，然后重启网关。

### 需要重启网关
代理**永远不会**自己重启网关 —— 这是设计如此。当配置更改需要重启时，代理会要求你运行 `openclaw gateway restart`。这防止代理干扰其他正在运行的代理或服务。
