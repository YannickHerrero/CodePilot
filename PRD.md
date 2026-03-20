# PRD: CodePilot — Mobile Claude Code Client

## Overview

CodePilot is a mobile app + VPS daemon that lets you interact with your projects through Claude Code from your phone. Think of it as a mobile IDE powered by Claude's agentic coding capabilities, connected to your VPS over Tailscale.

The system has two parts:
1. **Daemon** (`codepilot-daemon`): A Node.js/TypeScript server running on the VPS that manages Claude Agent SDK sessions and exposes a WebSocket API.
2. **App** (`codepilot-app`): A React Native/Expo mobile app that connects to the daemon and provides a messaging-like interface for interacting with your projects.

---

## Architecture

```
┌─────────────────┐      Tailscale Network       ┌──────────────────────────┐
│                  │                              │   VPS (codepilot-daemon) │
│  Expo/RN App    │◄──── WebSocket (wss/ws) ────►│                          │
│  (codepilot-app)│      on port 7777            │  ├─ WebSocket Server     │
│                  │                              │  ├─ Claude Agent SDK     │
│  ├─ Project List │                              │  ├─ Session Manager      │
│  ├─ Chat UI      │                              │  ├─ Project Scanner      │
│  ├─ Quick Actions│                              │  └─ SQLite (state)       │
│  └─ Settings     │                              │                          │
│                  │                              │   ~/dev/ (projects)      │
└─────────────────┘                              └──────────────────────────┘
```

---

## Part 1: The Daemon (`codepilot-daemon`)

### Tech Stack

- **Runtime**: Node.js 22+ with TypeScript (tsx for execution)
- **SDK**: `@anthropic-ai/claude-agent-sdk` (Claude Agent SDK, NOT the deprecated `@anthropic-ai/claude-code`)
- **WebSocket**: `ws` library
- **Database**: `better-sqlite3` for session/message persistence
- **Process Manager**: `systemd` service unit for 24/7 operation

### Project Structure

```
codepilot-daemon/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point: starts WS server
│   ├── ws-server.ts          # WebSocket server setup & connection handling
│   ├── protocol.ts           # Message type definitions (shared types)
│   ├── session-manager.ts    # Creates/resumes/lists Claude SDK sessions
│   ├── project-scanner.ts    # Scans ~/dev/ for projects
│   ├── db.ts                 # SQLite schema & queries
│   └── auth.ts               # Token-based auth middleware
├── codepilot.service          # systemd unit file
└── .env.example
```

### Database Schema (SQLite)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,            -- slugified project name
  name TEXT NOT NULL,             -- display name
  path TEXT NOT NULL UNIQUE,      -- absolute path on VPS
  git_branch TEXT,                -- current branch (nullable)
  last_opened_at TEXT,            -- ISO timestamp
  metadata TEXT                   -- JSON: { packageJson?, gitRemote?, description? }
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id),
  sdk_session_id TEXT,            -- Claude Agent SDK session ID (for resume)
  title TEXT,                     -- auto-generated or user-set
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1     -- soft delete
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,            -- UUID
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,             -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,          -- JSON-encoded content (see Message Format below)
  created_at TEXT NOT NULL,
  seq INTEGER NOT NULL            -- ordering within session
);
```

### Message Content Format (stored as JSON in `messages.content`)

```typescript
// User message content
type UserMessageContent = {
  type: "text";
  text: string;
};

// Assistant message content — an array of blocks
type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string; is_error?: boolean };

type AssistantMessageContent = AssistantBlock[];
```

### WebSocket Protocol

All messages are JSON with a `type` field. The daemon and app communicate using this protocol:

#### Client → Daemon

```typescript
// Authenticate on connect
{ type: "auth", token: string }

// List all projects
{ type: "projects:list" }

// Refresh project list (rescan ~/dev/)
{ type: "projects:refresh" }

// List sessions for a project
{ type: "sessions:list", projectId: string }

// Create a new session for a project
{ type: "sessions:create", projectId: string, title?: string }

// Load message history for a session
{ type: "messages:history", sessionId: string, limit?: number, before?: string }

// Send a message to Claude in a session
{ type: "message:send", sessionId: string, text: string }

// Interrupt Claude (stop current generation)
{ type: "message:interrupt", sessionId: string }
```

#### Daemon → Client

```typescript
// Auth result
{ type: "auth:result", success: boolean, error?: string }

