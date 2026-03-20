import { ScrollView, Pressable, Text } from "react-native";
import { colors } from "@/constants/theme";

const QUICK_ACTIONS = [
  { label: "Git status", prompt: "Run git status and summarize any changes" },
  { label: "Run tests", prompt: "Run the test suite and report results" },
  { label: "Recent changes", prompt: "Show me the most recent git changes (last 5 commits with diffs)" },
  { label: "Explain project", prompt: "Give me a brief overview of this project's structure and purpose" },
  { label: "Fix errors", prompt: "Check for any errors or issues and fix them" },
];

interface Props {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 6 }}
    >
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => onAction(action.prompt)}
          disabled={disabled}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
