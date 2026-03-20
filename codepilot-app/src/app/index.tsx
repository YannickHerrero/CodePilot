import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // TODO: check saved credentials and auto-connect
    // For now, always go to connect screen
    const timer = setTimeout(() => {
      router.replace("/(auth)/connect");
    }, 500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        CodePilot
      </Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
