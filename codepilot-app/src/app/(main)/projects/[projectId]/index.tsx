import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "@/constants/theme";

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 20 }}>
        Project: {projectId}
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Session list placeholder
      </Text>
    </View>
  );
}
