import { View, Text } from "react-native";
import { colors } from "@/constants/theme";

export default function ProjectsScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 20 }}>Projects</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Project list placeholder
      </Text>
    </View>
  );
}
