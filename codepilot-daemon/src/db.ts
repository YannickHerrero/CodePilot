import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { Project, Session, Message } from "./protocol.js";

let db: Database.Database;

export function initDB(dbPath = "codepilot.db"): Database.Database {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      git_branch TEXT,
      last_opened_at TEXT,
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      sdk_session_id TEXT,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      seq INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages(session_id, seq);
  `);

  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}

// === Projects ===

export function upsertProject(project: Project): void {
  const stmt = getDB().prepare(`
    INSERT INTO projects (id, name, path, git_branch, last_opened_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      path = excluded.path,
      git_branch = excluded.git_branch,
      metadata = excluded.metadata
  `);
  stmt.run(
    project.id,
    project.name,
    project.path,
    project.gitBranch,
    project.lastOpenedAt,
    JSON.stringify(project.metadata),
  );
}

export function getAllProjects(): Project[] {
  const rows = getDB()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM sessions WHERE project_id = p.id AND is_active = 1) AS session_count,
        (SELECT COUNT(*) FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE project_id = p.id)) AS total_messages,
        (SELECT MAX(updated_at) FROM sessions WHERE project_id = p.id AND is_active = 1) AS last_session_at
      FROM projects p
      ORDER BY last_opened_at DESC NULLS LAST, name ASC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToProject);
}

export function removeStaleProjects(activePaths: Set<string>): number {
  const allProjects = getAllProjects();
  const stale = allProjects.filter((p) => !activePaths.has(p.path));
  if (stale.length === 0) return 0;

  const d = getDB();
  const deleteMessages = d.prepare("DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE project_id = ?)");
  const deleteSessions = d.prepare("DELETE FROM sessions WHERE project_id = ?");
  const deleteProject = d.prepare("DELETE FROM projects WHERE id = ?");

  const removeAll = d.transaction(() => {
    for (const p of stale) {
      deleteMessages.run(p.id);
      deleteSessions.run(p.id);
      deleteProject.run(p.id);
    }
  });
  removeAll();

  return stale.length;
}

export function getProject(id: string): Project | undefined {
  const row = getDB()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM sessions WHERE project_id = p.id AND is_active = 1) AS session_count,
        (SELECT COUNT(*) FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE project_id = p.id)) AS total_messages,
        (SELECT MAX(updated_at) FROM sessions WHERE project_id = p.id AND is_active = 1) AS last_session_at
      FROM projects p WHERE p.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToProject(row) : undefined;
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    gitBranch: (row.git_branch as string) ?? null,
    lastOpenedAt: (row.last_opened_at as string) ?? null,
    metadata: JSON.parse((row.metadata as string) || "{}"),
    sessionCount: (row.session_count as number) ?? 0,
    totalMessages: (row.total_messages as number) ?? 0,
    lastSessionAt: (row.last_session_at as string) ?? null,
  };
}

// === Sessions ===

export function createSession(projectId: string, title?: string): Session {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDB()
    .prepare(
      `INSERT INTO sessions (id, project_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, projectId, title ?? null, now, now);
  return {
    id,
    projectId,
    sdkSessionId: null,
    title: title ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSessionsByProject(projectId: string): Session[] {
  const rows = getDB()
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM messages WHERE session_id = s.id) AS message_count,
        (SELECT content FROM messages WHERE session_id = s.id ORDER BY seq DESC LIMIT 1) AS last_message_content
      FROM sessions s
      WHERE s.project_id = ? AND s.is_active = 1
      ORDER BY s.updated_at DESC`,
    )
    .all(projectId) as Array<Record<string, unknown>>;
  return rows.map(rowToSession);
}

export function getSession(id: string): Session | undefined {
  const row = getDB()
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM messages WHERE session_id = s.id) AS message_count
      FROM sessions s WHERE s.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToSession(row) : undefined;
}

export function updateSessionSdkId(sessionId: string, sdkSessionId: string): void {
  getDB()
    .prepare("UPDATE sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?")
    .run(sdkSessionId, new Date().toISOString(), sessionId);
}

export function touchSession(sessionId: string): void {
  getDB()
    .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), sessionId);
}

export function renameSession(sessionId: string, title: string): Session | undefined {
  const now = new Date().toISOString();
  getDB()
    .prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
    .run(title, now, sessionId);
  return getSession(sessionId);
}

function rowToSession(row: Record<string, unknown>): Session {
  let lastMessagePreview: string | undefined;
  if (row.last_message_content) {
    try {
      const content = JSON.parse(row.last_message_content as string);
      if (content.type === "text") {
        lastMessagePreview = content.text.slice(0, 100);
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b: { type: string }) => b.type === "text");
        if (textBlock) lastMessagePreview = textBlock.text.slice(0, 100);
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    id: row.id as string,
    projectId: row.project_id as string,
    sdkSessionId: (row.sdk_session_id as string) ?? null,
    title: (row.title as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    messageCount: (row.message_count as number) ?? undefined,
    lastMessagePreview,
  };
}

// === Messages ===

export function createMessage(
  sessionId: string,
  role: Message["role"],
  content: Message["content"],
): Message {
  const id = uuidv4();
  const now = new Date().toISOString();
  const seqRow = getDB()
    .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM messages WHERE session_id = ?")
    .get(sessionId) as { next_seq: number };

  getDB()
    .prepare(
      `INSERT INTO messages (id, session_id, role, content, created_at, seq)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, sessionId, role, JSON.stringify(content), now, seqRow.next_seq);

  touchSession(sessionId);

  return {
    id,
    sessionId,
    role,
    content,
    createdAt: now,
    seq: seqRow.next_seq,
  };
}

export function getMessages(
  sessionId: string,
  limit = 50,
  before?: string,
): { messages: Message[]; hasMore: boolean } {
  let rows: Array<Record<string, unknown>>;

  if (before) {
    const beforeMsg = getDB()
      .prepare("SELECT seq FROM messages WHERE id = ?")
      .get(before) as { seq: number } | undefined;
    if (!beforeMsg) return { messages: [], hasMore: false };

    rows = getDB()
      .prepare(
        `SELECT * FROM messages
       WHERE session_id = ? AND seq < ?
       ORDER BY seq DESC LIMIT ?`,
      )
      .all(sessionId, beforeMsg.seq, limit + 1) as Array<Record<string, unknown>>;
  } else {
    rows = getDB()
      .prepare(
        `SELECT * FROM messages
       WHERE session_id = ?
       ORDER BY seq DESC LIMIT ?`,
      )
      .all(sessionId, limit + 1) as Array<Record<string, unknown>>;
  }

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return {
    messages: rows.reverse().map(rowToMessage),
    hasMore,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as Message["role"],
    content: JSON.parse(row.content as string),
    createdAt: row.created_at as string,
    seq: row.seq as number,
  };
}