// Project list
{ type: "projects:data", projects: Project[] }

// Session list
{ type: "sessions:data", projectId: string, sessions: Session[] }

// Session created
{ type: "session:created", session: Session }

// Message history
{ type: "messages:data", sessionId: string, messages: Message[], hasMore: boolean }

// User message acknowledged (assigned ID & seq)
{ type: "message:ack", sessionId: string, messageId: string, seq: number }

// Assistant streaming: text chunk
{ type: "stream:text", sessionId: string, messageId: string, text: string }

// Assistant streaming: tool use started
{ type: "stream:tool_use", sessionId: string, messageId: string, tool: string, input: Record<string, unknown> }

// Assistant streaming: tool result
{ type: "stream:tool_result", sessionId: string, messageId: string, tool: string, output: string, is_error?: boolean }

// Assistant message complete
{ type: "stream:done", sessionId: string, messageId: string }

// Claude is working indicator
{ type: "status:busy", sessionId: string, activity?: string }

// Claude finished working
{ type: "status:idle", sessionId: string }

// Error
{ type: "error", code: string, message: string, sessionId?: string }
```

### Claude Agent SDK Integration

Use the V1 `query()` API with streaming input for multi-turn sessions. The V2 session API is still in unstable preview, so stick with V1 which is stable.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// For each session, maintain a query instance with streaming input
const q = query({
  prompt: userMessageGeneratorFunction(),
  options: {
    cwd: projectPath,                       // Set to the project's directory
    allowedTools: [
      "Read", "Write", "Edit", "MultiEdit",
      "Bash", "Glob", "Grep", "WebSearch"
    ],
    permissionMode: "acceptEdits",          // Auto-approve file edits
    model: "sonnet",                        // Default model, configurable
    includePartialMessages: true,           // Enable streaming
  },
});

// Process the async generator
for await (const message of q) {
  // Handle message types: system, assistant, result
  // Forward to connected WebSocket clients as stream:* events
  // Persist completed messages to SQLite
}
```

**Session Resume**: When a user reconnects to an existing session, use the `resume` option:

```typescript
const q = query({
  prompt: newUserMessage,
  options: {
    resume: savedSdkSessionId,  // Resume previous conversation
    cwd: projectPath,
  },
});
```

**Key implementation details**:
- Each active session runs its own `query()` async generator
- When a session has no active query (user hasn't sent a message), it's "idle" — no resources consumed
- The daemon buffers all streamed output to SQLite so the app can disconnect and reconnect without losing messages
- On reconnect, the app requests `messages:history` and gets caught up
- The `query()` generator yields `StreamEvent` messages when `includePartialMessages: true`. Filter for `content_block_delta` events with `delta.type === "text_delta"` for text streaming.

### Project Scanner

```typescript
// project-scanner.ts
// Scans ~/dev/ for project directories
// A "project" is any directory in ~/dev/ that contains at least one of:
//   - .git/
//   - package.json
//   - Cargo.toml
//   - pyproject.toml
//   - go.mod
//   - pubspec.yaml
//
// For each project, extract:
//   - name: directory name
//   - path: absolute path
//   - git_branch: current branch (from .git/HEAD)
//   - metadata: { description, gitRemote, framework }
//     - description: from package.json description, Cargo.toml description, etc.
//     - gitRemote: from .git/config
//     - framework: detected from dependencies (next, expo, react, etc.)
```

### Auth

Simple shared-token auth. The daemon reads `CODEPILOT_TOKEN` from `.env`. The client sends it on WebSocket connect. If it doesn't match, the connection is dropped.

This is sufficient because Tailscale already provides network-level security — the WebSocket is only reachable from your tailnet.

### systemd Service

```ini
# /etc/systemd/system/codepilot.service
[Unit]
Description=CodePilot Daemon
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/dev/codepilot-daemon
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/home/your-username/dev/codepilot-daemon/.env

[Install]
WantedBy=multi-user.target
```

---

## Part 2: The Mobile App (`codepilot-app`)

### Tech Stack

- **Framework**: Expo (SDK 53+) with Expo Router
- **Language**: TypeScript
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind for RN)
- **Markdown Rendering**: `react-native-markdown-display` or `@ronradtke/react-native-markdown-display`
- **Syntax Highlighting**: `react-syntax-highlighter` (for code blocks in messages)
- **WebSocket**: React Native's built-in WebSocket + custom reconnection hook

