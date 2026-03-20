import { useState, useRef } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { colors } from "@/constants/theme";

interface Props {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  isBusy: boolean;
}

export function ChatInput({ onSend, onInterrupt, isBusy }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <TextInput
        ref={inputRef}
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 15,
          maxHeight: 100,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        value={text}
        onChangeText={setText}
        placeholder="Message Claude..."
        placeholderTextColor={colors.textMuted}
        multiline
        returnKeyType="default"
        blurOnSubmit={false}
        editable={!isBusy}
      />
      {isBusy ? (
        <Pressable
          onPress={onInterrupt}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: pressed ? colors.error + "cc" : colors.error,
            justifyContent: "center",
            alignItems: "center",
          })}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              backgroundColor: "#fff",
            }}
          />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleSend}
          disabled={!text.trim()}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: text.trim()
              ? pressed
                ? colors.accentHover
                : colors.accent
              : colors.surface,
            justifyContent: "center",
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: text.trim() ? "#fff" : colors.textMuted,
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            ↑
          </Text>
        </Pressable>
      )}
    </View>
  );
}
