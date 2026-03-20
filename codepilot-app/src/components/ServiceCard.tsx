import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { useServicesStore } from "@/stores/services";
import type { ServiceWithInstances, ServiceInstance } from "@/lib/protocol";

interface ServiceCardProps {
  serviceWithInstances: ServiceWithInstances;
}

export function ServiceCard({ serviceWithInstances }: ServiceCardProps) {
  const { service, instances } = serviceWithInstances;
  const router = useRouter();
  const startInstance = useServicesStore((s) => s.startInstance);

  const runningCount = instances.filter(
    (i) => i.status === "running" || i.status === "stopping",
  ).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.command} numberOfLines={1}>
            {service.command}
          </Text>
        </View>
        {runningCount > 0 && (
          <View style={styles.badge}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>{runningCount}</Text>
          </View>
        )}
      </View>

      {instances.length > 0 ? (
        <View style={styles.instances}>
          {instances.map((instance) => (
            <InstanceRow
              key={instance.id}
              instance={instance}
              onPress={() =>
                router.push(
                  `/(main)/projects/${service.projectId}/services/${instance.id}`,
                )
              }
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noInstances}>No instances running</Text>
      )}

      <Pressable
        onPress={() => startInstance(service.id)}
        style={({ pressed }) => [
          styles.startButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={styles.startButtonText}>+ Start Instance</Text>
      </Pressable>
    </View>
  );
}

interface InstanceRowProps {
  instance: ServiceInstance;
  onPress: () => void;
}

function InstanceRow({ instance, onPress }: InstanceRowProps) {
  const statusColor = getStatusColor(instance.status);
  const statusLabel = getStatusLabel(instance);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.instanceRow,
        { backgroundColor: pressed ? colors.surfaceElevated : colors.surface },
      ]}
    >
      <View style={[styles.instanceDot, { backgroundColor: statusColor }]} />
      <View style={styles.instanceInfo}>
        <Text style={styles.instancePid}>PID {instance.pid}</Text>
        <Text style={styles.instanceStatus}>{statusLabel}</Text>
      </View>
      <Text style={styles.instanceArrow}>›</Text>
    </Pressable>
  );
}

function getStatusColor(status: ServiceInstance["status"]): string {
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

function getStatusLabel(instance: ServiceInstance): string {
  switch (instance.status) {
    case "running":
      return "Running";
    case "stopping":
      return "Stopping...";
    case "crashed":
      return `Crashed (exit ${instance.exitCode})`;
    case "stopped":
      return instance.exitCode === 0 ? "Stopped" : `Exited (${instance.exitCode})`;
    default:
      return instance.status;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  command: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  instances: {
    gap: 6,
    marginBottom: 10,
  },
  instanceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instanceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  instanceInfo: {
    flex: 1,
  },
  instancePid: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  instanceStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  instanceArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  noInstances: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: 10,
  },
  startButton: {
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 12,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.accent,
  },
});
