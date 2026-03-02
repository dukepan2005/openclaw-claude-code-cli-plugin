# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.10] - 2025-03-02

### Fixed
- Add `--verbose` flag required for `stream-json` output format in CLI mode

## [1.0.9] - 2025-03-02

### Fixed
- Show full config path in all JSON examples and clarify prose in documentation

## [1.0.8] - 2025-03-01

### Added
- `skipSafetyChecks` config option to bypass all pre-launch guards (dev only)

## [1.0.7] - 2025-02-28

### Added
- Reliable notification system with 2-level architecture
- Targeted agent message wake system (replaces system event wake)
- Long-running session reminders (>10min)

### Fixed
- Improved error handling and code review findings

## [1.0.6] - 2025-02-27

### Added
- Getting Started step-by-step guide in README
- `agentChannels` config for implicit channel routing based on workspace directory
- Support for 3-segment channel format (`channel|account|target`)
- Tool factory pattern for agent context

### Changed
- Improved foreground/background notification handling
- Better event routing to agent channels

### Fixed
- Channel routing via `ctx.workspaceDir` when `messageChannel` is bare
- Use `|` separator for channel addresses to avoid OpenClaw core `:` splitting
- Prefix match for `agentChannels` workdir lookup

## [1.0.5] - 2025-02-25

### Added
- `maxAutoResponds` safety cap for consecutive agent auto-responds
- Pre-launch safety checks (autonomy skill, heartbeat config, HEARTBEAT.md, agentChannels)
- Background notification cleanup

### Changed
- Restructured README and split detailed docs

### Fixed
- Use `api.pluginConfig` instead of `api.getConfig()`

## [1.0.4] - 2025-02-24

### Added
- Multi-turn session support with `--input-format stream-json`
- Waiting-for-input detection with dual mechanism (end-of-turn + 15s safety-net timer)
- Session persistence for resume support
- Debounced foreground streaming (500ms)

### Changed
- Major architecture overhaul with SessionManager and NotificationRouter

## [1.0.3] - 2025-02-22

### Added
- Initial foreground/background streaming model
- Output buffering with 200-line limit per session
- Session GC after 1 hour

## [1.0.2] - 2025-02-20

### Added
- Basic session lifecycle management
- Tool implementations for launching and monitoring sessions
- Slash commands (`/claude`, `/claude_sessions`)

## [1.0.1] - 2025-02-18

### Added
- Initial plugin structure with OpenClaw SDK
- Basic CLI spawning capability

## [1.0.0] - 2025-02-15

### Added
- Initial release
- Core plugin infrastructure
- Registration of tools, commands, and gateway RPC methods

[Unreleased]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.10...HEAD
[1.0.10]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/alizarion/openclaw-claude-code-plugin/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/alizarion/openclaw-claude-code-plugin/releases/tag/v1.0.0
