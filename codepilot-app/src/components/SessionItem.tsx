import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";
import { timeAgo } from "@/lib/time";
import type { Session } from "@/lib/protocol";

interface Props {
  session: Session;
  onPress: () => void;
}

export function SessionItem({ session, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "500", flex: 1 }}
          numberOfLines={1}
        >
          {session.title || "Untitled session"}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {timeAgo(session.createdAt)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {session.messageCount !== undefined && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {session.messageCount} messages
          </Text>
        )}
        {session.lastMessagePreview && (
          <Text
            numberOfLines={1}
            style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}
          >
            {session.lastMessagePreview}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
