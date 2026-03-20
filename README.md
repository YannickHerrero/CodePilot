# CodePilot

**Control Claude Code from your phone.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: iOS & Android](https://img.shields.io/badge/Platform-iOS%20%26%20Android-green.svg)](https://expo.dev)
[![Expo SDK 55](https://img.shields.io/badge/Expo%20SDK-55-4630EB.svg)](https://expo.dev)

---

<!-- Replace with a screenshot or GIF of the app in action -->
<p align="center">
  <img src="docs/demo.gif" alt="CodePilot demo" width="300" />
  <br />
  <em>Chat with Claude about any project on your server — see file edits, command output, and more in real time.</em>
</p>

---

## What is CodePilot?

CodePilot is a self-hosted mobile app that connects to your development server and lets you chat with Claude about any of your projects. You browse your repos, start a conversation, and Claude can read files, write code, run commands, and search your codebase — all streamed to your phone in real time with full visibility into what it's doing. Think of it as Claude Code in your pocket.

## Features

- **Project Discovery** — Automatically detects projects on your server by scanning for `.git/`, `package.json`, `Cargo.toml`, etc.
- **Real-Time Streaming** — Text streams token-by-token. Tool use blocks appear as they happen.
- **Full Tool Visibility** — See exactly what Claude does: file reads, edits (with inline diffs), bash commands, grep searches. All collapsible.
- **Multi-Session Chat** — Multiple conversations per project, persisted across restarts.
- **Interrupt Support** — Stop Claude mid-generation with a tap.
- **Quick Actions** — One-tap shortcuts for common prompts like "Git status", "Run tests", "Explain project".
- **Auto-Reconnect** — Reconnects with exponential backoff if the connection drops, then syncs missed messages.
- **Offline Resilience** — Messages queue when disconnected and flush on reconnect.

## Quick Start

### 1. Clone & set up the daemon

```bash
git clone https://github.com/YannickHerrero/CodePilot.git
cd CodePilot/codepilot-daemon
npm install
```

Create a `.env` file:

```env
CODEPILOT_TOKEN=<run: openssl rand -hex 32>
CODEPILOT_PORT=7777
DEV_DIR=/home/your-username/dev
DEFAULT_MODEL=sonnet
```

> **Auth:** The daemon uses the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript), which requires the Claude Code CLI (`npm install -g @anthropic-ai/claude-code`). Log in with `claude login` if you have a Claude Max/Pro subscription, or set `ANTHROPIC_API_KEY` in `.env` to use an API key instead.

### 2. Start the daemon

```bash
npx tsx src/index.ts
```

### 3. Get the app

<!-- TODO: uncomment when published
[<img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="40">](https://apps.apple.com/app/codepilot/id000000000)
[<img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="40">](https://play.google.com/store/apps/details?id=com.yherrero.codepilotapp)
-->

> **Coming soon to the App Store and Google Play.** In the meantime, you can build and run a [development build](https://docs.expo.dev/develop/development-builds/introduction/) on your device:

```bash
cd ../codepilot-app
bun install    # or npm install
bunx expo run:ios    # or: bunx expo run:android
```

Open the app, enter your daemon's IP, port `7777`, and the token from `.env` — you're in.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEPILOT_TOKEN` | *(required)* | Shared secret for WebSocket auth |
| `CODEPILOT_PORT` | `7777` | WebSocket listen port |
| `DEV_DIR` | `~/dev` | Directory to scan for projects |
| `DEFAULT_MODEL` | `sonnet` | Claude model: `sonnet`, `opus`, or `haiku` |
| `ANTHROPIC_API_KEY` | *(optional)* | Only needed if not using Claude Max/Pro (`claude login`) |

### Running as a systemd service

For 24/7 availability:

```bash
# Edit the service file to match your paths and username
vim codepilot-daemon/codepilot.service

sudo cp codepilot-daemon/codepilot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now codepilot
```

## Network Setup

The simplest way to connect your phone to the daemon is [Tailscale](https://tailscale.com):

1. Install Tailscale on your server and phone.
2. Use your server's Tailscale IP (e.g., `100.x.x.x`) as the host in the app.
3. No port forwarding or firewall rules needed.

If your phone and server are on the same LAN, you can use the server's local IP directly.

## How It Works

```
┌──────────────────┐       WebSocket (port 7777)        ┌──────────────────────┐
│                  │  ◄──────────────────────────────►  │                      │
│   Mobile App     │      Tailscale / LAN               │   Daemon (VPS)       │
│   (Expo / RN)    │                                    │   (Node.js)          │
│                  │                                    │                      │
│  ┌────────────┐  │                                    │   ┌────────────────┐ │
│  │ Zustand    │  │                                    │   │ Claude Agent   │ │
│  │ Stores     │  │                                    │   │ SDK            │ │
│  └────────────┘  │                                    │   └────────────────┘ │
│  ┌────────────┐  │                                    │   ┌────────────────┐ │
│  │ WebSocket  │  │                                    │   │ SQLite DB      │ │
│  │ Hook       │  │                                    │   └────────────────┘ │
│  └────────────┘  │                                    │                      │
└──────────────────┘                                    └──────────────────────┘
```

**Daemon** — A Node.js server that runs on your VPS or dev machine. It scans your projects directory, manages chat sessions in SQLite, and proxies conversations to Claude via the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript). Claude can read files, write code, run commands, and search your codebase — all streamed back to the app in real time.

**App** — An Expo/React Native mobile app. Connect it to your daemon over your local network or Tailscale, browse your projects, and chat with Claude about any of them. You see everything Claude does — file reads, edits, command execution, search results — presented as collapsible tool-use blocks with diffs and output.

Built with TypeScript, [Expo SDK 55](https://expo.dev), [Zustand](https://zustand.docs.pmnd.rs), and the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript).

## Contributing

Contributions are welcome! Some areas that could use help:

- **Tests** — No test suite yet. Unit tests for the daemon and component tests for the app would be valuable.
- **Push notifications** — Get notified when Claude finishes a long task.
- **Multi-device** — The daemon broadcasts to all connected clients, but the app doesn't handle concurrent sessions gracefully yet.
- **Markdown rendering** — Improving the markdown and syntax-highlighted code block rendering.
- **File attachments** — Send images or files to Claude from the app.

## License

MIT
