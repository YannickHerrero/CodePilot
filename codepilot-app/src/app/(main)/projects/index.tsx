import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, TextInput, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useProjectsStore } from "@/stores/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectCardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import type { Project } from "@/lib/protocol";

export default function ProjectsScreen() {
  const router = useRouter();
  const { projects, isLoading, fetchProjects, refreshProjects } = useProjectsStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const renderItem = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard
        project={item}
        onPress={() => router.push(`/(main)/projects/${item.id}`)}
      />
    ),
    [router],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: "bold",
              flex: 1,
            }}
          >
            Projects
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/settings")}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
              justifyContent: "center",
              alignItems: "center",
            })}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>⚙</Text>
          </Pressable>
        </View>
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
          value={search}
          onChangeText={setSearch}
          placeholder="Search projects..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshProjects}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </View>
          ) : (
            <EmptyState
              title="No projects found"
              subtitle={search ? "Try a different search term" : "No projects detected on your server"}
              actionLabel={!search ? "Refresh" : undefined}
              onAction={!search ? refreshProjects : undefined}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
