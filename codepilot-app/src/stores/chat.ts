import { create } from "zustand";
import type { Message, AssistantBlock, DaemonMessage } from "@/lib/protocol";
import { sendMessage, addMessageHandler } from "@/hooks/useWebSocket";

export interface StreamingMessage {
  id: string;
  sessionId: string;
  blocks: AssistantBlock[];
}

interface ChatState {
  messagesBySession: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  streamingMessage: StreamingMessage | null;
  busySessionId: string | null;
  activity: string | null;
  fetchMessages: (sessionId: string, before?: string) => void;
  sendUserMessage: (sessionId: string, text: string) => void;
  interruptSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesBySession: {},
  hasMore: {},
  streamingMessage: null,
  busySessionId: null,
  activity: null,

  fetchMessages: (sessionId, before) => {
    sendMessage({ type: "messages:history", sessionId, limit: 50, before });
  },

  sendUserMessage: (sessionId, text) => {
    sendMessage({ type: "message:send", sessionId, text });
  },

  interruptSession: (sessionId) => {
    sendMessage({ type: "message:interrupt", sessionId });
  },
}));

addMessageHandler((msg: DaemonMessage) => {
  // History loaded
  if (msg.type === "messages:data") {
    useChatStore.setState((state) => {
      // Daemon sends messages in seq ASC (oldest first, after .reverse()).
      // The inverted FlatList needs newest first (index 0 = bottom of screen).
      const incoming = [...msg.messages].reverse();

      const existing = state.messagesBySession[msg.sessionId] || [];
      const isPaginating =
        existing.length > 0 &&
        incoming.length > 0 &&
        incoming[0].seq < existing[existing.length - 1].seq;

      // On first load, replace with DB data. On pagination, append older messages.
      const merged = isPaginating
        ? dedupeMessages([...existing, ...incoming])
        : incoming;

      return {
        messagesBySession: {
          ...state.messagesBySession,
          [msg.sessionId]: merged,
        },
        hasMore: { ...state.hasMore, [msg.sessionId]: msg.hasMore },
      };
    });
  }

  // User message acknowledged — add optimistic message to list
  if (msg.type === "message:ack") {
    // We don't add the user message here because we add it optimistically in sendUserMessage
    // The ack just confirms it was received
  }

  // Streaming text delta
  if (msg.type === "stream:text") {
    useChatStore.setState((state) => {
      const current = state.streamingMessage;
      if (!current || current.id !== msg.messageId) {
        // Start new streaming message
        return {
          streamingMessage: {
            id: msg.messageId,
            sessionId: msg.sessionId,
            blocks: [{ type: "text", text: msg.text }],
          },
        };
      }
      // Append to existing text block
      const blocks = [...current.blocks];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.type === "text") {
        blocks[blocks.length - 1] = { ...lastBlock, text: lastBlock.text + msg.text };
      } else {
        blocks.push({ type: "text", text: msg.text });
      }
      return {
        streamingMessage: { ...current, blocks },
      };
    });
  }

  // Tool use event
  if (msg.type === "stream:tool_use") {
    useChatStore.setState((state) => {
      const current = state.streamingMessage;
      const toolBlock: AssistantBlock = {
        type: "tool_use",
        id: `tool_${Date.now()}`,
        tool: msg.tool,
        input: msg.input,
      };
      if (!current || current.id !== msg.messageId) {
        return {
          streamingMessage: {
            id: msg.messageId,
            sessionId: msg.sessionId,
            blocks: [toolBlock],
          },
        };
      }
      return {
        streamingMessage: {
          ...current,
          blocks: [...current.blocks, toolBlock],
        },
      };
    });
  }

  // Tool result
  if (msg.type === "stream:tool_result") {
    useChatStore.setState((state) => {
      const current = state.streamingMessage;
      const resultBlock: AssistantBlock = {
        type: "tool_result",
        id: `result_${Date.now()}`,
        tool: msg.tool,
        output: msg.output,
        isError: msg.isError,
      };
      if (!current || current.id !== msg.messageId) {
        return {
          streamingMessage: {
            id: msg.messageId,
            sessionId: msg.sessionId,
            blocks: [resultBlock],
          },
        };
      }
      return {
        streamingMessage: {
          ...current,
          blocks: [...current.blocks, resultBlock],
        },
      };
    });
  }

  // Stream done — finalize assistant message and add to history
  if (msg.type === "stream:done") {
    useChatStore.setState((state) => {
      const streaming = state.streamingMessage;
      if (!streaming || streaming.id !== msg.messageId) {
        return { streamingMessage: null };
      }

      const finalMessage: Message = {
        id: msg.messageId,
        sessionId: msg.sessionId,
        role: "assistant",
        content: streaming.blocks,
        createdAt: new Date().toISOString(),
        seq: 0,
      };

      const existing = state.messagesBySession[msg.sessionId] || [];
      return {
        streamingMessage: null,
        messagesBySession: {
          ...state.messagesBySession,
          [msg.sessionId]: [finalMessage, ...existing],
        },
      };
    });
  }

  // Status busy
  if (msg.type === "status:busy") {
    useChatStore.setState({
      busySessionId: msg.sessionId,
      activity: msg.activity || "Thinking...",
    });
  }

  // Status idle
  if (msg.type === "status:idle") {
    useChatStore.setState((state) => {
      if (state.busySessionId === msg.sessionId) {
        return { busySessionId: null, activity: null };
      }
      return {};
    });
  }
});

function dedupeMessages(messages: Message[]): Message[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
