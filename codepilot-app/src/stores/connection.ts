import { create } from "zustand";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

interface ConnectionState {
  host: string | null;
  port: number;
  token: string | null;
  status: ConnectionStatus;
  setCredentials: (host: string, port: number, token: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  clear: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  host: null,
  port: 7777,
  token: null,
  status: "disconnected",
  setCredentials: (host, port, token) => set({ host, port, token }),
  setStatus: (status) => set({ status }),
  clear: () => set({ host: null, port: 7777, token: null, status: "disconnected" }),
}));
