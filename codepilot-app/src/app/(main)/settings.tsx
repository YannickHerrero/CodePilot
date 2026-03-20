import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useConnectionStore } from "@/stores/connection";
import { disconnectWS, connectWS } from "@/hooks/useWebSocket";
import { clearCredentials } from "@/lib/storage";

export default function SettingsScreen() {
  const router = useRouter();
  const { host, port, token, status } = useConnectionStore();
  const [editHost, setEditHost] = useState(host || "");
  const [editPort, setEditPort] = useState(String(port));
  const [editToken, setEditToken] = useState(token || "");
  const [testing, setTesting] = useState(false);

  const handleTestConnection = () => {
    setTesting(true);
    connectWS(editHost, parseInt(editPort, 10) || 7777, editToken);
    // Auto-reset after 5s
    setTimeout(() => setTesting(false), 5000);
  };

  const handleDisconnect = () => {
    Alert.alert("Disconnect", "Are you sure you want to disconnect?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          disconnectWS();
          await clearCredentials();
          router.replace("/(auth)/connect");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 8 })}
          >
            <Text style={{ color: colors.accent, fontSize: 22 }}>‹</Text>
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>
            Settings
          </Text>
        </View>

        {/* Connection Section */}
        <View>
          <Text
            style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 10 }}
          >
            CONNECTION
          </Text>
          <View style={{ gap: 10 }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Host</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={editHost}
                onChangeText={setEditHost}
                placeholder="192.168.1.100"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Port</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={editPort}
                onChangeText={setEditPort}
                placeholder="7777"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Token</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={editToken}
                onChangeText={setEditToken}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={handleTestConnection}
                disabled={testing}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? colors.accentHover : colors.accent,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: "center",
                  opacity: testing ? 0.6 : 1,
                })}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                  {testing ? "Testing..." : "Test Connection"}
                </Text>
              </Pressable>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    status === "connected"
                      ? colors.success
                      : status === "connecting" || status === "reconnecting"
                        ? colors.warning
                        : colors.error,
                }}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {status === "connected"
                  ? "Connected"
                  : status === "connecting"
                    ? "Connecting..."
                    : status === "reconnecting"
                      ? "Reconnecting..."
                      : "Disconnected"}
              </Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View>
          <Text
            style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 10 }}
          >
            ABOUT
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>App</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>CodePilot</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Version</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Disconnect Button */}
        <Pressable
          onPress={handleDisconnect}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.error + "30" : colors.error + "15",
            borderRadius: 8,
            padding: 14,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.error + "40",
          })}
        >
          <Text style={{ color: colors.error, fontSize: 15, fontWeight: "600" }}>
            Disconnect & Sign Out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
