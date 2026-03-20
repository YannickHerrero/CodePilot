import type {
  ClientMessage,
  DaemonMessage,
  Project,
  Session,
  Message,
  AssistantBlock,
} from "@/lib/protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEMO_HOST = "demo.codepilot.local";

export function isDemoHost(host: string): boolean {
  return host.trim().toLowerCase() === DEMO_HOST;
}

// ---------------------------------------------------------------------------
// Mock projects
// ---------------------------------------------------------------------------

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_1",
    name: "codepilot-web",
    path: "/home/user/dev/codepilot-web",
    gitBranch: "main",
    lastOpenedAt: "2026-03-19T14:30:00Z",
    metadata: {
      description: "CodePilot marketing site & docs",
      gitRemote: "github.com/acme/codepilot-web",
      framework: "Next.js",
    },
  },
  {
    id: "proj_2",
    name: "api-server",
    path: "/home/user/dev/api-server",
    gitBranch: "feat/auth-v2",
    lastOpenedAt: "2026-03-18T10:15:00Z",
    metadata: {
      description: "REST + WebSocket API backend",
      gitRemote: "github.com/acme/api-server",
      framework: "Express",
    },
  },
  {
    id: "proj_3",
    name: "mobile-app",
    path: "/home/user/dev/mobile-app",
    gitBranch: "develop",
    lastOpenedAt: "2026-03-17T09:00:00Z",
    metadata: {
      description: "Cross-platform mobile client",
      gitRemote: "github.com/acme/mobile-app",
      framework: "React Native",
    },
  },
];

// ---------------------------------------------------------------------------
// Mock sessions
// ---------------------------------------------------------------------------

