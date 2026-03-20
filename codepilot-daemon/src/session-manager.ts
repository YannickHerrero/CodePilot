import { WebSocket } from "ws";
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  createSession,
  getSessionsByProject,
  getSession,
  getMessages,
  createMessage,
  getProject,
  updateSessionSdkId,
  renameSession,
} from "./db.js";
import { sendTo, broadcast } from "./ws-server.js";
import type { ClientMessage, AssistantBlock } from "./protocol.js";

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "sonnet";

interface ActiveSession {
  sessionId: string;
  projectPath: string;
  sdkSessionId: string | null;
  queryInstance: Query | null;
  running: boolean;
}

const activeSessions = new Map<string, ActiveSession>();

export function handleSessionsList(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "sessions:list" }>,
): void {
  const sessions = getSessionsByProject(msg.projectId);
  sendTo(ws, { type: "sessions:data", projectId: msg.projectId, sessions });
}

export function handleSessionCreate(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "sessions:create" }>,
): void {
  const project = getProject(msg.projectId);
  if (!project) {
    sendTo(ws, {
      type: "error",
      code: "PROJECT_NOT_FOUND",
      message: `Project not found: ${msg.projectId}`,
    });
    return;
  }

  const session = createSession(msg.projectId, msg.title);
  sendTo(ws, { type: "session:created", session });
}

export function handleSessionRename(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "session:rename" }>,
): void {
  const session = renameSession(msg.sessionId, msg.title);
  if (session) {
    broadcast({ type: "session:renamed", session });
  } else {
    sendTo(ws, {
      type: "error",
      code: "SESSION_NOT_FOUND",
      message: `Session not found: ${msg.sessionId}`,
    });
  }
}

export function handleMessagesHistory(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "messages:history" }>,
): void {
  const { messages, hasMore } = getMessages(msg.sessionId, msg.limit, msg.before);
  sendTo(ws, { type: "messages:data", sessionId: msg.sessionId, messages, hasMore });
}

export function handleMessageSend(
  ws: WebSocket,
  msg: Extract<ClientMessage, { type: "message:send" }>,
): void {
  const session = getSession(msg.sessionId);
  if (!session) {
    sendTo(ws, {
      type: "error",
      code: "SESSION_NOT_FOUND",
      message: `Session not found: ${msg.sessionId}`,
    });
    return;
  }

  const project = getProject(session.projectId);
  if (!project) {
    sendTo(ws, {
      type: "error",
      code: "PROJECT_NOT_FOUND",
      message: `Project not found: ${session.projectId}`,
    });
    return;
  }

  // Persist user message
  const userMessage = createMessage(msg.sessionId, "user", { type: "text", text: msg.text });
  sendTo(ws, {
    type: "message:ack",
    sessionId: msg.sessionId,
    messageId: userMessage.id,
    seq: userMessage.seq,
  });

  // Check if there's already an active query for this session
  const existing = activeSessions.get(msg.sessionId);
  if (existing?.running) {
    sendTo(ws, {
      type: "error",
      code: "SESSION_BUSY",
      message: "Session is already processing a message",
      sessionId: msg.sessionId,
    });
    return;
  }

  // Start agent query
  startAgentSession(msg.sessionId, msg.text, project.path, session.sdkSessionId);
}

export function handleMessageInterrupt(
  _ws: WebSocket,
  msg: Extract<ClientMessage, { type: "message:interrupt" }>,
): void {
  const active = activeSessions.get(msg.sessionId);
  if (active?.running && active.queryInstance) {
    active.queryInstance.interrupt().catch((err) => {
      console.error(`[codepilot] Interrupt error for session ${msg.sessionId}:`, err);
    });
  }
}

