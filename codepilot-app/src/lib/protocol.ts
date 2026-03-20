// Mirror of daemon's protocol.ts — shared types

export interface Project {
  id: string;
  name: string;
  path: string;
  gitBranch: string | null;
  lastOpenedAt: string | null;
  metadata: {
    description?: string;
    gitRemote?: string;
    framework?: string;
  };
  sessionCount: number;
  totalMessages: number;
  lastSessionAt: string | null;
}

export interface Session {
  id: string;
  projectId: string;
  sdkSessionId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: UserMessageContent | AssistantMessageContent;
  createdAt: string;
  seq: number;
}

export interface UserMessageContent {
  type: "text";
  text: string;
}

export type AssistantMessageContent = AssistantBlock[];

export type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; tool: string; output: string; isError?: boolean };

export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "projects:list" }
  | { type: "projects:refresh" }
  | { type: "sessions:list"; projectId: string }
  | { type: "sessions:create"; projectId: string; title?: string }
  | { type: "session:rename"; sessionId: string; title: string }
  | { type: "messages:history"; sessionId: string; limit?: number; before?: string }
  | { type: "message:send"; sessionId: string; text: string }
  | { type: "message:interrupt"; sessionId: string }
  | { type: "projects:create"; name: string };

export type DaemonMessage =
  | { type: "auth:result"; success: boolean; error?: string }
  | { type: "projects:data"; projects: Project[] }
  | { type: "sessions:data"; projectId: string; sessions: Session[] }
  | { type: "session:created"; session: Session }
  | { type: "session:renamed"; session: Session }
  | { type: "messages:data"; sessionId: string; messages: Message[]; hasMore: boolean }
  | { type: "message:ack"; sessionId: string; messageId: string; seq: number }
  | { type: "stream:text"; sessionId: string; messageId: string; text: string }
  | {
      type: "stream:tool_use";
      sessionId: string;
      messageId: string;
      tool: string;
      input: Record<string, unknown>;
    }
  | {
      type: "stream:tool_result";
      sessionId: string;
      messageId: string;
      tool: string;
      output: string;
      isError?: boolean;
    }
  | { type: "stream:done"; sessionId: string; messageId: string }
  | { type: "status:busy"; sessionId: string; activity?: string }
  | { type: "status:idle"; sessionId: string }
  | { type: "project:created"; project: Project }
  | { type: "error"; code: string; message: string; sessionId?: string };
