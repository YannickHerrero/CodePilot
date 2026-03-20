import { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TextInput, Pressable } from "react-native";
import { colors } from "@/constants/theme";
import type { Session } from "@/lib/protocol";

interface Props {
  session: Session | null;
  visible: boolean;
  onClose: () => void;
  onRename: (sessionId: string, title: string) => void;
}

export function RenameSessionDialog({ session, visible, onClose, onRename }: Props) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible && session) {
      setTitle(session.title || "");
      // Focus the input after a short delay to ensure the modal is rendered
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, session]);

  const handleRename = () => {
    if (session && title.trim()) {
      onRename(session.id, title.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    setTitle("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
        onPress={handleCancel}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            width: "100%",
            maxWidth: 340,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "600",
              marginBottom: 16,
            }}
          >
            Rename Session
          </Text>

          <TextInput
            ref={inputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Session title"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 20,
            }}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={handleRename}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "500" }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRename}
              disabled={!title.trim()}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: !title.trim()
                  ? colors.textMuted
                  : pressed
                    ? colors.accentHover
                    : colors.accent,
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              })}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                Rename
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
