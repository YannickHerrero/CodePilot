import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "@/constants/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
          }}
        />
      </View>
    </ErrorBoundary>
  );
}
