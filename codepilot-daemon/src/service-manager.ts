import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import type { Service, ServiceInstance, DaemonMessage } from "./protocol.js";
import { log, error as logError } from "./logger.js";

// === Constants ===

const MAX_LOG_LINES = 2000;
const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2MB
const CLEANUP_DELAY_MS = 60000; // 1 minute after exit

// === Types ===

interface LogBuffer {
  lines: string[];
  totalBytes: number;
}

interface ServiceInstanceState {
  id: string;
  serviceId: string;
  projectPath: string;
  command: string;
  process: ChildProcess;
  pid: number;
  status: "running" | "stopping" | "stopped" | "crashed";
  startedAt: string;
  exitCode: number | null;
  logBuffer: LogBuffer;
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
}

// === State ===

const instances = new Map<string, ServiceInstanceState>();
const logSubscribers = new Map<string, Set<WebSocket>>(); // instanceId → subscribers

// Callback to broadcast messages - set by ws-server
let broadcastFn: ((msg: DaemonMessage) => void) | null = null;
let sendToFn: ((ws: WebSocket, msg: DaemonMessage) => void) | null = null;

export function setBroadcast(fn: (msg: DaemonMessage) => void): void {
  broadcastFn = fn;
}

export function setSendTo(fn: (ws: WebSocket, msg: DaemonMessage) => void): void {
  sendToFn = fn;
}

// === Instance Lifecycle ===

export function startInstance(service: Service, projectPath: string): ServiceInstance {
  const instanceId = randomUUID();

  log(`Starting service instance ${instanceId} for ${service.name}: ${service.command}`);

  const proc = spawn(service.command, [], {
    cwd: projectPath,
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: "1", // Preserve colors in output
    },
  });

  const instance: ServiceInstanceState = {
    id: instanceId,
    serviceId: service.id,
    projectPath,
    command: service.command,
    process: proc,
    pid: proc.pid!,
    status: "running",
    startedAt: new Date().toISOString(),
    exitCode: null,
    logBuffer: { lines: [], totalBytes: 0 },
    cleanupTimeout: null,
  };

  proc.stdout?.on("data", (data: Buffer) => {
    handleOutput(instance, data.toString());
  });

  proc.stderr?.on("data", (data: Buffer) => {
    handleOutput(instance, data.toString());
  });

  proc.on("exit", (code) => {
    handleExit(instance, code);
  });

  proc.on("error", (err) => {
    handleError(instance, err);
  });

  instances.set(instanceId, instance);

  return toServiceInstance(instance);
}

export function stopInstance(instanceId: string): boolean {
  const instance = instances.get(instanceId);
  if (!instance || instance.status !== "running") {
    return false;
  }

  log(`Stopping instance ${instanceId}`);
  instance.status = "stopping";
  instance.process.kill("SIGTERM");

  // Force kill after 5 seconds if still running
  setTimeout(() => {
    if (instance.status === "stopping") {
      log(`Force killing instance ${instanceId}`);
      instance.process.kill("SIGKILL");
    }
  }, 5000);

  return true;
}

export function stopAllInstances(): void {
  log(`Stopping all service instances (${instances.size} total)`);
  for (const instance of instances.values()) {
    if (instance.status === "running" || instance.status === "stopping") {
      instance.process.kill("SIGTERM");
    }
    if (instance.cleanupTimeout) {
      clearTimeout(instance.cleanupTimeout);
    }
  }
  instances.clear();
  logSubscribers.clear();
}

// === Log Management ===

function handleOutput(instance: ServiceInstanceState, data: string): void {
  // Split by newlines but handle partial lines
  const lines = data.split("\n");

  for (const line of lines) {
    if (line.length === 0) continue;

    appendToBuffer(instance.logBuffer, line);
    broadcastLog(instance.id, line);
  }
}

