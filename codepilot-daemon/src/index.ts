import "dotenv/config";
import { initDB } from "./db.js";
import { refreshProjects } from "./project-scanner.js";
import { startWSServer, setDevDir, stopWSServer } from "./ws-server.js";
import { cleanupActiveSessions } from "./session-manager.js";
import { log } from "./logger.js";

const DEV_DIR = process.env.DEV_DIR || `${process.env.HOME}/dev`;
const PORT = parseInt(process.env.CODEPILOT_PORT || "7777", 10);

log("Starting daemon...");

initDB();
log("Database initialized.");

setDevDir(DEV_DIR);
await refreshProjects(DEV_DIR);

const wss = startWSServer(PORT);

// Graceful shutdown
async function shutdown(signal: string) {
  log(`Received ${signal}, shutting down...`);
  cleanupActiveSessions();
  await stopWSServer(wss);
  log("Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
