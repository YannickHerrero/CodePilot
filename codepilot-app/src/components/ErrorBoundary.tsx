import React from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[CodePilot] Render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
            padding: 24,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.accentHover : colors.accent,
              borderRadius: 8,
              paddingHorizontal: 24,
              paddingVertical: 12,
            })}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
