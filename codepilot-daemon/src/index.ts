import "dotenv/config";
import { initDB } from "./db.js";
import { refreshProjects } from "./project-scanner.js";

const DEV_DIR = process.env.DEV_DIR || `${process.env.HOME}/dev`;

console.log("[codepilot] Starting daemon...");

initDB();
console.log("[codepilot] Database initialized.");

await refreshProjects(DEV_DIR);
