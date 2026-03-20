import { create } from "zustand";
import type { Session, DaemonMessage } from "@/lib/protocol";
import { sendMessage, addMessageHandler } from "@/hooks/useWebSocket";

interface SessionsState {
  sessionsByProject: Record<string, Session[]>;
  isLoading: boolean;
  fetchSessions: (projectId: string) => void;
  createSession: (projectId: string, title?: string) => void;
  renameSession: (sessionId: string, title: string) => void;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessionsByProject: {},
  isLoading: false,

  fetchSessions: (projectId) => {
    set({ isLoading: true });
    sendMessage({ type: "sessions:list", projectId });
  },

  createSession: (projectId, title) => {
    sendMessage({ type: "sessions:create", projectId, title });
  },

  renameSession: (sessionId, title) => {
    sendMessage({ type: "session:rename", sessionId, title });
  },
}));

addMessageHandler((msg: DaemonMessage) => {
  if (msg.type === "sessions:data") {
    useSessionsStore.setState((state) => ({
      isLoading: false,
      sessionsByProject: {
        ...state.sessionsByProject,
        [msg.projectId]: msg.sessions,
      },
    }));
  }

  if (msg.type === "session:created") {
    useSessionsStore.setState((state) => {
      const existing = state.sessionsByProject[msg.session.projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [msg.session.projectId]: [msg.session, ...existing],
        },
      };
    });
  }

  if (msg.type === "session:renamed") {
    useSessionsStore.setState((state) => {
      const projectId = msg.session.projectId;
      const existing = state.sessionsByProject[projectId] || [];
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: existing.map((s) =>
            s.id === msg.session.id ? msg.session : s,
          ),
        },
      };
    });
  }
});
