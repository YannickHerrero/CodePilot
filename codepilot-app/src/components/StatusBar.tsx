import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { useConnectionStore } from "@/stores/connection";
import { useChatStore } from "@/stores/chat";

interface Props {
  sessionId?: string;
  projectName?: string;
  gitBranch?: string | null;
}

export function StatusBar({ sessionId, projectName, gitBranch }: Props) {
  const router = useRouter();
  const connectionStatus = useConnectionStore((s) => s.status);
  const busySessionId = useChatStore((s) => s.busySessionId);
  const activity = useChatStore((s) => s.activity);
  const isBusy = sessionId ? busySessionId === sessionId : false;

  const dotColor =
    connectionStatus === "connected"
      ? colors.success
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? colors.warning
        : colors.error;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Text style={{ color: colors.accent, fontSize: 22 }}>‹</Text>
      </Pressable>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
        }}
      />
      <View style={{ flex: 1 }}>
        {isBusy && activity ? (
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
            {activity}
          </Text>
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
            {projectName || "CodePilot"}
            {gitBranch ? ` · ${gitBranch}` : ""}
          </Text>
        )}
      </View>
      {connectionStatus !== "connected" && (
        <Text style={{ color: colors.warning, fontSize: 11 }}>
          {connectionStatus === "connecting" ? "Connecting..." : "Reconnecting..."}
        </Text>
      )}
    </View>
  );
}
