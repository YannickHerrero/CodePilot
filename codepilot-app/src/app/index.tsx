import { useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { loadCredentials } from "@/lib/storage";
import { connectWS, useMessageHandler } from "@/hooks/useWebSocket";

export default function Index() {
  const router = useRouter();

  useMessageHandler(
    useCallback(
      (msg) => {
        if (msg.type === "auth:result") {
          if (msg.success) {
            router.replace("/(main)/projects");
          } else {
            router.replace("/(auth)/connect");
          }
        }
      },
      [router],
    ),
  );

  useEffect(() => {
    let cancelled = false;

    loadCredentials().then((creds) => {
      if (cancelled) return;
      if (creds) {
        connectWS(creds.host, creds.port, creds.token);
        // Auth result handler above will navigate
        // Fallback timeout in case connection hangs
        setTimeout(() => {
          if (!cancelled) router.replace("/(auth)/connect");
        }, 5000);
      } else {
        router.replace("/(auth)/connect");
      }
    });

    return () => {
      cancelled = true;
    };
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
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 16,
        }}
      >
        CodePilot
      </Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
