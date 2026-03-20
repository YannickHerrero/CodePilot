import "dotenv/config";
import { initDB } from "./db.js";
import { refreshProjects } from "./project-scanner.js";
import { startWSServer, setDevDir } from "./ws-server.js";

const DEV_DIR = process.env.DEV_DIR || `${process.env.HOME}/dev`;
const PORT = parseInt(process.env.CODEPILOT_PORT || "7777", 10);

console.log("[codepilot] Starting daemon...");

initDB();
console.log("[codepilot] Database initialized.");

setDevDir(DEV_DIR);
await refreshProjects(DEV_DIR);

startWSServer(PORT);