### Project Structure

```
codepilot-app/
├── app.json
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── app/
│   ├── _layout.tsx                # Root layout with providers
│   ├── index.tsx                  # Redirect to /projects
│   ├── (auth)/
│   │   └── connect.tsx            # Connection setup screen
│   ├── (main)/
│   │   ├── _layout.tsx            # Tab or stack layout
│   │   ├── projects/
│   │   │   ├── index.tsx          # Project list screen
│   │   │   └── [projectId]/
│   │   │       ├── index.tsx      # Project detail / session list
│   │   │       └── [sessionId].tsx  # Chat screen
│   │   └── settings.tsx           # Settings screen
├── components/
│   ├── ChatInput.tsx              # Message input with send button
│   ├── MessageBubble.tsx          # Renders a single message
│   ├── ToolUseBlock.tsx           # Collapsible tool use display
│   ├── DiffBlock.tsx              # File diff display
│   ├── ProjectCard.tsx            # Project list item
│   ├── SessionItem.tsx            # Session list item
│   ├── StatusBar.tsx              # Connection + Claude activity status
│   ├── QuickActions.tsx           # Common action shortcuts
│   └── StreamingText.tsx          # Animated text streaming display
├── hooks/
│   ├── useWebSocket.ts            # WebSocket connection + reconnection
│   ├── useSession.ts              # Session-level operations
│   └── useProjects.ts             # Project-level operations
├── stores/
│   ├── connection.ts              # Connection state (host, token, status)
│   ├── projects.ts                # Project list state
│   ├── sessions.ts                # Sessions state per project
│   └── chat.ts                    # Messages + streaming state for active chat
├── lib/
│   ├── protocol.ts                # Shared types (mirror of daemon protocol.ts)
│   └── storage.ts                 # AsyncStorage helpers for persisting connection info
└── constants/
    └── theme.ts                   # Color tokens, spacing
```

### Screens & UX

#### 1. Connect Screen (`/connect`)

First-time setup and reconnection screen.

- **Fields**:
  - VPS Tailscale IP or hostname (e.g., `100.x.y.z` or `my-vps`)
  - Port (default: `7777`)
  - Auth token
- **Behavior**:
  - "Connect" button attempts WebSocket connection
  - On success, save credentials to AsyncStorage and navigate to projects
  - On failure, show error inline
  - Previously saved connection auto-connects on app launch
- **Design**: Minimal, centered card. App logo/name at top. Dark theme.

#### 2. Project List (`/projects`)

The home screen after connecting.

- **Layout**: Vertical scrollable list of project cards
- **Each card shows**:
  - Project name (bold)
  - Git branch badge (e.g., `main`, `feature/auth`)
  - Framework icon/badge if detected (Next.js, Expo, Rust, etc.)
  - Last active session timestamp ("2 hours ago")
  - One-line preview of last message in most recent session
- **Sorting**: By last activity (most recent first)
- **Pull to refresh**: Triggers `projects:refresh` to rescan `~/dev/`
- **Search bar**: Filter projects by name (client-side filtering)
- **Tap a card** → navigate to project detail

#### 3. Project Detail / Sessions (`/projects/[projectId]`)

Shows sessions for a specific project.

- **Header**: Project name, git branch, path
- **"New Session" button**: Prominent, top of screen. Tapping it creates a session and navigates to the chat screen immediately
- **Session list**: Each item shows:
  - Session title (auto-generated from first message, or user-set)
  - Created date
  - Message count
  - Preview of last message
- **Tap a session** → navigate to chat screen
- **Swipe to delete** (soft delete via `is_active = 0`)

#### 4. Chat Screen (`/projects/[projectId]/[sessionId]`)

The core interaction screen. This should feel like a polished messaging app.

**Message Display**:
- **User messages**: Right-aligned, styled as a sent message bubble. Plain text.
- **Assistant messages**: Left-aligned, full-width. Rendered as rich markdown with:
  - Syntax-highlighted code blocks with a "copy" button
  - Inline code with monospace font
  - Bold, italic, lists rendered properly
