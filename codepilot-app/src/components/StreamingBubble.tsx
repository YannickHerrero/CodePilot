import { View, Text } from "react-native";
import { colors } from "@/constants/theme";
import { MarkdownText } from "@/components/MarkdownText";
import { ToolUseBlock } from "@/components/ToolUseBlock";
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
        <StreamingBlockView
          key={block.type === "tool_use" || block.type === "tool_result" ? block.id : i}
          block={block}
          blocks={streaming.blocks}
          isLast={i === streaming.blocks.length - 1}
        />
      ))}
      {activity && (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
          {activity}
        </Text>
      )}
    </View>
  );
}

function StreamingBlockView({
  block,
  blocks,
  isLast,
}: {
  block: AssistantBlock;
  blocks: AssistantBlock[];
  isLast: boolean;
}) {
  if (block.type === "text") {
    return (
      <View style={{ marginBottom: 4 }}>
        <MarkdownText>{block.text + (isLast ? " ▊" : "")}</MarkdownText>
      </View>
    );
  }

  if (block.type === "tool_use") {
    const result = blocks.find(
      (b): b is Extract<AssistantBlock, { type: "tool_result" }> =>
        b.type === "tool_result" && b.id === block.id,
    );
    return <ToolUseBlock block={block} result={result} />;
  }

  // tool_result blocks are rendered alongside their tool_use, skip standalone rendering
  if (block.type === "tool_result") {
    return null;
  }

  return null;
}
