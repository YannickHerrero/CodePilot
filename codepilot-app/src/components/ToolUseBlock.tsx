import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { colors } from "@/constants/theme";
import type { AssistantBlock } from "@/lib/protocol";

interface Props {
  block: Extract<AssistantBlock, { type: "tool_use" }>;
  result?: Extract<AssistantBlock, { type: "tool_result" }>;
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📄",
  Write: "✏️",
  Edit: "🔧",
  MultiEdit: "🔧",
  Bash: "💻",
  Glob: "🔍",
  Grep: "🔎",
  WebSearch: "🌐",
};

export function ToolUseBlock({ block, result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[block.tool] || "⚙️";
  const summary = getToolSummary(block.tool, block.input);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 10,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 14 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>
            {block.tool}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {result && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: result.isError ? colors.error : colors.success,
            }}
          />
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{expanded ? "▼" : "▶"}</Text>
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {/* Tool input */}
          {block.tool === "Bash" && typeof block.input.command === "string" ? (
            <View style={{ backgroundColor: "#0D0D14", padding: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
                COMMAND
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                >
                  {String(block.input.command)}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          {(block.tool === "Read" || block.tool === "Write" || block.tool === "Edit") &&
          typeof block.input.file_path === "string" ? (
            <View style={{ backgroundColor: "#0D0D14", padding: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
                FILE
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {String(block.input.file_path)}
              </Text>
            </View>
          ) : null}

          {block.tool === "Edit" &&
          typeof block.input.old_string === "string" ? (
            <DiffView
              oldStr={String(block.input.old_string)}
              newStr={String(block.input.new_string ?? "")}
            />
          ) : null}

          {/* Tool result */}
          {result && (
            <View
              style={{
                backgroundColor: "#0D0D14",
                padding: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: result.isError ? colors.error : colors.textMuted,
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                {result.isError ? "ERROR" : "OUTPUT"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ maxHeight: 200 }}
              >
                <Text
                  style={{
                    color: result.isError ? colors.error : colors.textSecondary,
                    fontSize: 12,
                    fontFamily: "monospace",
                    lineHeight: 18,
                  }}
                >
                  {result.output.slice(0, 2000)}
                  {result.output.length > 2000 ? "\n... (truncated)" : ""}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  return (
    <View style={{ backgroundColor: "#0D0D14", padding: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>DIFF</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {oldStr.split("\n").map((line, i) => (
            <Text
              key={`old-${i}`}
              style={{
                color: "#F87171",
                fontSize: 12,
                fontFamily: "monospace",
                lineHeight: 18,
                backgroundColor: "#F8717110",
              }}
            >
              - {line}
            </Text>
          ))}
          {newStr.split("\n").map((line, i) => (
            <Text
              key={`new-${i}`}
              style={{
                color: "#4ADE80",
                fontSize: 12,
                fontFamily: "monospace",
                lineHeight: 18,
                backgroundColor: "#4ADE8010",
              }}
            >
              + {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function getToolSummary(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case "Read":
      return (input.file_path as string) || "file";
    case "Write":
      return (input.file_path as string) || "file";
    case "Edit":
    case "MultiEdit":
      return (input.file_path as string) || "file";
    case "Bash":
      return (input.command as string)?.slice(0, 60) || "command";
    case "Glob":
      return (input.pattern as string) || "pattern";
    case "Grep":
      return (input.pattern as string) || "pattern";
    case "WebSearch":
      return (input.query as string) || "search";
    default:
      return JSON.stringify(input).slice(0, 60);
  }
}
