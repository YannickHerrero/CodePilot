import { WebSocketServer, WebSocket } from "ws";
import { validateToken } from "./auth.js";
import {
  getAllProjects,
  getProject,
  getServicesByProject,
  getService,
  createService as dbCreateService,
  updateService as dbUpdateService,
  deleteService as dbDeleteService,
} from "./db.js";
import { refreshProjects, createProject } from "./project-scanner.js";
import {
  handleSessionsList,
  handleSessionCreate,
  handleSessionRename,
  handleMessagesHistory,
  handleMessageSend,
  handleMessageInterrupt,
} from "./session-manager.js";
import {
  setBroadcast,
  setSendTo,
  startInstance,
  stopInstance,
  subscribe,
  unsubscribe,
  cleanupSubscriber,
  getInstancesForService,
  getInstanceServiceId,
} from "./service-manager.js";
import { log, error as logError } from "./logger.js";
import type { ClientMessage, DaemonMessage, ServiceWithInstances } from "./protocol.js";

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
  // Wire up service-manager callbacks
  setBroadcast(broadcast);
  setSendTo(sendTo);

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
      cleanupSubscriber(ws);
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

    case "session:rename":
      handleSessionRename(ws, msg);
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

    // === Service Messages ===

    case "services:list":
      handleServicesList(ws, msg);
      break;

    case "service:create":
      handleServiceCreate(ws, msg);
      break;

    case "service:update":
      handleServiceUpdate(ws, msg);
      break;

    case "service:delete":
      handleServiceDelete(ws, msg);
      break;

    // === Instance Messages ===

    case "instance:start":
      handleInstanceStart(ws, msg);
      break;

    case "instance:stop":
      handleInstanceStop(ws, msg);
      break;

    case "instance:subscribe":
      handleInstanceSubscribe(ws, msg);
      break;

    case "instance:unsubscribe":
      handleInstanceUnsubscribe(ws, msg);
      break;

    default:
      sendTo(ws, {
        type: "error",
        code: "UNKNOWN_MESSAGE",
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
  }
}

// === Service Handlers ===

function handleServicesList(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "services:list" }>,
): void {
  const services = getServicesByProject(msg.projectId);
  const servicesWithInstances: ServiceWithInstances[] = services.map((service) => ({
    service,
    instances: getInstancesForService(service.id),
  }));
  sendTo(ws, { type: "services:data", projectId: msg.projectId, services: servicesWithInstances });
}

function handleServiceCreate(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "service:create" }>,
): void {
  const project = getProject(msg.projectId);
  if (!project) {
    sendTo(ws, { type: "error", code: "PROJECT_NOT_FOUND", message: "Project not found" });
    return;
  }

  const service = dbCreateService(msg.projectId, msg.name, msg.command);
  broadcast({ type: "service:created", service });
}

function handleServiceUpdate(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "service:update" }>,
): void {
  const service = dbUpdateService(msg.serviceId, {
    name: msg.name,
    command: msg.command,
  });

  if (!service) {
    sendTo(ws, { type: "error", code: "SERVICE_NOT_FOUND", message: "Service not found" });
    return;
  }

  broadcast({ type: "service:updated", service });
}

function handleServiceDelete(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "service:delete" }>,
): void {
  // Check if there are running instances
  const instances = getInstancesForService(msg.serviceId);
  const runningInstances = instances.filter((i) => i.status === "running" || i.status === "stopping");
  if (runningInstances.length > 0) {
    sendTo(ws, {
      type: "error",
      code: "SERVICE_HAS_RUNNING_INSTANCES",
      message: "Cannot delete service with running instances",
    });
    return;
  }

  const deleted = dbDeleteService(msg.serviceId);
  if (!deleted) {
    sendTo(ws, { type: "error", code: "SERVICE_NOT_FOUND", message: "Service not found" });
    return;
  }

  broadcast({ type: "service:deleted", serviceId: msg.serviceId });
}

// === Instance Handlers ===

function handleInstanceStart(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "instance:start" }>,
): void {
  const service = getService(msg.serviceId);
  if (!service) {
    sendTo(ws, { type: "error", code: "SERVICE_NOT_FOUND", message: "Service not found" });
    return;
  }

  const project = getProject(service.projectId);
  if (!project) {
    sendTo(ws, { type: "error", code: "PROJECT_NOT_FOUND", message: "Project not found" });
    return;
  }

  const instance = startInstance(service, project.path);
  broadcast({ type: "instance:started", instance, serviceId: service.id });
}

function handleInstanceStop(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "instance:stop" }>,
): void {
  const stopped = stopInstance(msg.instanceId);
  if (!stopped) {
    sendTo(ws, { type: "error", code: "INSTANCE_NOT_FOUND", message: "Instance not found or not running" });
  }
  // The instance:stopped message will be broadcast when the process actually exits
}

function handleInstanceSubscribe(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "instance:subscribe" }>,
): void {
  const subscribed = subscribe(msg.instanceId, ws);
  if (!subscribed) {
    sendTo(ws, { type: "error", code: "INSTANCE_NOT_FOUND", message: "Instance not found" });
  }
  // The instance:buffer message is sent by subscribe() directly
}

function handleInstanceUnsubscribe(
  _ws: WebSocket,
  msg: Extract<ClientMessage, { type: "instance:unsubscribe" }>,
): void {
  unsubscribe(msg.instanceId, _ws);
}
