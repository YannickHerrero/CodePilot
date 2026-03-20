import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 24 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: "500" }}>{title}</Text>
      {subtitle && (
        <Text
          style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: "center" }}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            marginTop: 16,
            backgroundColor: pressed ? colors.accentHover : colors.accent,
            borderRadius: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
