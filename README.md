# CodePilot

Control Claude Code from your phone. CodePilot is a self-hosted system that lets you interact with your development projects through Claude's AI agent — browse projects, start coding sessions, and get real-time streaming responses with full tool use visibility, all from a mobile app connected to your own server.

## How It Works

CodePilot has two parts:

```
┌─────────────────┐         WebSocket (port 7777)         ┌──────────────────────┐
│                  │  ◄──────────────────────────────────► │                      │
│   Mobile App     │        Tailscale / LAN                │   Daemon (VPS)       │
│   (Expo / RN)    │                                       │   (Node.js)          │
│                  │   auth, projects, sessions, chat,     │                      │
│                  │   streaming, tool use, interrupts      │   ┌────────────────┐ │
│  ┌────────────┐  │                                       │   │ Claude Agent    │ │
│  │ Zustand    │  │                                       │   │ SDK            │ │
│  │ Stores     │  │                                       │   └────────────────┘ │
│  └────────────┘  │                                       │   ┌────────────────┐ │
│  ┌────────────┐  │                                       │   │ SQLite DB      │ │
│  │ WebSocket  │  │                                       │   │ (sessions,     │ │
│  │ Hook       │  │                                       │   │  messages)     │ │
│  └────────────┘  │                                       │   └────────────────┘ │
└─────────────────┘                                        └──────────────────────┘
```

**Daemon** (`codepilot-daemon/`) — A Node.js server that runs on your VPS or dev machine. It scans your `~/dev/` directory for projects, manages chat sessions backed by SQLite, and proxies conversations to Claude via the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript). Claude can read files, write code, run commands, and search your codebase — all streamed back to the app in real time.

**App** (`codepilot-app/`) — An Expo/React Native mobile app. Connect it to your daemon over your local network or Tailscale, browse your projects, and chat with Claude about any of them. You see everything Claude does: file reads, edits, command execution, search results — presented as collapsible tool use blocks with diffs and output.

### Key Features

- **Project discovery** — Daemon auto-detects projects by scanning for `.git/`, `package.json`, `Cargo.toml`, etc. Shows git branch, framework, and description.
- **Multi-session chat** — Each project can have multiple conversation sessions. Sessions persist across daemon restarts via the Claude SDK's session resume.
- **Real-time streaming** — Text streams token-by-token with a blinking cursor. Tool use blocks appear as they happen.
- **Tool use visibility** — See exactly what Claude is doing: file reads, edits (with inline diffs), bash commands, grep searches. All collapsible.
- **Interrupt support** — Stop Claude mid-generation with a tap.
- **Auto-reconnect** — App reconnects automatically with exponential backoff if the connection drops, then syncs missed messages.
- **Quick actions** — One-tap shortcuts for common prompts like "Git status", "Run tests", "Explain project".
- **Offline resilience** — Messages queue when disconnected and flush on reconnect.

## Prerequisites