async function startAgentSession(
  sessionId: string,
  text: string,
  projectPath: string,
  existingSdkSessionId: string | null,
): Promise<void> {
  const activeSession: ActiveSession = {
    sessionId,
    projectPath,
    sdkSessionId: existingSdkSessionId,
    queryInstance: null,
    running: true,
  };
  activeSessions.set(sessionId, activeSession);

  broadcast({ type: "status:busy", sessionId, activity: "Thinking..." });

  const assistantMessageId = uuidv4();
  const blocks: AssistantBlock[] = [];
  let currentTextBlock: { type: "text"; text: string } | null = null;

  try {
    const options: Record<string, unknown> = {
      cwd: projectPath,
      allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "WebSearch"],
      permissionMode: "acceptEdits",
      model: DEFAULT_MODEL,
      includePartialMessages: true,
    };

    if (existingSdkSessionId) {
      options.resume = existingSdkSessionId;
    }

    const q = query({ prompt: text, options });
    activeSession.queryInstance = q;

    for await (const message of q) {
      // System init message — capture SDK session ID
      if (message.type === "system") {
        const sys = message as Record<string, unknown>;
        if (sys.subtype === "init" && sys.session_id) {
          activeSession.sdkSessionId = sys.session_id as string;
          updateSessionSdkId(sessionId, sys.session_id as string);
        }
        continue;
      }

      // Stream events (partial messages) for real-time streaming
      if (message.type === "stream_event") {
        const evt = message as Record<string, unknown>;
        const event = evt.event as Record<string, unknown>;
        if (!event) continue;

        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown>;
          if (delta?.type === "text_delta") {
            const deltaText = delta.text as string;
            broadcast({ type: "stream:text", sessionId, messageId: assistantMessageId, text: deltaText });

            if (!currentTextBlock) {
              currentTextBlock = { type: "text", text: "" };
              blocks.push(currentTextBlock);
            }
            currentTextBlock.text += deltaText;
          }
        }
        continue;
      }

      // Assistant message — contains tool use blocks and text
      if (message.type === "assistant") {
        const assistant = message as Record<string, unknown>;
        const content = assistant.content as Array<Record<string, unknown>> | undefined;
        if (!content) continue;

        for (const block of content) {
          if (block.type === "tool_use") {
            currentTextBlock = null;
            const toolBlock: AssistantBlock = {
              type: "tool_use",
              id: (block.id as string) || uuidv4(),
              tool: block.name as string,
              input: (block.input as Record<string, unknown>) || {},
            };
            blocks.push(toolBlock);
            broadcast({
              type: "stream:tool_use",
              sessionId,
              messageId: assistantMessageId,
              tool: toolBlock.tool,
              input: toolBlock.input,
            });

            const activity = getToolActivity(toolBlock.tool, toolBlock.input);
            broadcast({ type: "status:busy", sessionId, activity });
          } else if (block.type === "tool_result") {
            currentTextBlock = null;
            const toolUseId = block.tool_use_id as string;
            const matchingTool = blocks.find(
              (b) => b.type === "tool_use" && b.id === toolUseId,
            );
            const toolName =
              matchingTool && matchingTool.type === "tool_use" ? matchingTool.tool : "unknown";
            const output =
              typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content ?? "");
            const resultBlock: AssistantBlock = {
              type: "tool_result",
              id: toolUseId || uuidv4(),
              tool: toolName,
              output,
              isError: (block.is_error as boolean) || false,
            };
            blocks.push(resultBlock);
            broadcast({
              type: "stream:tool_result",
              sessionId,
              messageId: assistantMessageId,
              tool: resultBlock.tool,
              output: resultBlock.output,
              isError: resultBlock.isError,
            });
          } else if (block.type === "text") {
            const blockText = block.text as string;
            if (blockText && !currentTextBlock?.text) {
              currentTextBlock = { type: "text", text: blockText };
              blocks.push(currentTextBlock);
              broadcast({
                type: "stream:text",
                sessionId,
                messageId: assistantMessageId,
                text: blockText,
              });
            }
          }
        }
        continue;
      }

      // Tool progress — forward activity
      if (message.type === "tool_progress") {
        continue;
      }

      // Result message — query complete
      if (message.type === "result") {
        const result = message as Record<string, unknown>;
        if (result.session_id) {
          activeSession.sdkSessionId = result.session_id as string;
          updateSessionSdkId(sessionId, result.session_id as string);
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[codepilot] SDK error for session ${sessionId}:`, errorMsg);
    broadcast({
      type: "error",
      code: "SDK_ERROR",
      message: errorMsg,
      sessionId,
    });
  } finally {
    if (blocks.length > 0) {
      createMessage(sessionId, "assistant", blocks);
    }

    activeSession.running = false;
    activeSession.queryInstance = null;
    broadcast({ type: "stream:done", sessionId, messageId: assistantMessageId });
    broadcast({ type: "status:idle", sessionId });

    // Generate title for new sessions (async, non-blocking)
    const currentSession = getSession(sessionId);
    if (currentSession && !currentSession.title && blocks.length > 0) {
      const assistantText = blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      generateSessionTitle(sessionId, text, assistantText).catch(() => {});
    }
  }
}

function getToolActivity(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case "Read":
      return `Reading ${(input.file_path as string) || "file"}...`;
    case "Write":
      return `Writing ${(input.file_path as string) || "file"}...`;
    case "Edit":
    case "MultiEdit":
      return `Editing ${(input.file_path as string) || "file"}...`;
    case "Bash":
      return `Running command...`;
    case "Glob":
      return `Searching files...`;
    case "Grep":
      return `Searching content...`;
    case "WebSearch":
      return `Searching the web...`;
    default:
      return `Using ${tool}...`;
  }
}

async function generateSessionTitle(
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<void> {
  const session = getSession(sessionId);
  if (!session || session.title) {
    return; // Already has a title or session doesn't exist
  }

  try {
    const titlePrompt = `Based on this conversation, generate a very short title (3-6 words, no quotes, no punctuation at the end). Just output the title, nothing else.

User: ${userMessage.slice(0, 500)}
Assistant: ${assistantResponse.slice(0, 500)}`;

    let generatedTitle = "";

    for await (const message of query({ prompt: titlePrompt, options: { model: "haiku" } })) {
      if (message.type === "assistant") {
        const content = (message as Record<string, unknown>).content as Array<Record<string, unknown>> | undefined;
        if (content) {
          for (const block of content) {
            if (block.type === "text") {
              generatedTitle += block.text as string;
            }
          }
        }
      }
    }

    const title = generatedTitle.trim().replace(/^["']|["']$/g, "").slice(0, 100);
    if (title) {
      const updatedSession = renameSession(sessionId, title);
      if (updatedSession) {
        broadcast({ type: "session:renamed", session: updatedSession });
      }
    }
  } catch (err) {
    console.error(`[codepilot] Failed to generate session title:`, err);
    // Silently fail - title generation is not critical
  }
}

export function cleanupActiveSessions(): void {
  for (const [, session] of activeSessions) {
    if (session.running && session.queryInstance) {
      session.queryInstance.interrupt().catch(() => {});
    }
  }
  activeSessions.clear();
}
