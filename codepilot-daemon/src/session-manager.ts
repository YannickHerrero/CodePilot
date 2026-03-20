import { WebSocket } from "ws";
import {
  createSession,
  getSessionsByProject,
  getSession,
  getMessages,
  createMessage,
  getProject,
} from "./db.js";
import { sendTo } from "./ws-server.js";
import type { ClientMessage } from "./protocol.js";

export function handleSessionsList(ws: WebSocket, msg: Extract<ClientMessage, { type: "sessions:list" }>): void {
  const sessions = getSessionsByProject(msg.projectId);
  sendTo(ws, { type: "sessions:data", projectId: msg.projectId, sessions });
}

export function handleSessionCreate(ws: WebSocket, msg: Extract<ClientMessage, { type: "sessions:create" }>): void {
  const project = getProject(msg.projectId);
  if (!project) {
    sendTo(ws, { type: "error", code: "PROJECT_NOT_FOUND", message: `Project not found: ${msg.projectId}` });
    return;
  }

  const session = createSession(msg.projectId, msg.title);
  sendTo(ws, { type: "session:created", session });
}

export function handleMessagesHistory(ws: WebSocket, msg: Extract<ClientMessage, { type: "messages:history" }>): void {
  const { messages, hasMore } = getMessages(msg.sessionId, msg.limit, msg.before);
  sendTo(ws, { type: "messages:data", sessionId: msg.sessionId, messages, hasMore });
}

export function handleMessageSend(ws: WebSocket, msg: Extract<ClientMessage, { type: "message:send" }>): void {
  const session = getSession(msg.sessionId);
  if (!session) {
    sendTo(ws, { type: "error", code: "SESSION_NOT_FOUND", message: `Session not found: ${msg.sessionId}` });
    return;
  }

  const message = createMessage(msg.sessionId, "user", { type: "text", text: msg.text });
  sendTo(ws, { type: "message:ack", sessionId: msg.sessionId, messageId: message.id, seq: message.seq });
}

export function handleMessageInterrupt(ws: WebSocket, msg: Extract<ClientMessage, { type: "message:interrupt" }>): void {
  // Will be implemented with SDK integration
  sendTo(ws, { type: "status:idle", sessionId: msg.sessionId });
}
