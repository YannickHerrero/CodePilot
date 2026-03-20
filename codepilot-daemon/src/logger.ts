function timestamp(): string {
  return new Date().toISOString();
}

export function log(message: string): void {
  console.log(`[${timestamp()}] [codepilot] ${message}`);
}

export function warn(message: string): void {
  console.warn(`[${timestamp()}] [codepilot] WARN: ${message}`);
}

export function error(message: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err ? String(err) : "";
  console.error(`[${timestamp()}] [codepilot] ERROR: ${message}${detail ? ` — ${detail}` : ""}`);
}