function appendToBuffer(buffer: LogBuffer, line: string): void {
  const lineBytes = Buffer.byteLength(line, "utf8");

  buffer.lines.push(line);
  buffer.totalBytes += lineBytes;

  // Trim if limits exceeded (hybrid: lines OR bytes)
  while (
    (buffer.lines.length > MAX_LOG_LINES || buffer.totalBytes > MAX_LOG_BYTES) &&
    buffer.lines.length > 0
  ) {
    const removed = buffer.lines.shift()!;
    buffer.totalBytes -= Buffer.byteLength(removed, "utf8");
  }
}

function broadcastLog(instanceId: string, data: string): void {
  const subscribers = logSubscribers.get(instanceId);
  if (!subscribers || subscribers.size === 0) return;

  const msg: DaemonMessage = { type: "instance:log", instanceId, data };

  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      sendToFn?.(ws, msg);
    }
  }
}

// === Subscriptions ===

export function subscribe(instanceId: string, ws: WebSocket): boolean {
  const instance = instances.get(instanceId);
  if (!instance) {
    return false;
  }

  let subs = logSubscribers.get(instanceId);
  if (!subs) {
    subs = new Set();
    logSubscribers.set(instanceId, subs);
  }
  subs.add(ws);

  // Send current buffer
  sendToFn?.(ws, {
    type: "instance:buffer",
    instanceId,
    lines: instance.logBuffer.lines,
  });

  return true;
}

export function unsubscribe(instanceId: string, ws: WebSocket): void {
  const subs = logSubscribers.get(instanceId);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) {
      logSubscribers.delete(instanceId);
    }
  }
}

export function cleanupSubscriber(ws: WebSocket): void {
  // Remove this WebSocket from all subscriptions
  for (const [instanceId, subs] of logSubscribers) {
    subs.delete(ws);
    if (subs.size === 0) {
      logSubscribers.delete(instanceId);
    }
  }
}

// === Exit Handling ===

function handleExit(instance: ServiceInstanceState, code: number | null): void {
  const wasRunning = instance.status === "running" || instance.status === "stopping";
  instance.status = code === 0 ? "stopped" : "crashed";
  instance.exitCode = code;

  log(`Instance ${instance.id} exited with code ${code}`);

  if (wasRunning) {
    broadcastFn?.({
      type: "instance:stopped",
      instanceId: instance.id,
      exitCode: code,
    });
  }

  // Schedule cleanup after delay (allows viewing exit logs)
  instance.cleanupTimeout = setTimeout(() => {
    log(`Cleaning up instance ${instance.id}`);
    instances.delete(instance.id);
    logSubscribers.delete(instance.id);
  }, CLEANUP_DELAY_MS);
}

function handleError(instance: ServiceInstanceState, error: Error): void {
  logError(`Instance ${instance.id} error:`, error);
  const errorLine = `[Error: ${error.message}]`;
  appendToBuffer(instance.logBuffer, errorLine);
  broadcastLog(instance.id, errorLine);
}

// === Queries ===

export function getInstancesForService(serviceId: string): ServiceInstance[] {
  const result: ServiceInstance[] = [];
  for (const instance of instances.values()) {
    if (instance.serviceId === serviceId) {
      result.push(toServiceInstance(instance));
    }
  }
  return result;
}

export function getAllInstancesForProject(projectPath: string): ServiceInstance[] {
  const result: ServiceInstance[] = [];
  for (const instance of instances.values()) {
    if (instance.projectPath === projectPath) {
      result.push(toServiceInstance(instance));
    }
  }
  return result;
}

export function getInstance(instanceId: string): ServiceInstance | null {
  const instance = instances.get(instanceId);
  return instance ? toServiceInstance(instance) : null;
}

export function getInstanceServiceId(instanceId: string): string | null {
  const instance = instances.get(instanceId);
  return instance?.serviceId ?? null;
}

// === Helpers ===

function toServiceInstance(state: ServiceInstanceState): ServiceInstance {
  return {
    id: state.id,
    serviceId: state.serviceId,
    pid: state.pid,
    status: state.status,
    startedAt: state.startedAt,
    exitCode: state.exitCode,
  };
}