const MOCK_SESSIONS: Record<string, Session[]> = {
  proj_1: [
    {
      id: "sess_1a",
      projectId: "proj_1",
      sdkSessionId: null,
      title: "Fix dark mode toggle on landing page",
      createdAt: "2026-03-19T14:30:00Z",
      updatedAt: "2026-03-19T15:10:00Z",
      messageCount: 6,
      lastMessagePreview: "The dark mode toggle is now working correctly across all pages.",
    },
    {
      id: "sess_1b",
      projectId: "proj_1",
      sdkSessionId: null,
      title: "Add pricing comparison table",
      createdAt: "2026-03-18T11:00:00Z",
      updatedAt: "2026-03-18T12:45:00Z",
      messageCount: 4,
      lastMessagePreview: "I've created a responsive pricing table component.",
    },
  ],
  proj_2: [
    {
      id: "sess_2a",
      projectId: "proj_2",
      sdkSessionId: null,
      title: "Implement JWT refresh token rotation",
      createdAt: "2026-03-18T10:15:00Z",
      updatedAt: "2026-03-18T11:50:00Z",
      messageCount: 8,
      lastMessagePreview: "Token rotation is implemented with a 7-day sliding window.",
    },
  ],
  proj_3: [
    {
      id: "sess_3a",
      projectId: "proj_3",
      sdkSessionId: null,
      title: "Debug push notification crash on Android",
      createdAt: "2026-03-17T09:00:00Z",
      updatedAt: "2026-03-17T10:30:00Z",
      messageCount: 5,
      lastMessagePreview: "The crash was caused by a missing channel ID on Android 13+.",
    },
    {
      id: "sess_3b",
      projectId: "proj_3",
      sdkSessionId: null,
      title: "Refactor navigation to Expo Router",
      createdAt: "2026-03-16T16:00:00Z",
      updatedAt: "2026-03-16T17:20:00Z",
      messageCount: 3,
      lastMessagePreview: "Migration to file-based routing is complete.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock message histories
// ---------------------------------------------------------------------------

function makeMsg(
  id: string,
  sessionId: string,
  role: "user" | "assistant",
  content: Message["content"],
  seq: number,
  minutesAgo: number,
): Message {
  return {
    id,
    sessionId,
    role,
    content,
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    seq,
  };
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  sess_1a: [
    makeMsg("m1a_1", "sess_1a", "user", { type: "text", text: "The dark mode toggle on the landing page doesn't persist when navigating between pages. Can you investigate?" }, 1, 40),
    makeMsg("m1a_2", "sess_1a", "assistant", [
      { type: "text", text: "Let me look at the dark mode implementation." },
      { type: "tool_use", id: "tu_1", tool: "Read", input: { file_path: "src/components/ThemeToggle.tsx" } },
      { type: "tool_result", id: "tr_1", tool: "Read", output: "export function ThemeToggle() {\n  const [dark, setDark] = useState(false);\n  // ...\n}" },
      { type: "text", text: "Found the issue — the toggle uses local `useState` instead of the global theme context. The state resets on every page navigation.\n\nI'll update it to use `useTheme()` from your context provider:\n\n```tsx\nexport function ThemeToggle() {\n  const { theme, setTheme } = useTheme();\n  return (\n    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>\n      {theme === 'dark' ? '☀️' : '🌙'}\n    </button>\n  );\n}\n```\n\nThis way the theme persists across navigations since it's stored in context (and synced to `localStorage`)." },
    ], 2, 38),
    makeMsg("m1a_3", "sess_1a", "user", { type: "text", text: "That fixed it, thanks!" }, 3, 30),
    makeMsg("m1a_4", "sess_1a", "assistant", [
      { type: "text", text: "You're welcome! The dark mode toggle is now working correctly across all pages." },
    ], 4, 29),
  ],
  sess_2a: [
    makeMsg("m2a_1", "sess_2a", "user", { type: "text", text: "We need to implement JWT refresh token rotation for the auth-v2 feature branch. The current implementation uses static refresh tokens." }, 1, 90),
    makeMsg("m2a_2", "sess_2a", "assistant", [
      { type: "text", text: "I'll review the current auth implementation first." },
      { type: "tool_use", id: "tu_2", tool: "Read", input: { file_path: "src/middleware/auth.ts" } },
      { type: "tool_result", id: "tr_2", tool: "Read", output: "export async function verifyToken(req, res, next) {\n  const token = req.headers.authorization?.split(' ')[1];\n  // static refresh token check\n  if (!token) return res.status(401).json({ error: 'No token' });\n  // ...\n}" },
      { type: "text", text: "Here's the plan for implementing refresh token rotation:\n\n1. **On login** — generate both access token (15min) and refresh token (7 days), store refresh token hash in DB\n2. **On refresh** — validate current refresh token, issue new pair, invalidate old refresh token\n3. **Reuse detection** — if an already-invalidated refresh token is used, revoke the entire token family\n\nThis prevents token theft since stolen refresh tokens become single-use." },
    ], 2, 88),
  ],
  sess_3a: [
    makeMsg("m3a_1", "sess_3a", "user", { type: "text", text: "The app crashes on Android 13 when receiving a push notification in the background. No crash on iOS." }, 1, 120),
    makeMsg("m3a_2", "sess_3a", "assistant", [
      { type: "text", text: "Android 13+ requires a notification channel to be created before posting notifications. Let me check your notification setup." },
      { type: "tool_use", id: "tu_3", tool: "Grep", input: { pattern: "createChannel|notification_channel", path: "src/" } },
      { type: "tool_result", id: "tr_3", tool: "Grep", output: "src/services/notifications.ts:  // TODO: add channel for Android 13+" },
      { type: "text", text: "Found it — there's a TODO but no actual channel creation. On Android 13+, posting a notification without a channel causes a crash.\n\nAdd this to your notification initialization:\n\n```typescript\nimport * as Notifications from 'expo-notifications';\n\nif (Platform.OS === 'android') {\n  Notifications.setNotificationChannelAsync('default', {\n    name: 'Default',\n    importance: Notifications.AndroidImportance.HIGH,\n    vibrationPattern: [0, 250, 250, 250],\n  });\n}\n```\n\nThis needs to run before any notification is received, ideally in your app initialization." },
    ], 2, 118),
  ],
};

// ---------------------------------------------------------------------------
// Canned streaming responses (3 rotating)
// ---------------------------------------------------------------------------

interface CannedResponse {
  text: string;
  toolUse?: { tool: string; input: Record<string, unknown> };
  toolResult?: { tool: string; output: string };
  textAfterTool?: string;
}

const CANNED_RESPONSES: CannedResponse[] = [
  {
    text: "Let me investigate that for you.\n\nLooking at the code, the issue appears to be in the event handler registration. The listener is attached inside the render function, which means it gets duplicated on every re-render.\n\n**Solution:** Move the event listener into a `useEffect` with a cleanup return to prevent duplicates:\n\n```typescript\nuseEffect(() => {\n  const handler = (e: Event) => handleUpdate(e);\n  window.addEventListener('update', handler);\n  return () => window.removeEventListener('update', handler);\n}, []);\n```\n\nThis ensures only one listener is active at a time.",
  },
  {
    text: "I'll take a look at the relevant file first.",
    toolUse: { tool: "Read", input: { file_path: "src/utils/validate.ts" } },
    toolResult: {
      tool: "Read",
      output: "export function validate(input: string): boolean {\n  return input.length > 0 && input.length < 256;\n}",
    },
    textAfterTool: "The validation function is too permissive — it only checks length but doesn't sanitize input. Here's an improved version:\n\n```typescript\nexport function validate(input: string): boolean {\n  if (!input || input.length > 255) return false;\n  // Strip control characters and validate UTF-8\n  const sanitized = input.replace(/[\\x00-\\x1f]/g, '');\n  return sanitized.length > 0;\n}\n```\n\nThis adds control character stripping and handles empty-after-sanitize cases.",
  },
  {
    text: "Here's an overview of the project structure:\n\n## Directory Layout\n\n- **`src/`** — Application source code\n  - `components/` — Reusable UI components\n  - `hooks/` — Custom React hooks\n  - `lib/` — Utility functions and shared logic\n  - `stores/` — Zustand state management\n  - `app/` — File-based routing (Expo Router)\n- **`assets/`** — Static images, fonts, and icons\n- **`scripts/`** — Build and deployment helpers\n\n## Key Patterns\n\n1. **State management** via Zustand with pub/sub message handlers\n2. **WebSocket transport** for real-time daemon communication\n3. **File-based routing** with Expo Router layout groups\n\nThe architecture follows a clean separation between transport (WebSocket), state (stores), and presentation (components).",
  },
];

// ---------------------------------------------------------------------------
// Streaming simulation
// ---------------------------------------------------------------------------

const STREAM_CHUNK_SIZE = 12;
const STREAM_CHUNK_DELAY_MS = 30;

type DispatchFn = (msg: DaemonMessage) => void;

interface StreamingState {
  timers: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
}

function streamResponse(
  dispatch: DispatchFn,
  sessionId: string,
  messageId: string,
  response: CannedResponse,
  streaming: StreamingState,
): void {
  const schedule = (fn: () => void, delay: number) => {
    if (streaming.cancelled) return;
    const t = setTimeout(() => {
      if (streaming.cancelled) return;
      fn();
    }, delay);
    streaming.timers.push(t);
  };

  let delay = 0;

  // Stream main text
  for (let i = 0; i < response.text.length; i += STREAM_CHUNK_SIZE) {
    const chunk = response.text.slice(i, i + STREAM_CHUNK_SIZE);
    schedule(() => {
      dispatch({ type: "stream:text", sessionId, messageId, text: chunk });
    }, delay);
    delay += STREAM_CHUNK_DELAY_MS;
  }

  // Tool use / result if present
  if (response.toolUse) {
    delay += 100; // brief pause before tool
    schedule(() => {
      dispatch({
        type: "stream:tool_use",
        sessionId,
        messageId,
        tool: response.toolUse!.tool,
        input: response.toolUse!.input,
      });
    }, delay);

    delay += 400; // simulate tool execution time
    schedule(() => {
      dispatch({
        type: "stream:tool_result",
        sessionId,
        messageId,
        tool: response.toolResult!.tool,
        output: response.toolResult!.output,
      });
    }, delay);

    // Stream text after tool
    if (response.textAfterTool) {
      delay += 100;
      for (let i = 0; i < response.textAfterTool.length; i += STREAM_CHUNK_SIZE) {
        const chunk = response.textAfterTool.slice(i, i + STREAM_CHUNK_SIZE);
        schedule(() => {
          dispatch({ type: "stream:text", sessionId, messageId, text: chunk });
        }, delay);
        delay += STREAM_CHUNK_DELAY_MS;
      }
    }
  }

  // Done
  delay += 50;
  schedule(() => {
    dispatch({ type: "stream:done", sessionId, messageId });
    dispatch({ type: "status:idle", sessionId });
  }, delay);
}

// ---------------------------------------------------------------------------
// Demo message router
// ---------------------------------------------------------------------------

let responseIndex = 0;
let sessionCounter = 0;

// Track dynamically created sessions so they persist within a demo session
const dynamicSessions: Record<string, Session[]> = {};

export function startDemoMode(dispatch: DispatchFn): {
  sendMessage: (msg: ClientMessage) => void;
  cleanup: () => void;
} {
  let activeStream: StreamingState | null = null;

  function cancelActiveStream(): void {
    if (activeStream) {
      activeStream.cancelled = true;
      for (const t of activeStream.timers) clearTimeout(t);
      activeStream = null;
    }
  }

  function getAllSessions(projectId: string): Session[] {
    const base = MOCK_SESSIONS[projectId] || [];
    const dynamic = dynamicSessions[projectId] || [];
    return [...dynamic, ...base];
  }

  function handleMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case "auth": {
        setTimeout(() => dispatch({ type: "auth:result", success: true }), 50);
        break;
      }

      case "projects:list":
      case "projects:refresh": {
        setTimeout(() => dispatch({ type: "projects:data", projects: MOCK_PROJECTS }), 80);
        break;
      }

      case "sessions:list": {
        const sessions = getAllSessions(msg.projectId);
        setTimeout(
          () => dispatch({ type: "sessions:data", projectId: msg.projectId, sessions }),
          60,
        );
        break;
      }

      case "sessions:create": {
        sessionCounter++;
        const newSession: Session = {
          id: `sess_demo_${sessionCounter}`,
          projectId: msg.projectId,
          sdkSessionId: null,
          title: msg.title || "New session",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          lastMessagePreview: undefined,
        };
        if (!dynamicSessions[msg.projectId]) {
          dynamicSessions[msg.projectId] = [];
        }
        dynamicSessions[msg.projectId].unshift(newSession);
        setTimeout(() => dispatch({ type: "session:created", session: newSession }), 60);
        break;
      }

      case "messages:history": {
        const messages = MOCK_MESSAGES[msg.sessionId] || [];
        // Messages are stored oldest-first (ascending seq) — same as daemon
        setTimeout(
          () =>
            dispatch({
              type: "messages:data",
              sessionId: msg.sessionId,
              messages,
              hasMore: false,
            }),
          60,
        );
        break;
      }

      case "message:send": {
        cancelActiveStream();

        const userMsgId = `demo_user_${Date.now()}`;
        const assistantMsgId = `demo_asst_${Date.now()}`;

        // Ack the user message
        setTimeout(() => {
          dispatch({ type: "message:ack", sessionId: msg.sessionId, messageId: userMsgId, seq: Date.now() });
        }, 30);

        // Mark busy
        setTimeout(() => {
          dispatch({ type: "status:busy", sessionId: msg.sessionId, activity: "Thinking..." });
        }, 60);

        // Start streaming
        const response = CANNED_RESPONSES[responseIndex % CANNED_RESPONSES.length];
        responseIndex++;

        activeStream = { timers: [], cancelled: false };
        const streamState = activeStream;

        setTimeout(() => {
          streamResponse(dispatch, msg.sessionId, assistantMsgId, response, streamState);
        }, 200);

        break;
      }

      case "message:interrupt": {
        cancelActiveStream();
        setTimeout(() => dispatch({ type: "status:idle", sessionId: msg.sessionId }), 30);
        break;
      }
    }
  }

  return {
    sendMessage: handleMessage,
    cleanup: () => {
      cancelActiveStream();
      // Clear dynamic sessions on full cleanup
      for (const key of Object.keys(dynamicSessions)) {
        delete dynamicSessions[key];
      }
      sessionCounter = 0;
      responseIndex = 0;
    },
  };
}
