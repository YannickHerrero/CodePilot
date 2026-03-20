import { create } from "zustand";
import type { Project, DaemonMessage } from "@/lib/protocol";
import { sendMessage, addMessageHandler } from "@/hooks/useWebSocket";

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  setProjects: (projects: Project[]) => void;
  fetchProjects: () => void;
  refreshProjects: () => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  isLoading: false,

  setProjects: (projects) => set({ projects, isLoading: false }),

  fetchProjects: () => {
    set({ isLoading: true });
    sendMessage({ type: "projects:list" });
  },

  refreshProjects: () => {
    set({ isLoading: true });
    sendMessage({ type: "projects:refresh" });
  },
}));

// Register handler for projects:data messages
addMessageHandler((msg: DaemonMessage) => {
  if (msg.type === "projects:data") {
    useProjectsStore.getState().setProjects(msg.projects);
  }
});
