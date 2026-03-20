import { useRef, useCallback, useEffect } from "react";
import { useConnectionStore } from "@/stores/connection";
import type { ClientMessage, DaemonMessage } from "@/lib/protocol";

type MessageHandler = (msg: DaemonMessage) => void;

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

let ws: WebSocket | null = null;
let messageHandlers: Set<MessageHandler> = new Set();
let messageQueue: ClientMessage[] = [];
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = INITIAL_RECONNECT_DELAY;
let intentionalClose = false;

export function addMessageHandler(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

export function sendMessage(msg: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    messageQueue.push(msg);
  }
}

function flushQueue(): void {
  while (messageQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
    const msg = messageQueue.shift()!;
    ws.send(JSON.stringify(msg));
  }
}

function scheduleReconnect(host: string, port: number, token: string): void {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  const { setStatus } = useConnectionStore.getState();
  setStatus("reconnecting");

  reconnectTimeout = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connectWS(host, port, token);
  }, reconnectDelay);
}

export function connectWS(host: string, port: number, token: string): void {
  const { setStatus, setCredentials } = useConnectionStore.getState();
  setCredentials(host, port, token);

  if (ws) {
    intentionalClose = true;
    ws.close();
    ws = null;
  }

  intentionalClose = false;
  setStatus("connecting");

  const socket = new WebSocket(`ws://${host}:${port}`);
  ws = socket;

  socket.onopen = () => {
    reconnectDelay = INITIAL_RECONNECT_DELAY;
    // Send auth immediately
    socket.send(JSON.stringify({ type: "auth", token }));
  };

  socket.onmessage = (event) => {
    let msg: DaemonMessage;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    // Handle auth result
    if (msg.type === "auth:result") {
      if (msg.success) {
        setStatus("connected");
        flushQueue();
      } else {
        setStatus("disconnected");
        intentionalClose = true;
        socket.close();
      }
    }

    // Route to all registered handlers
    for (const handler of messageHandlers) {
      handler(msg);
    }
  };

  socket.onclose = () => {
    ws = null;
    if (!intentionalClose) {
      scheduleReconnect(host, port, token);
    } else {
      setStatus("disconnected");
    }
  };

  socket.onerror = () => {
    // onclose will fire after onerror
  };
}

export function disconnectWS(): void {
  intentionalClose = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  messageQueue = [];
  const { setStatus } = useConnectionStore.getState();
  setStatus("disconnected");
}

export function useWebSocket() {
  const status = useConnectionStore((s) => s.status);

  return {
    status,
    send: sendMessage,
    connect: connectWS,
    disconnect: disconnectWS,
  };
}

export function useMessageHandler(handler: MessageHandler): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapper: MessageHandler = (msg) => handlerRef.current(msg);
    return addMessageHandler(wrapper);
  }, []);
}
