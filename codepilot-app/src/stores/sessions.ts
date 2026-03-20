import { create } from "zustand";
import type { Session, DaemonMessage } from "@/lib/protocol";
import { sendMessage, addMessageHandler } from "@/hooks/useWebSocket";

interface SessionsState {
  sessionsByProject: Record<string, Session[]>;
  isLoading: boolean;
  fetchSessions: (projectId: string) => void;
  createSession: (projectId: string, title?: string) => void;
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
});
