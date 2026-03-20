import { View, Text } from "react-native";
import { colors } from "@/constants/theme";
import type { AssistantBlock } from "@/lib/protocol";
import type { StreamingMessage } from "@/stores/chat";

interface Props {
  streaming: StreamingMessage;
  activity: string | null;
}

export function StreamingBubble({ streaming, activity }: Props) {
  return (
    <View style={{ marginBottom: 8 }}>
      {streaming.blocks.map((block, i) => (
        <StreamingBlockView key={i} block={block} isLast={i === streaming.blocks.length - 1} />
      ))}
      {activity && (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
          {activity}
        </Text>
      )}
    </View>
  );
}

function StreamingBlockView({ block, isLast }: { block: AssistantBlock; isLast: boolean }) {
  if (block.type === "text") {
    return (
      <View style={{ marginBottom: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22, fontFamily: "serif" }}>
          {block.text}
          {isLast && <Text style={{ color: colors.accent }}>▊</Text>}
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
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
          {block.tool}
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
