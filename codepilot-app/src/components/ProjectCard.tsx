import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";
import { timeAgo } from "@/lib/time";
import type { Project } from "@/lib/protocol";

interface Props {
  project: Project;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: Props) {
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

      {project.metadata.description && (
        <Text
          numberOfLines={1}
          style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}
        >
          {project.metadata.description}
        </Text>
      )}

      {project.lastOpenedAt && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {timeAgo(project.lastOpenedAt)}
        </Text>
      )}
    </Pressable>
  );
}
