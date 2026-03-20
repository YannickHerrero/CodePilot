import "dotenv/config";
import { initDB } from "./db.js";

console.log("[codepilot] Starting daemon...");

initDB();
console.log("[codepilot] Database initialized.");