- **Server/VPS** — Any Linux machine where you develop (or a VPS). Must have Node.js 20+ installed.
- **Claude Code CLI** — The daemon uses the Claude Agent SDK which requires the Claude Code CLI. Install with `npm install -g @anthropic-ai/claude-code`.
- **Claude authentication** — Either a **Claude Max/Pro subscription** (log in with `claude login` on your server) or an **Anthropic API key**. Claude Max works out of the box — no API key needed.
- **Phone** — iOS or Android with [Expo Go](https://expo.dev/go) for development, or build a standalone app.
- **Network access** — Your phone needs to reach the daemon. [Tailscale](https://tailscale.com) is recommended for secure access from anywhere without exposing ports.
- **Bun** (optional) — The app uses Bun as its package manager. Install from [bun.sh](https://bun.sh). npm works too.

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/your-username/codepilot.git
cd codepilot
```

### 2. Set up the daemon

```bash
cd codepilot-daemon
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
CODEPILOT_TOKEN=your-secure-random-token    # Shared secret for app auth
CODEPILOT_PORT=7777                          # WebSocket port
DEV_DIR=/home/your-username/dev              # Directory to scan for projects
DEFAULT_MODEL=sonnet                         # Claude model (sonnet, opus, haiku)

# Only needed if NOT using Claude Max/Pro subscription.
# If you're logged in via `claude login`, leave this unset.
ANTHROPIC_API_KEY=sk-ant-...
```

Generate a secure token:

```bash
openssl rand -hex 32
```

### 3. Set up the mobile app

```bash
cd ../codepilot-app
bun install    # or: npm install
```

### 4. (Optional) Set up as a systemd service

For 24/7 availability, install the daemon as a service:

```bash
# Edit the service file to match your paths and username
nano codepilot-daemon/codepilot.service

# Install and start
sudo cp codepilot-daemon/codepilot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable codepilot
sudo systemctl start codepilot
```

## Usage

### Start the daemon

```bash
cd codepilot-daemon
npx tsx src/index.ts
```

You should see:

```
[2026-03-20T12:00:00.000Z] Starting daemon...
[2026-03-20T12:00:00.001Z] Database initialized.
[2026-03-20T12:00:00.050Z] Scanned 12 projects from /home/user/dev
[2026-03-20T12:00:00.051Z] WebSocket server listening on port 7777
```

### Start the app

```bash
cd codepilot-app
bunx expo start    # or: npx expo start
```

Scan the QR code with Expo Go on your phone (or press `i`/`a` for simulators).

### Connect

1. Open the app — you'll see the connection screen.
2. Enter your daemon's IP address (or Tailscale hostname), port (`7777`), and the token from your `.env`.
3. Tap **Connect**. Credentials are saved for next time.

### Use it

- **Browse projects** — Your `~/dev/` projects appear automatically. Pull to refresh.
- **Start a session** — Tap a project, then tap **New Session**.
- **Chat** — Type a message or tap a quick action. Claude will read your code, make edits, run commands — you see everything in real time.
- **Interrupt** — Tap the stop button (red square) to interrupt Claude mid-response.
- **Settings** — Tap the gear icon on the projects screen to edit connection settings or disconnect.

## Project Structure

```
codepilot/
├── codepilot-daemon/           # Node.js WebSocket server
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── protocol.ts         # Shared message types
│   │   ├── db.ts               # SQLite schema & queries
│   │   ├── ws-server.ts        # WebSocket server, auth, routing
│   │   ├── session-manager.ts  # Claude Agent SDK integration
│   │   ├── project-scanner.ts  # ~/dev/ project discovery
│   │   ├── auth.ts             # Token validation
│   │   └── logger.ts           # Timestamped logging
│   ├── codepilot.service       # systemd unit file
│   ├── .env.example
│   └── package.json
│
├── codepilot-app/              # Expo/React Native mobile app
│   ├── src/
│   │   ├── app/                # Expo Router screens
│   │   │   ├── (auth)/connect.tsx
│   │   │   ├── (main)/projects/index.tsx
│   │   │   ├── (main)/projects/[projectId]/index.tsx
│   │   │   ├── (main)/projects/[projectId]/[sessionId].tsx
│   │   │   └── (main)/settings.tsx
│   │   ├── components/         # UI components
│   │   │   ├── ChatInput.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── StreamingBubble.tsx
│   │   │   ├── ToolUseBlock.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── SessionItem.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── ReconnectBanner.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── stores/             # Zustand state management
│   │   │   ├── connection.ts
│   │   │   ├── projects.ts
│   │   │   ├── sessions.ts
│   │   │   └── chat.ts
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts # WebSocket singleton + auto-reconnect
│   │   ├── lib/
│   │   │   ├── protocol.ts     # Shared types (mirrors daemon)
│   │   │   ├── storage.ts      # AsyncStorage credentials
│   │   │   └── time.ts         # Relative time helper
│   │   └── constants/
│   │       └── theme.ts        # Color palette
│   └── package.json
│
└── README.md
```

## WebSocket Protocol

The app and daemon communicate via JSON messages over WebSocket. Connection flow:

1. App opens WebSocket to `ws://<host>:<port>`
2. App sends `{ type: "auth", token: "..." }`
3. Daemon responds with `{ type: "auth:result", success: true }`
4. App is now authenticated and can send any message type

### Client → Daemon

| Message | Description |
|---------|-------------|
| `auth` | Authenticate with token |
| `projects:list` | List all detected projects |
| `projects:refresh` | Re-scan the dev directory |
| `sessions:list` | List sessions for a project |
| `sessions:create` | Create a new chat session |
| `messages:history` | Load paginated message history |
| `message:send` | Send a message to Claude |
| `message:interrupt` | Stop Claude mid-generation |

### Daemon → Client

| Message | Description |
|---------|-------------|
| `auth:result` | Auth success/failure |
| `projects:data` | Project list |
| `sessions:data` | Session list |
| `session:created` | New session created |
| `messages:data` | Message history page |
| `message:ack` | User message persisted |
| `stream:text` | Streaming text delta |
| `stream:tool_use` | Claude is using a tool |
| `stream:tool_result` | Tool execution result |
| `stream:done` | Response complete |
| `status:busy` | Claude is working |
| `status:idle` | Claude is done |
| `error` | Error occurred |

## Claude's Capabilities

When chatting through CodePilot, Claude has access to these tools on your server:

- **Read** — Read any file in the project
- **Write** — Create new files
- **Edit** / **MultiEdit** — Make precise edits to existing files
- **Bash** — Run shell commands
- **Glob** — Find files by pattern
- **Grep** — Search file contents
- **WebSearch** — Search the web

The daemon runs with `permissionMode: "acceptEdits"`, meaning Claude can read and edit files without prompting. It cannot run destructive bash commands without the permission mode being changed.

## Configuration

### Environment Variables (Daemon)

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEPILOT_TOKEN` | (required) | Shared secret for WebSocket auth |
| `CODEPILOT_PORT` | `7777` | WebSocket listen port |
| `DEV_DIR` | `~/dev` | Directory to scan for projects |
| `DEFAULT_MODEL` | `sonnet` | Claude model (`sonnet`, `opus`, `haiku`) |
| `ANTHROPIC_API_KEY` | (optional) | Anthropic API key. Not needed if using Claude Max/Pro — just run `claude login` on your server instead. |

### Network Setup

The simplest setup is [Tailscale](https://tailscale.com):

1. Install Tailscale on your server and phone
2. Use your server's Tailscale IP (e.g., `100.x.x.x`) as the host in the app
3. No port forwarding or firewall rules needed

Alternatively, if your phone and server are on the same LAN, use the server's local IP.

## Tech Stack

**Daemon:**
- TypeScript, Node.js
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) for AI integration
- `ws` for WebSocket server
- `better-sqlite3` for persistence
- `dotenv` for configuration

**App:**
- TypeScript, React Native
- [Expo SDK 55](https://expo.dev) with Expo Router
- [NativeWind v5](https://www.nativewind.dev) (Tailwind CSS for RN)
- [Zustand](https://zustand.docs.pmnd.rs) for state management
- Custom WebSocket hook with auto-reconnect

## Contributing

Contributions are welcome! Some areas that could use work:

- **Tests** — No test suite yet. Unit tests for the daemon and component tests for the app would be valuable.
- **Push notifications** — Get notified when Claude finishes a long task.
- **Multi-device** — The daemon broadcasts to all connected clients, but the app doesn't yet handle concurrent sessions gracefully.
- **Markdown rendering** — Assistant text is plain text right now. Proper markdown with syntax-highlighted code blocks would be a big improvement.
- **Theme** — Only dark mode. Light mode support is stubbed but not implemented.
- **File attachments** — Send images or files to Claude from the app.

## License

MIT
