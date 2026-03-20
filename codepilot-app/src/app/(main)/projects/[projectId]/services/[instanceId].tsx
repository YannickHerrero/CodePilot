import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import {
  useServicesStore,
  selectLogsForInstance,
  selectInstanceById,
} from "@/stores/services";

export default function InstanceDetailScreen() {
  const { projectId, instanceId } = useLocalSearchParams<{
    projectId: string;
    instanceId: string;
  }>();
  const router = useRouter();

  const instanceData = useServicesStore((s) => selectInstanceById(s, instanceId!));
  const logs = useServicesStore((s) => selectLogsForInstance(s, instanceId!));
  const subscribeToInstance = useServicesStore((s) => s.subscribeToInstance);
  const unsubscribeFromInstance = useServicesStore((s) => s.unsubscribeFromInstance);
  const stopInstance = useServicesStore((s) => s.stopInstance);
  const clearLogs = useServicesStore((s) => s.clearLogs);

  const scrollViewRef = useRef<ScrollView>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Subscribe to logs on mount
  useEffect(() => {
    if (instanceId) {
      subscribeToInstance(instanceId);
      return () => unsubscribeFromInstance(instanceId);
    }
  }, [instanceId, subscribeToInstance, unsubscribeFromInstance]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll) {
      // Small delay to let the content render
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
      setAutoScroll(isAtBottom);
    },
    [],
  );

  const handleStop = () => {
    if (instanceId) {
      stopInstance(instanceId);
    }
  };

  const handleClear = () => {
    if (instanceId) {
      clearLogs(instanceId);
    }
  };

  const service = instanceData?.service;
  const instance = instanceData?.instance;
  const isRunning = instance?.status === "running" || instance?.status === "stopping";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text style={styles.backButton}>‹</Text>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {service?.name || "Instance"}
            </Text>
            {instance && (
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(instance.status) },
                  ]}
                />
                <Text style={styles.statusText}>
                  {getStatusText(instance)}
                </Text>
              </View>
            )}
          </View>
        </View>
        {service && (
          <Text style={styles.command} numberOfLines={1}>
            {service.command}
          </Text>
        )}
      </View>

      {/* Log Output */}
      <View style={styles.logContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.logScroll}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <Text style={styles.logText}>
            {logs.length > 0 ? logs.join("\n") : "Waiting for output..."}
          </Text>
        </ScrollView>

        {/* Log footer */}
        <View style={styles.logFooter}>
          <Text style={styles.logCount}>
            {logs.length} lines {autoScroll ? "(auto-scrolling)" : ""}
          </Text>
        </View>
      </View>

      {/* Toolbar */}
      <SafeAreaView edges={["bottom"]} style={styles.toolbar}>
        <Pressable
          onPress={handleStop}
          disabled={!isRunning}
          style={({ pressed }) => [
            styles.toolbarButton,
            styles.stopButton,
            { opacity: !isRunning ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.stopButtonText}>Stop</Text>
        </Pressable>

        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [
            styles.toolbarButton,
            styles.clearButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.clearButtonText}>Clear Logs</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "running":
      return colors.success;
    case "stopping":
      return colors.warning;
    case "crashed":
      return colors.error;
    case "stopped":
    default:
      return colors.textMuted;
  }
}

function getStatusText(instance: { status: string; pid: number; exitCode: number | null }): string {
  const pidText = `PID ${instance.pid}`;
  switch (instance.status) {
    case "running":
      return `${pidText} · Running`;
    case "stopping":
      return `${pidText} · Stopping...`;
    case "crashed":
      return `${pidText} · Crashed (exit ${instance.exitCode})`;
    case "stopped":
      return instance.exitCode === 0
        ? `${pidText} · Stopped`
        : `${pidText} · Exited (${instance.exitCode})`;
    default:
      return pidText;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    color: colors.accent,
    fontSize: 28,
    marginRight: 8,
    marginTop: -4,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  command: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: "monospace",
    marginTop: 4,
    marginLeft: 36,
  },
  logContainer: {
    flex: 1,
    backgroundColor: colors.codeBackground,
  },
  logScroll: {
    flex: 1,
    padding: 12,
  },
  logText: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    color: colors.codeText,
  },
  logFooter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  logCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  toolbar: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toolbarButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  stopButton: {
    backgroundColor: colors.error,
  },
  stopButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
});
