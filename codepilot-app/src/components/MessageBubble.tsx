import { View, Text } from "react-native";
import { colors } from "@/constants/theme";
import type { Message, AssistantBlock, UserMessageContent } from "@/lib/protocol";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  if (message.role === "user") {
    const content = message.content as UserMessageContent;
    return (
      <View style={{ alignItems: "flex-end", marginBottom: 8 }}>
        <View
          style={{
            backgroundColor: colors.accent,
            borderRadius: 16,
            borderBottomRightRadius: 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: "85%",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, lineHeight: 21 }}>{content.text}</Text>
        </View>
      </View>
    );
  }

  if (message.role === "assistant") {
    const blocks = message.content as AssistantBlock[];
    return (
      <View style={{ marginBottom: 8 }}>
        {blocks.map((block, i) => (
          <AssistantBlockView key={i} block={block} />
        ))}
      </View>
    );
  }

  return null;
}

function AssistantBlockView({ block }: { block: AssistantBlock }) {
  if (block.type === "text") {
    return (
      <View style={{ marginBottom: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22 }}>
          {block.text}
        </Text>
      </View>
    );
  }

  if (block.type === "tool_use") {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 10,
          marginVertical: 4,
          borderLeftWidth: 3,
          borderLeftColor: colors.accent,
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600", marginBottom: 2 }}>
          {block.tool}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>
          {formatToolInput(block.input)}
        </Text>
      </View>
    );
  }

  if (block.type === "tool_result") {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 10,
          marginVertical: 4,
          borderLeftWidth: 3,
          borderLeftColor: block.isError ? colors.error : colors.success,
        }}
      >
        <Text
          style={{
            color: block.isError ? colors.error : colors.success,
            fontSize: 12,
            fontWeight: "600",
            marginBottom: 2,
          }}
        >
          {block.tool} {block.isError ? "error" : "result"}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "monospace" }} numberOfLines={4}>
          {block.output}
        </Text>
      </View>
    );
  }

  return null;
}

function formatToolInput(input: Record<string, unknown>): string {
  const filePath = input.file_path || input.path || input.command || input.pattern;
  if (typeof filePath === "string") return filePath;
  return JSON.stringify(input).slice(0, 100);
}
