import { timingSafeEqual } from "node:crypto";

const TOKEN = process.env.CODEPILOT_TOKEN || "";

export function validateToken(token: string): boolean {
  if (!TOKEN) {
    console.warn("[codepilot] WARNING: CODEPILOT_TOKEN not set, rejecting all auth");
    return false;
  }

  const a = Buffer.from(token);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
