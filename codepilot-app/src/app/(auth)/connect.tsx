import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useWebSocket, useMessageHandler } from "@/hooks/useWebSocket";
import { saveCredentials } from "@/lib/storage";

export default function ConnectScreen() {
  const router = useRouter();
  const { connect, status } = useWebSocket();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("7777");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useMessageHandler(
    useCallback(
      (msg) => {
        if (msg.type === "auth:result") {
          if (msg.success) {
            saveCredentials({ host, port: parseInt(port, 10), token });
            router.replace("/(main)/projects");
          } else {
            setError(msg.error || "Authentication failed");
          }
        }
      },
      [host, port, token, router],
    ),
  );

  const handleConnect = () => {
    if (!host.trim() || !token.trim()) {
      setError("Host and token are required");
      return;
    }
    setError(null);
    connect(host.trim(), parseInt(port, 10) || 7777, token.trim());
  };

  const isConnecting = status === "connecting";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 28,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          CodePilot
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Connect to your VPS daemon
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
              Host (Tailscale IP or hostname)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              value={host}
              onChangeText={setHost}
              placeholder="100.x.y.z or my-vps"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
              Port
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              value={port}
              onChangeText={setPort}
              placeholder="7777"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
              Auth Token
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              value={token}
              onChangeText={setToken}
              placeholder="Your secure token"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {error && (
            <Text style={{ color: colors.error, fontSize: 14, textAlign: "center" }}>{error}</Text>
          )}

          <Pressable
            onPress={handleConnect}
            disabled={isConnecting}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.accentHover : colors.accent,
              borderRadius: 8,
              padding: 14,
              alignItems: "center",
              opacity: isConnecting ? 0.7 : 1,
              marginTop: 4,
            })}
          >
            {isConnecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Connect</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