- **Tool use blocks**: Displayed inline within assistant messages as collapsible cards:
  - **Header** (always visible): Icon + tool name + brief summary
    - Read: `📄 Read src/api/auth.ts`
    - Write: `✏️ Created src/utils/helpers.ts`
    - Edit: `🔧 Edited src/index.ts (+5 -2)`
    - Bash: `💻 Ran npm test`
    - Glob: `🔍 Searched for *.tsx files`
    - Grep: `🔎 Searched for "handleAuth"`
  - **Expanded content** (on tap): Full tool input/output
    - For Edit/Write: Show a simplified diff view (green for additions, red for deletions)
    - For Bash: Show command and output in a terminal-styled block
    - For Read: Show file content in a scrollable code block
  - Default state: **collapsed** (to keep the chat readable)

**Status Bar** (sticky at top):
- Connection status indicator (green dot = connected, yellow = reconnecting, red = disconnected)
- When Claude is working: animated indicator with activity description
  - "Reading src/api/auth.ts…"
  - "Running npm test…"
  - "Thinking…"
- Current project name + git branch

**Input Area** (sticky at bottom):
- Multi-line text input (starts single-line, grows up to 4 lines)
- Send button (right side, enabled only when text is non-empty)
- When Claude is working: send button becomes a **stop button** (⬜) that triggers `message:interrupt`

**Quick Actions** (above the input, horizontally scrollable):
- Pill-shaped buttons for common actions:
  - "Git status" → sends `git status`
  - "Run tests" → sends `run the tests`
  - "Recent changes" → sends `show me the recent git changes`
  - "Explain this project" → sends `give me a brief overview of this project's architecture`
  - "Fix errors" → sends `check for and fix any TypeScript/lint errors`
- These are just shortcuts that send pre-defined prompts
- The quick actions bar can be hidden/shown with a small toggle

**Streaming Behavior**:
- As `stream:text` events arrive, append text to the current assistant message in real-time
- Use a simple character-by-character or chunk-by-chunk rendering (no need for fancy typing animation)
- Auto-scroll to bottom as new content arrives, UNLESS the user has scrolled up (respect scroll position)
- When `stream:done` arrives, finalize the message

**Offline / Disconnect Handling**:
- If WebSocket disconnects, show a banner at the top: "Reconnecting…" with auto-retry
- Messages typed while disconnected are queued and sent on reconnect
- On reconnect, request `messages:history` with `after` parameter to fetch any missed messages

#### 5. Settings Screen (`/settings`)

