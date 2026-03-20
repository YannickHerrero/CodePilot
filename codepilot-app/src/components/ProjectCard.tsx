import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";
import { timeAgo } from "@/lib/time";
import type { Project } from "@/lib/protocol";

interface Props {
  project: Project;
  onPress: () => void;
}

export const ProjectCard = memo(function ProjectCard({ project, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600", flex: 1 }}>
          {project.name}
        </Text>
        {project.gitBranch && (
          <View
            style={{
              backgroundColor: colors.accent + "22",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 12 }}>{project.gitBranch}</Text>
          </View>
        )}
        {project.metadata.framework && (
          <View
            style={{
              backgroundColor: colors.success + "22",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: colors.success, fontSize: 12 }}>
              {project.metadata.framework}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {project.lastSessionAt ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Last chat {timeAgo(project.lastSessionAt)}
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No conversations yet</Text>
        )}
        {project.totalMessages > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {project.totalMessages} {project.totalMessages === 1 ? "message" : "messages"}
          </Text>
        )}
      </View>
    </Pressable>
  );
});
