import { useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useSessionsStore } from "@/stores/sessions";
import { useProjectsStore } from "@/stores/projects";
import { SessionItem } from "@/components/SessionItem";
import { SessionItemSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useMessageHandler } from "@/hooks/useWebSocket";
import type { Session } from "@/lib/protocol";

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const sessionsRaw = useSessionsStore((s) => s.sessionsByProject[projectId!]);
  const sessions = useMemo(() => sessionsRaw ?? [], [sessionsRaw]);
  const isLoading = useSessionsStore((s) => s.isLoading);
  const { fetchSessions, createSession } = useSessionsStore();

  useEffect(() => {
    if (projectId) fetchSessions(projectId);
  }, [projectId, fetchSessions]);

  // Navigate to new session when created
  useMessageHandler(
    useCallback(
      (msg) => {
        if (msg.type === "session:created" && msg.session.projectId === projectId) {
          router.push(`/(main)/projects/${projectId}/${msg.session.id}`);
        }
      },
      [projectId, router],
    ),
  );

  const handleNewSession = () => {
    if (projectId) createSession(projectId);
  };

  const renderItem = useCallback(
    ({ item }: { item: Session }) => (
      <SessionItem
        session={item}
        onPress={() => router.push(`/(main)/projects/${projectId}/${item.id}`)}
      />
    ),
    [projectId, router],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 8 })}
          >
            <Text style={{ color: colors.accent, fontSize: 22 }}>‹</Text>
          </Pressable>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 22,
              fontWeight: "bold",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {project?.name || projectId}
          </Text>
        </View>
        {project?.gitBranch && (
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
            {project.gitBranch} &middot; {project.path}
          </Text>
        )}

        <Pressable
          onPress={handleNewSession}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.accentHover : colors.accent,
            borderRadius: 8,
            padding: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>New Session</Text>
        </Pressable>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => projectId && fetchSessions(projectId)}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <SessionItemSkeleton />
              <SessionItemSkeleton />
            </View>
          ) : (
            <EmptyState
              title="No sessions yet"
              subtitle={'Tap "New Session" to start chatting'}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
