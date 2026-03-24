import { useEffect, useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";
import { useServicesStore } from "@/stores/services";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceCardSkeleton } from "@/components/LoadingSkeleton";
import { AddServiceModal } from "@/components/AddServiceModal";
import { EmptyState } from "@/components/EmptyState";
import type { ServiceWithInstances } from "@/lib/protocol";

interface ServicesListProps {
  projectId: string;
}

export function ServicesList({ projectId }: ServicesListProps) {
  const servicesRaw = useServicesStore((s) => s.servicesByProject[projectId]);
  const services = useMemo(() => servicesRaw ?? [], [servicesRaw]);
  const isLoading = useServicesStore((s) => s.isLoading);
  const { fetchServices } = useServicesStore();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchServices(projectId);
  }, [projectId]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceWithInstances }) => (
      <ServiceCard serviceWithInstances={item} />
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={(item) => item.service.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchServices(projectId)}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: pressed ? colors.accentHover : colors.accent },
            ]}
          >
            <Text style={styles.addButtonText}>+ Add Service</Text>
          </Pressable>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
            </View>
          ) : (
            <EmptyState
              title="No services configured"
              subtitle="Add a service to run dev servers, watchers, etc."
            />
          )
        }
      />

      <AddServiceModal
        visible={showAddModal}
        projectId={projectId}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  addButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
