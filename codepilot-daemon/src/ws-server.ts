import { WebSocketServer, WebSocket } from "ws";
import { validateToken } from "./auth.js";
import { getAllProjects } from "./db.js";
import { refreshProjects } from "./project-scanner.js";
import {
  handleSessionsList,
  handleSessionCreate,
  handleMessagesHistory,
  handleMessageSend,
  handleMessageInterrupt,
} from "./session-manager.js";
import type { ClientMessage, DaemonMessage } from "./protocol.js";

interface ClientState {
  authenticated: boolean;
  authTimeout: ReturnType<typeof setTimeout> | null;
}

const clients = new Map<WebSocket, ClientState>();

let devDir = process.env.DEV_DIR || `${process.env.HOME}/dev`;

export function setDevDir(dir: string) {
  devDir = dir;
}

export function sendTo(ws: WebSocket, msg: DaemonMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcast(msg: DaemonMessage): void {
  for (const [ws, state] of clients) {
    if (state.authenticated) {
      sendTo(ws, msg);
    }
  }
}

export function startWSServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    const state: ClientState = {
      authenticated: false,
      authTimeout: setTimeout(() => {
        if (!state.authenticated) {
          sendTo(ws, { type: "auth:result", success: false, error: "Auth timeout" });
          ws.close();
        }
      }, 10_000),
    };
    clients.set(ws, state);

    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendTo(ws, { type: "error", code: "INVALID_JSON", message: "Invalid JSON" });
        return;
      }

      if (!state.authenticated) {
        if (msg.type === "auth") {
          handleAuth(ws, state, msg.token);
        } else {
          sendTo(ws, { type: "error", code: "NOT_AUTHENTICATED", message: "Authenticate first" });
        }
        return;
      }

      handleMessage(ws, msg);
    });

    ws.on("close", () => {
      if (state.authTimeout) clearTimeout(state.authTimeout);
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("[codepilot] WebSocket error:", err.message);
    });
  });

  console.log(`[codepilot] WebSocket server listening on port ${port}`);
  return wss;
}

function handleAuth(ws: WebSocket, state: ClientState, token: string): void {
  if (validateToken(token)) {
    state.authenticated = true;
    if (state.authTimeout) {
      clearTimeout(state.authTimeout);
      state.authTimeout = null;
    }
    sendTo(ws, { type: "auth:result", success: true });
    console.log("[codepilot] Client authenticated");
  } else {
    sendTo(ws, { type: "auth:result", success: false, error: "Invalid token" });
    ws.close();
  }
}

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case "projects:list":
      sendTo(ws, { type: "projects:data", projects: getAllProjects() });
      break;

    case "projects:refresh":
      refreshProjects(devDir).then(() => {
        sendTo(ws, { type: "projects:data", projects: getAllProjects() });
      });
      break;

    case "sessions:list":
      handleSessionsList(ws, msg);
      break;

    case "sessions:create":
      handleSessionCreate(ws, msg);
      break;

    case "messages:history":
      handleMessagesHistory(ws, msg);
      break;

    case "message:send":
      handleMessageSend(ws, msg);
      break;

    case "message:interrupt":
      handleMessageInterrupt(ws, msg);
      break;

    default:
      sendTo(ws, {
        type: "error",
        code: "UNKNOWN_MESSAGE",
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
  }
}
