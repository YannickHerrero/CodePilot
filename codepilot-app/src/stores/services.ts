import { create } from "zustand";
import type {
  Service,
  ServiceInstance,
  ServiceWithInstances,
  DaemonMessage,
} from "@/lib/protocol";
import { sendMessage, addMessageHandler } from "@/hooks/useWebSocket";

interface ServicesState {
  // Services organized by project
  servicesByProject: Record<string, ServiceWithInstances[]>;

  // Log buffers per instance
  logsByInstance: Record<string, string[]>;

  // Track which instances we're subscribed to
  subscribedInstances: Set<string>;

  // Loading state
  isLoading: boolean;

  // Actions
  fetchServices: (projectId: string) => void;
  createService: (projectId: string, name: string, command: string) => void;
  updateService: (serviceId: string, name?: string, command?: string) => void;
  deleteService: (serviceId: string) => void;
  startInstance: (serviceId: string) => void;
  stopInstance: (instanceId: string) => void;
  subscribeToInstance: (instanceId: string) => void;
  unsubscribeFromInstance: (instanceId: string) => void;
  clearLogs: (instanceId: string) => void;
}

export const useServicesStore = create<ServicesState>((set, get) => ({
  servicesByProject: {},
  logsByInstance: {},
  subscribedInstances: new Set(),
  isLoading: false,

  fetchServices: (projectId) => {
    set({ isLoading: true });
    sendMessage({ type: "services:list", projectId });
  },

  createService: (projectId, name, command) => {
    sendMessage({ type: "service:create", projectId, name, command });
  },

  updateService: (serviceId, name, command) => {
    sendMessage({ type: "service:update", serviceId, name, command });
  },

  deleteService: (serviceId) => {
    sendMessage({ type: "service:delete", serviceId });
  },

  startInstance: (serviceId) => {
    sendMessage({ type: "instance:start", serviceId });
  },

  stopInstance: (instanceId) => {
    sendMessage({ type: "instance:stop", instanceId });
  },

  subscribeToInstance: (instanceId) => {
    const { subscribedInstances } = get();
    if (!subscribedInstances.has(instanceId)) {
      sendMessage({ type: "instance:subscribe", instanceId });
      set({
        subscribedInstances: new Set([...subscribedInstances, instanceId]),
      });
    }
  },

  unsubscribeFromInstance: (instanceId) => {
    const { subscribedInstances } = get();
    if (subscribedInstances.has(instanceId)) {
      sendMessage({ type: "instance:unsubscribe", instanceId });
      const newSet = new Set(subscribedInstances);
      newSet.delete(instanceId);
      set({ subscribedInstances: newSet });
    }
  },

  clearLogs: (instanceId) => {
    set((state) => ({
      logsByInstance: {
        ...state.logsByInstance,
        [instanceId]: [],
      },
    }));
  },
}));

// === Message Handlers ===

addMessageHandler((msg: DaemonMessage) => {
  // On successful auth (reconnect), clear stale instance data
  // Services will be refetched when ServicesList mounts
  if (msg.type === "auth:result" && msg.success) {
    useServicesStore.setState((state) => {
      // Clear instances from all services (they're gone after daemon restart)
      // Keep the service definitions but clear runtime state
      const clearedByProject: Record<string, ServiceWithInstances[]> = {};
      for (const [projectId, services] of Object.entries(state.servicesByProject)) {
        clearedByProject[projectId] = services.map((s) => ({
          ...s,
          instances: [],
        }));
      }
      return {
        servicesByProject: clearedByProject,
        logsByInstance: {},
        subscribedInstances: new Set<string>(),
      };
    });
  }

  // Services list response
  if (msg.type === "services:data") {
    useServicesStore.setState((state) => ({
      isLoading: false,
      servicesByProject: {
        ...state.servicesByProject,
        [msg.projectId]: msg.services,
      },
    }));
  }

  // Service created
  if (msg.type === "service:created") {
    useServicesStore.setState((state) => {
      const projectId = msg.service.projectId;
      const existing = state.servicesByProject[projectId] || [];
      const newServiceWithInstances: ServiceWithInstances = {
        service: msg.service,
        instances: [],
      };
      return {
        servicesByProject: {
          ...state.servicesByProject,
          [projectId]: [...existing, newServiceWithInstances],
        },
      };
    });
  }

  // Service updated
  if (msg.type === "service:updated") {
    useServicesStore.setState((state) => {
      const projectId = msg.service.projectId;
      const existing = state.servicesByProject[projectId] || [];
      return {
        servicesByProject: {
          ...state.servicesByProject,
          [projectId]: existing.map((s) =>
            s.service.id === msg.service.id
              ? { ...s, service: msg.service }
              : s,
          ),
        },
      };
    });
  }

  // Service deleted
  if (msg.type === "service:deleted") {
    useServicesStore.setState((state) => {
      const newByProject: Record<string, ServiceWithInstances[]> = {};
      for (const [projectId, services] of Object.entries(state.servicesByProject)) {
        newByProject[projectId] = services.filter(
          (s) => s.service.id !== msg.serviceId,
        );
      }
      return { servicesByProject: newByProject };
    });
  }

  // Instance started
  if (msg.type === "instance:started") {
    useServicesStore.setState((state) => {
      const newByProject: Record<string, ServiceWithInstances[]> = {};
      for (const [projectId, services] of Object.entries(state.servicesByProject)) {
        newByProject[projectId] = services.map((s) =>
          s.service.id === msg.serviceId
            ? { ...s, instances: [...s.instances, msg.instance] }
            : s,
        );
      }
      return {
        servicesByProject: newByProject,
        logsByInstance: {
          ...state.logsByInstance,
          [msg.instance.id]: [],
        },
      };
    });
  }

  // Instance stopped
  if (msg.type === "instance:stopped") {
    useServicesStore.setState((state) => {
      const newByProject: Record<string, ServiceWithInstances[]> = {};
      for (const [projectId, services] of Object.entries(state.servicesByProject)) {
        newByProject[projectId] = services.map((s) => ({
          ...s,
          instances: s.instances.map((i) =>
            i.id === msg.instanceId
              ? { ...i, status: "stopped" as const, exitCode: msg.exitCode }
              : i,
          ),
        }));
      }
      return { servicesByProject: newByProject };
    });
  }

  // Initial log buffer (on subscribe)
  if (msg.type === "instance:buffer") {
    useServicesStore.setState((state) => ({
      logsByInstance: {
        ...state.logsByInstance,
        [msg.instanceId]: msg.lines,
      },
    }));
  }

  // Streaming log line
  if (msg.type === "instance:log") {
    useServicesStore.setState((state) => {
      const existing = state.logsByInstance[msg.instanceId] || [];
      return {
        logsByInstance: {
          ...state.logsByInstance,
          [msg.instanceId]: [...existing, msg.data],
        },
      };
    });
  }
});

// === Selectors ===

export function selectServicesForProject(
  state: ServicesState,
  projectId: string,
): ServiceWithInstances[] {
  return state.servicesByProject[projectId] || [];
}

export function selectLogsForInstance(
  state: ServicesState,
  instanceId: string,
): string[] {
  return state.logsByInstance[instanceId] || [];
}

export function selectInstanceById(
  state: ServicesState,
  instanceId: string,
): { service: Service; instance: ServiceInstance } | null {
  for (const services of Object.values(state.servicesByProject)) {
    for (const svc of services) {
      const instance = svc.instances.find((i) => i.id === instanceId);
      if (instance) {
        return { service: svc.service, instance };
      }
    }
  }
  return null;
}
