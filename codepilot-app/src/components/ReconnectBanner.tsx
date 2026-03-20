import { View, Text } from "react-native";
import { colors } from "@/constants/theme";
import { useConnectionStore, type ConnectionStatus } from "@/stores/connection";

export function ReconnectBanner() {
  const status = useConnectionStore((s) => s.status);

  if (status === "connected" || status === "disconnected") return null;

  const bannerConfig: Record<string, { bg: string; text: string; label: string }> = {
    connecting: {
      bg: colors.warning + "20",
      text: colors.warning,
      label: "Connecting...",
    },
    reconnecting: {
      bg: colors.warning + "20",
      text: colors.warning,
      label: "Reconnecting...",
    },
  };

  const config = bannerConfig[status];
  if (!config) return null;

  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: "center",
      }}
    >
      <Text style={{ color: config.text, fontSize: 13, fontWeight: "500" }}>{config.label}</Text>
    </View>
  );
}
