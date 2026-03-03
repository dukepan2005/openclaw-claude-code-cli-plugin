# Claude Code 插件使用指南

通过 Telegram/Discord 等聊天频道，远程控制 Claude Code 执行开发任务。

---

## 🚀 快速开始（5 分钟上手）

### 第 1 步：安装插件

```bash
openclaw plugins install @betrue/openclaw-claude-code-plugin
openclaw gateway restart
```

### 第 2 步：配置通知

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "fallbackChannel": "telegram|your-bot|your-chat-id",
          "maxSessions": 5
        }
      }
    }
  }
}
```

重启 Gateway：
```bash
openclaw gateway restart
```

### 第 3 步：启动第一个会话

在 Telegram 中发送：
```
/claude 创建一个 hello world 程序
```

等待完成，你会收到通知。

---

## 💡 核心概念

### 会话（Session）

一个会话就是一个 Claude Code 实例，在后台执行任务。

| 特性 | 说明 |
|------|------|
| **后台运行** | 不会阻塞你的聊天 |
| **多轮对话** | 可以持续发送消息 |
| **状态追踪** | 实时查看进度 |
| **自动恢复** | 完成后可以继续 |

### 会话状态

| 状态 | 含义 | 可以做什么 |
|------|------|-----------|
| `starting` | 正在启动 | 等待 |
| `running` | 正在执行 | 发送消息、查看输出 |
| `completed` | 成功完成 | 恢复会话、查看结果 |
| `failed` | 执行失败 | 查看错误 |
| `killed` | 被终止 | 无 |

---

## 📋 命令详解

### 1. `/claude` - 启动新会话

**基本用法：**
```
/claude <任务描述>
```

**示例：**
```
/claude 修复登录页面的 bug

/claude 添加用户注册功能

/claude 重构数据库层，使用 Repository 模式
```

**可选参数：**
```
/claude --name <名称> <任务>        # 指定会话名称
```

**示例：**
```
/claude --name fix-auth 修复认证问题
```

---

### 2. `/claude_sessions` - 查看所有会话

**用法：**
```
/claude_sessions
```

**输出示例：**
```
📋 所有会话：

fix-auth [abc123]
  Status: RUNNING | Duration: 5m 23s
  💬 "修复认证问题..."
  📁 /home/user/project

add-upload [xyz789]
  Status: COMPLETED | Duration: 12m 45s
  💬 "添加文件上传功能"
  📁 /home/user/project
```

---

### 3. `/claude_respond` - 发送消息到会话

**用法：**
```
/claude_respond <会话名称或ID> <消息>
```

**示例：**
```
/claude_respond fix-auth 改用 JWT token

/claude_respond abc123 添加单元测试

/claude_respond fix-auth 停下！用另一个方案
```

**中断当前任务：**
```
/claude_respond --interrupt fix-auth 改用其他方案
```

---

### 4. `/claude_output` - 查看会话输出

**用法：**
```
/claude_output <会话名称或ID>
```

**查看最近 50 行（默认）：**
```
/claude_output fix-auth
```

**查看更多行：**
```
/claude_output fix-auth --lines 100
```

**查看全部输出：**
```
/claude_output fix-auth --full
```

---

### 5. `/claude_fg` - 实时查看会话（前台模式）

**用法：**
```
/claude_fg <会话名称或ID>
```

**效果：**
- 会话的实时输出会流式显示在聊天中
- 你可以看到 Claude 正在做什么
- 类似于"直播"模式

**停止实时查看：**
```
/claude_bg
```

---

### 6. `/claude_bg` - 停止实时查看

**用法：**
```
/claude_bg                          # 停止所有前台会话
/claude_bg <会话名称>               # 停止特定会话
```

---

### 7. `/claude_kill` - 终止会话

**用法：**
```
/claude_kill <会话名称或ID>
```

**示例：**
```
/claude_kill fix-auth

/claude_kill abc123
```

---

### 8. `/claude_resume` - 恢复已完成的会话

**查看可恢复的会话：**
```
/claude_resume --list
```

**恢复并继续：**
```
/claude_resume <会话名称> <新任务>
```

**示例：**
```
/claude_resume fix-auth 添加错误处理

/claude_resume fix-auth 继续优化
```

**Fork（分支）会话：**
```
/claude_resume --fork fix-auth 尝试完全不同的方案
```

---

### 9. `/claude_stats` - 查看统计信息

**用法：**
```
/claude_stats
```

**输出示例：**
```
📊 Claude Code 使用统计：

总会话数: 15
总花费: $1.23
平均时长: 8m 30s

按状态:
  ✅ Completed: 12
  ❌ Failed: 2
  ⚠️  Killed: 1
```

---

## 🎯 常见使用场景

### 场景 1：修复 Bug

```
# 1. 启动会话
/claude 修复登录页面的空指针异常

# 2. 等待一会，检查进度
/claude_sessions

# 3. 查看 Claude 的问题或建议
/claude_output fix-login

# 4. 回答 Claude 的问题
/claude_respond fix-login 是的，使用 try-catch

# 5. 查看最终结果
/claude_output fix-login --full
```

---

### 场景 2：添加新功能

```
# 1. 启动功能开发
/claude --name add-upload 实现文件上传功能

# 2. 实时监控进度
/claude_fg add-upload
# (可以看到 Claude 正在做什么)
# (完成)
/claude_bg

# 3. 补充需求
/claude_respond add-upload 添加文件大小限制