- **Connection**: Edit VPS host, port, token. Test connection button.
- **Model**: Select default model (`sonnet`, `opus`, `haiku`). Sent to daemon, which passes it to the SDK.
- **Theme**: Dark / Light / System (dark by default — it's a dev tool)
- **About**: App version, links

### WebSocket Hook (`useWebSocket.ts`)

Critical piece. Must handle:

```typescript
// Core responsibilities:
// 1. Connect to ws://<host>:<port> on the tailnet
// 2. Send auth token immediately on connect
// 3. Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
// 4. Queue messages sent while disconnected
// 5. Provide connection status to the UI
// 6. Parse incoming messages and route to appropriate Zustand stores
// 7. Heartbeat ping every 30s to detect stale connections

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface UseWebSocket {
  status: ConnectionStatus;
  send: (message: ClientMessage) => void;
  connect: (host: string, port: number, token: string) => void;
  disconnect: () => void;
}
```

### Zustand Stores

**Connection Store**:
```typescript
interface ConnectionState {
  host: string | null;
  port: number;
  token: string | null;
  status: ConnectionStatus;
  // actions
  setCredentials: (host: string, port: number, token: string) => void;
  setStatus: (status: ConnectionStatus) => void;
}
```

**Projects Store**:
```typescript
interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  // actions
  setProjects: (projects: Project[]) => void;
  refreshProjects: () => void;
}
```

**Chat Store**:
```typescript
interface ChatState {
  activeSessionId: string | null;
  messages: Record<string, Message[]>;        // keyed by sessionId
  streamingMessage: StreamingMessage | null;   // current partial assistant message
  isClaudeBusy: boolean;
  claudeActivity: string | null;              // "Reading file..." etc.
  // actions
  setActiveSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  appendStreamText: (sessionId: string, text: string) => void;
  addToolUseBlock: (sessionId: string, block: ToolUseBlock) => void;
  addToolResultBlock: (sessionId: string, block: ToolResultBlock) => void;
  finalizeStreamingMessage: (sessionId: string) => void;
  setClaudeBusy: (busy: boolean, activity?: string) => void;
}
```

---

## Part 3: Shared Types (`protocol.ts`)

This file should be identical (or importable) in both the daemon and the app. Define all message types, project/session interfaces here.

```typescript
// === Entities ===

export interface Project {
  id: string;
  name: string;
  path: string;
  gitBranch: string | null;
  lastOpenedAt: string | null;
  metadata: {
    description?: string;
    gitRemote?: string;
    framework?: string;
  };
}

export interface Session {
  id: string;
  projectId: string;
  sdkSessionId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: UserMessageContent | AssistantMessageContent;
  createdAt: string;
  seq: number;
}

// === Content Types ===

export interface UserMessageContent {
  type: "text";
  text: string;
}

export type AssistantMessageContent = AssistantBlock[];

export type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; tool: string; output: string; isError?: boolean };

// === Client → Daemon Messages ===

export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "projects:list" }
  | { type: "projects:refresh" }
  | { type: "sessions:list"; projectId: string }
  | { type: "sessions:create"; projectId: string; title?: string }
  | { type: "messages:history"; sessionId: string; limit?: number; before?: string }
  | { type: "message:send"; sessionId: string; text: string }
  | { type: "message:interrupt"; sessionId: string };

// === Daemon → Client Messages ===

export type DaemonMessage =
  | { type: "auth:result"; success: boolean; error?: string }
  | { type: "projects:data"; projects: Project[] }
  | { type: "sessions:data"; projectId: string; sessions: Session[] }
  | { type: "session:created"; session: Session }
  | { type: "messages:data"; sessionId: string; messages: Message[]; hasMore: boolean }
  | { type: "message:ack"; sessionId: string; messageId: string; seq: number }
  | { type: "stream:text"; sessionId: string; messageId: string; text: string }
  | { type: "stream:tool_use"; sessionId: string; messageId: string; tool: string; input: Record<string, unknown> }
  | { type: "stream:tool_result"; sessionId: string; messageId: string; tool: string; output: string; isError?: boolean }
  | { type: "stream:done"; sessionId: string; messageId: string }
  | { type: "status:busy"; sessionId: string; activity?: string }
  | { type: "status:idle"; sessionId: string }
  | { type: "error"; code: string; message: string; sessionId?: string };
```

---

## Implementation Plan

Build this in order. Each step ends with a commit.

### Phase 1: Daemon Foundation

**Step 1 — Project scaffolding & DB**
- Initialize `codepilot-daemon/` with `package.json`, `tsconfig.json`
- Install deps: `@anthropic-ai/claude-agent-sdk`, `ws`, `better-sqlite3`, `uuid`, `dotenv`
- Install dev deps: `typescript`, `tsx`, `@types/ws`, `@types/better-sqlite3`, `@types/uuid`
- Create `src/protocol.ts` with all shared types
- Create `src/db.ts` with SQLite schema creation and basic CRUD functions
- Create `.env.example` with `CODEPILOT_TOKEN`, `CODEPILOT_PORT`, `ANTHROPIC_API_KEY`, `DEV_DIR`
- **Commit**: `feat: scaffold daemon with protocol types and database layer`

**Step 2 — Project scanner**
- Create `src/project-scanner.ts`
- Scan the directory specified in `DEV_DIR` env var (default `~/dev`)
- Detect projects by looking for `.git/`, `package.json`, `Cargo.toml`, etc.
- Extract git branch, metadata
- Upsert results into `projects` table
- **Commit**: `feat: add project scanner for ~/dev/ directory`

**Step 3 — WebSocket server + auth**
- Create `src/ws-server.ts` and `src/auth.ts`
- Set up `ws` WebSocket server on configured port
- Implement auth: first message must be `{ type: "auth", token }`, verify against env var
- Handle `projects:list`, `projects:refresh` messages
- Create `src/index.ts` entry point that wires everything together
- Test with `wscat` or a simple script
- **Commit**: `feat: WebSocket server with auth and project listing`

**Step 4 — Session management (without SDK)**
- Create `src/session-manager.ts`
- Implement `sessions:list`, `sessions:create` handlers
- Implement `messages:history` handler (paginated, returns from SQLite)
- Implement `message:send` handler — for now, just persist the user message and return `message:ack`
- **Commit**: `feat: session and message management`

**Step 5 — Claude Agent SDK integration**
- Integrate the Claude Agent SDK `query()` function into session-manager
- When `message:send` is received:
  1. Persist user message to DB
  2. Send `message:ack` to client
  3. Send `status:busy` to client
  4. Call `query()` with the user's text, the project's `cwd`, and configured options
  5. Stream responses back:
     - `StreamEvent` with `content_block_delta` / `text_delta` → `stream:text`
     - `assistant` messages with tool use → `stream:tool_use` / `stream:tool_result`
     - `result` message → persist full assistant message, send `stream:done` + `status:idle`
  6. Save the SDK session ID for future resume
- Implement `message:interrupt` using `query.interrupt()`
- **Commit**: `feat: integrate Claude Agent SDK with streaming`

**Step 6 — systemd service + polish**
- Create `codepilot.service` systemd unit file
- Add graceful shutdown handling (SIGTERM)
- Add heartbeat/ping-pong for WebSocket connections
- Add basic logging (console with timestamps)
- Test full daemon flow end-to-end
- **Commit**: `feat: systemd service and production hardening`

### Phase 2: Mobile App Foundation

**Step 7 — App scaffolding**
- Create Expo app with `npx create-expo-app codepilot-app -t tabs`
- Set up Expo Router file structure as specified
- Install deps: `zustand`, `nativewind`, `tailwindcss`, `react-native-markdown-display`, `@react-native-async-storage/async-storage`
- Configure NativeWind/Tailwind
- Set up dark theme as default
- **Commit**: `feat: scaffold Expo app with routing and theme`

**Step 8 — Connection & WebSocket**
- Create `stores/connection.ts` Zustand store
- Create `hooks/useWebSocket.ts` with:
  - Connect/disconnect
  - Auto-reconnect with exponential backoff
  - Message queuing when disconnected
  - Heartbeat ping
  - Message routing to stores
- Create `lib/storage.ts` for persisting connection credentials
- Create `lib/protocol.ts` (copy from daemon)
- **Commit**: `feat: WebSocket connection hook with auto-reconnect`

**Step 9 — Connect screen**
- Build `app/(auth)/connect.tsx`
- Form with host, port, token fields
- Connect button with loading state
- Error display
- Auto-connect on app launch if credentials are saved
- **Commit**: `feat: connection setup screen`

**Step 10 — Project list screen**
- Create `stores/projects.ts`
- Build `components/ProjectCard.tsx`
- Build `app/(main)/projects/index.tsx`
  - Fetch project list on mount
  - Pull-to-refresh
  - Search/filter
  - Navigate to project detail on tap
- **Commit**: `feat: project list screen`

**Step 11 — Session list screen**
- Create `stores/sessions.ts`
- Build `components/SessionItem.tsx`
- Build `app/(main)/projects/[projectId]/index.tsx`
  - List sessions for the project
  - "New Session" button
  - Navigate to chat on tap
- **Commit**: `feat: session list screen`

### Phase 3: Chat Experience

**Step 12 — Chat screen basics**
- Create `stores/chat.ts`
- Build `components/ChatInput.tsx`
  - Multi-line input, grows up to 4 lines
  - Send button / stop button toggle
- Build `components/MessageBubble.tsx`
  - User messages: right-aligned bubble
  - Assistant messages: left-aligned, full-width, markdown rendered
- Build `app/(main)/projects/[projectId]/[sessionId].tsx`
  - FlatList of messages
  - Load history on mount
  - Send messages
  - Auto-scroll to bottom
- **Commit**: `feat: basic chat screen with message sending`

**Step 13 — Streaming support**
- Handle `stream:text` events in chat store → real-time text append
- Handle `stream:tool_use` and `stream:tool_result` events
- Build `components/StreamingText.tsx` for the in-progress message
- Auto-scroll behavior: scroll to bottom unless user has scrolled up
- Show "Thinking…" / activity indicator from `status:busy`
- **Commit**: `feat: real-time streaming in chat`

**Step 14 — Tool use display**
- Build `components/ToolUseBlock.tsx`
  - Collapsible card with icon + summary header
  - Different rendering per tool type
  - Collapsed by default
- Build `components/DiffBlock.tsx`
  - Simplified diff view for Edit/Write tool results
  - Green/red highlighting for additions/deletions
- Integrate into `MessageBubble.tsx`
- **Commit**: `feat: rich tool use display with collapsible blocks`

**Step 15 — Status bar & quick actions**
- Build `components/StatusBar.tsx`
  - Connection indicator
  - Claude activity indicator
  - Project name + branch
- Build `components/QuickActions.tsx`
  - Horizontally scrollable pills
  - Tap sends pre-defined prompt
- Integrate into chat screen layout
- **Commit**: `feat: status bar and quick action shortcuts`

### Phase 4: Polish

**Step 16 — Offline handling & message queue**
- Implement message queuing in WebSocket hook
- Show "Reconnecting…" banner in UI
- On reconnect, fetch missed messages via `messages:history`
- Sync queue on reconnect
- **Commit**: `feat: offline support with message queuing`

**Step 17 — Settings screen**
- Build `app/(main)/settings.tsx`
  - Edit connection settings
  - Model selector (sonnet/opus/haiku)
  - Theme toggle
  - App version
- **Commit**: `feat: settings screen`

**Step 18 — Final polish**
- Loading states and skeletons for all lists
- Empty states with helpful messages
- Error boundary wrapper
- Haptic feedback on send
- Keyboard-aware scroll in chat
- Test on iOS and Android
- **Commit**: `feat: polish, loading states, and error handling`

---

## Design Guidelines

### Color System (Dark Theme Default)

```
Background:        #0A0A0F (near black with slight blue)
Surface:           #141420 (cards, input areas)
Surface Elevated:  #1E1E2E (modals, popovers)
Border:            #2A2A3C
Text Primary:      #E8E8F0
Text Secondary:    #8888A0
Text Muted:        #55556A
Accent:            #7C6BF0 (purple — primary actions)
Accent Hover:      #9585FF
Success:           #4ADE80 (green — connected, additions)
Warning:           #FBBF24 (yellow — reconnecting)
Error:             #F87171 (red — disconnected, errors, deletions)
User Bubble:       #7C6BF0 (accent purple)
User Bubble Text:  #FFFFFF
```

### Typography

- **App Font**: System default (SF Pro on iOS, Roboto on Android)
- **Code Font**: Menlo / monospace
- **Sizes**: 14px body, 16px headings in cards, 12px metadata/timestamps

### Component Patterns

- All cards: 12px border-radius, 1px border, subtle shadow
- Buttons: 8px border-radius, 44px minimum touch target
- Inputs: 12px border-radius, 44px height minimum
- Lists: 12px gap between items
- Chat bubbles: 16px border-radius, 12px padding
- Animations: keep minimal — 200ms ease for transitions, no spring physics

---

## What to Skip (for v1)

- **File browser**: Claude can navigate files via its tools. No need for a separate file browser.
- **Terminal emulator**: Same — Claude runs commands for you.
- **Multi-VPS support**: One VPS, one daemon. Keep it simple.
- **User accounts / multi-user**: This is a personal tool on a private tailnet.
- **Push notifications**: Not needed for v1. The app polls/streams when open.
- **Image/file attachments in messages**: Text-only for v1.
- **Session forking**: Nice to have but not essential.

---

## Environment Variables

### Daemon (`.env`)
```bash
CODEPILOT_TOKEN=your-secure-random-token
CODEPILOT_PORT=7777
ANTHROPIC_API_KEY=sk-ant-...
DEV_DIR=/home/your-username/dev
DEFAULT_MODEL=sonnet
```

### App
Connection settings are stored in AsyncStorage after first setup. No `.env` needed for the app itself.

---

## Notes for Claude Code

- **Start with the daemon.** Get it running and testable with `wscat` before touching the app.
- **Test each step.** After each commit, verify the new functionality works before moving on.
- **Use the V1 query() API** from `@anthropic-ai/claude-agent-sdk`, not the unstable V2 preview.
- **The protocol.ts file is the contract.** Both sides must agree on message shapes.
- **Don't over-engineer.** This is a personal tool. Prefer simplicity over abstraction.
- **Git commits matter.** Use conventional commit messages. Each step = one commit.
- **The daemon and app are separate npm projects** in sibling directories. Not a monorepo with workspaces — keep it simple.
