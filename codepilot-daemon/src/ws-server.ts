import { WebSocketServer, WebSocket } from "ws";
import { validateToken } from "./auth.js";
import { getAllProjects } from "./db.js";
import { refreshProjects, createProject } from "./project-scanner.js";
import {
  handleSessionsList,
  handleSessionCreate,
  handleMessagesHistory,
  handleMessageSend,
  handleMessageInterrupt,
} from "./session-manager.js";
import { log, error as logError } from "./logger.js";
import type { ClientMessage, DaemonMessage } from "./protocol.js";

interface ClientState {
  authenticated: boolean;
  authTimeout: ReturnType<typeof setTimeout> | null;
  alive: boolean;
}

const clients = new Map<WebSocket, ClientState>();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

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
      alive: true,
      authTimeout: setTimeout(() => {
        if (!state.authenticated) {
          sendTo(ws, { type: "auth:result", success: false, error: "Auth timeout" });
          ws.close();
        }
      }, 10_000),
    };
    clients.set(ws, state);

    ws.on("pong", () => {
      state.alive = true;
    });

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
      logError("WebSocket error", err);
    });
  });

  // Heartbeat: ping all clients every 30s, terminate unresponsive ones
  heartbeatInterval = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, 30_000);

  log(`WebSocket server listening on port ${port}`);
  return wss;
}

export function stopWSServer(wss: WebSocketServer): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  for (const [ws] of clients) {
    ws.close();
  }
  clients.clear();
  return new Promise((resolve, reject) => {
    wss.close((err) => (err ? reject(err) : resolve()));
  });
}

function handleAuth(ws: WebSocket, state: ClientState, token: string): void {
  if (validateToken(token)) {
    state.authenticated = true;
    if (state.authTimeout) {
      clearTimeout(state.authTimeout);
      state.authTimeout = null;
    }
    sendTo(ws, { type: "auth:result", success: true });
    log("Client authenticated");
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

    case "projects:create":
      createProject(devDir, msg.name)
        .then((project) => {
          sendTo(ws, { type: "project:created", project });
        })
        .catch((err) => {
          sendTo(ws, {
            type: "error",
            code: "PROJECT_CREATE_FAILED",
            message: err instanceof Error ? err.message : "Failed to create project",
          });
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
