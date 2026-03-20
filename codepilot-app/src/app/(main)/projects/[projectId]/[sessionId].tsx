import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "@/constants/theme";

export default function ChatScreen() {
  const { projectId, sessionId } = useLocalSearchParams<{
    projectId: string;
    sessionId: string;
  }>();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 20 }}>Chat</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Session {sessionId} in {projectId}
      </Text>
    </View>
  );
}
