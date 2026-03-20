import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, TextInput, RefreshControl, Pressable, Modal } from "react-native";
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
  const { projects, isLoading, fetchProjects, refreshProjects, createProject } = useProjectsStore();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

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
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                justifyContent: "center",
                alignItems: "center",
              })}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 20 }}>+</Text>
            </Pressable>
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

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 20,
              width: "85%",
              maxWidth: 360,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => {}}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
              }}
            >
              New Project
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderRadius: 8,
                padding: 10,
                fontSize: 14,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 16,
              }}
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="project-name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: pressed ? colors.surfaceElevated : colors.background,
                })}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600" }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (newProjectName.trim()) {
                    createProject(newProjectName.trim());
                    setShowCreateModal(false);
                    setNewProjectName("");
                  }
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: pressed ? colors.accentHover : colors.accent,
                  opacity: newProjectName.trim() ? 1 : 0.5,
                })}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                  Create
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
