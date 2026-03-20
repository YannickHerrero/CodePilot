import { memo } from "react";
import { View, Text } from "react-native";
import { colors } from "@/constants/theme";
import { ToolUseBlock } from "@/components/ToolUseBlock";
import type { Message, AssistantBlock, UserMessageContent } from "@/lib/protocol";

interface Props {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: Props) {
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
    const rendered = renderAssistantBlocks(blocks);
    return <View style={{ marginBottom: 8 }}>{rendered}</View>;
  }

  return null;
});

function renderAssistantBlocks(blocks: AssistantBlock[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "text") {
      elements.push(
        <View key={i} style={{ marginBottom: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22, fontFamily: "serif" }}>
            {block.text}
          </Text>
        </View>,
      );
    } else if (block.type === "tool_use") {
      // Find matching tool_result
      const result = blocks.find(
        (b): b is Extract<AssistantBlock, { type: "tool_result" }> =>
          b.type === "tool_result" && b.id === block.id,
      );
      elements.push(<ToolUseBlock key={i} block={block} result={result} />);
    }
    // tool_result is rendered as part of ToolUseBlock, skip standalone rendering
  }

  return elements;
}