# 4. 等待完成
```

---

### 场景 3：代码重构

```
# 1. 启动重构任务
/claude --name refactor-db 重构数据库层，使用 Repository 模式

# 2. 一段时间后检查
/claude_sessions

# 3. 改变方向
/claude_respond --interrupt refactor-db 停下！先只重构用户模块

# 4. 继续其他模块
/claude_resume refactor-db 现在重构订单模块
```

---

### 场景 4：多个并行任务

```
# 启动多个会话
/claude --name fix-auth 修复认证
/claude --name add-search 添加搜索功能
/claude --name refactor-ui 优化 UI

# 查看所有会话
/claude_sessions

# 分别与它们交互
/claude_respond fix-auth 使用 OAuth
/claude_respond add-search 支持模糊搜索
/claude_respond refactor-ui 改用 Tailwind CSS
```

---

## ⚙️ 配置选项

编辑 `~/.openclaw/openclaw.json` 中的插件配置：

```json
{
  "plugins": {
    "entries": {
      "openclaw-claude-code-plugin": {
        "enabled": true,
        "config": {
          "maxSessions": 5,
          "defaultBudgetUsd": 5,
          "defaultModel": "sonnet",
          "permissionMode": "bypassPermissions",
          "fallbackChannel": "telegram|bot|chat-id",
          "idleTimeoutMinutes": 30
        }
      }
    }
  }
}
```

### 配置说明

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `maxSessions` | 5 | 最大并发会话数 |
| `defaultBudgetUsd` | 5 | 每个会话的默认预算（美元） |
| `defaultModel` | - | 默认模型（sonnet/opus） |
| `permissionMode` | bypassPermissions | 权限模式 |
| `fallbackChannel` | - | 默认通知频道 |
| `idleTimeoutMinutes` | 30 | 空闲超时（分钟后自动 kill） |

---

## 🔔 通知说明

当会话状态变化时，你会收到通知：

| 图标 | 事件 | 说明 |
|------|------|------|
| ↩️ | Launched | 会话已启动 |
| 🔔 | Claude asks | Claude 在等待你的输入 |
| ↩️ | Responded | 消息已发送到会话 |
| ✅ | Completed | 会话成功完成 |
| ❌ | Failed | 会话执行失败 |
| ⛔ | Killed | 会话被终止 |

---

## 💪 最佳实践

### 1. 给会话起有意义的名字

```
✅ 好的命名:
/claude --name fix-auth-bug 修复认证
/claude --name add-user-profile 添加用户资料

❌ 避免无意义命名:
/claude --name task1 修复认证
/claude --name test 添加功能
```

### 2. 明确描述任务

```
✅ 好的描述:
/claude 在 src/auth.ts 的 login 函数中添加空值检查，处理 user 为 null 的情况

❌ 模糊描述:
/claude 修复 bug
```

### 3. 合理设置预算

```
小任务（1-2分钟）:
/claude 添加简单的日志记录  # 预算约 $0.01-0.05

中等任务（5-10分钟）:
/claude 实现用户注册功能  # 预算约 $0.5-2

大任务（30分钟+）:
/claude 重构整个数据层  # 预算 $5-10+
```

### 4. 使用前台模式监控重要任务

```
# 启动任务
/claude --name deploy-api 部署 API 到生产环境

# 实时监控
/claude_fg deploy-api
# (观察输出，确保一切正常)
/claude_bg
```

### 5. 及时清理完成的会话

```
# 查看会话
/claude_sessions

# 终止不需要的会话
/claude_kill old-session
```

---

## 🐛 故障排除

### 问题 1：命令没有反应

**原因：** Gateway 没有运行

**解决：**
```bash
openclaw gateway restart
```

---

### 问题 2：收到 "SessionManager not initialized" 错误

**原因：** 插件服务未启动

**解决：**
```bash
# 检查服务状态
openclaw gateway status

# 重启 Gateway
openclaw gateway restart
```

---

### 问题 3：会话一直卡在 "starting" 状态

**原因：** Claude Code CLI 未安装或路径不对

**解决：**
```bash
# 检查 CLI 是否可用
which claude

# 如果没有，安装 Claude Code
npm install -g @anthropic-ai/claude-code
```

---

### 问题 4：没有收到通知

**原因：** `fallbackChannel` 配置不正确

**解决：**
1. 确认你的 Telegram Chat ID：
   - 在 Telegram 中发送消息给 `@userinfobot`
   - 它会返回你的 User ID

2. 更新配置：
   ```json
   {
     "fallbackChannel": "telegram|bot-name|your-chat-id"
   }
   ```

3. 重启 Gateway：
   ```bash
   openclaw gateway restart
   ```

---

### 问题 5：会话意外终止

**原因：** 预算耗尽或空闲超时

**解决：**
- 增加预算：在配置中设置 `defaultBudgetUsd: 10`
- 增加超时：设置 `idleTimeoutMinutes: 60`

---

## 📚 更多资源

- [API 文档](./API.md) - 详细的工具和命令参数
- [架构文档](./ARCHITECTURE.md) - 深入了解插件架构
- [开发文档](./DEVELOPMENT.md) - 开发者指南
- [预启动守卫](./PRELAUNCH_GUARDS_CN.md) - 安全检查和最佳实践

---

## 🆘 获取帮助

遇到问题？

1. 查看本文档的故障排除部分
2. 检查 Gateway 日志：`openclaw logs`
3. 在 GitHub 提 issue：[github.com/alizarion/openclaw-claude-code-plugin](https://github.com/alizarion/openclaw-claude-code-plugin)

---

**Happy Coding! 🚀**
