import { Platform } from "react-native";
import Markdown from "@ronradtke/react-native-markdown-display";
import { colors } from "@/constants/theme";

const monoFont = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const markdownStyles = {
  body: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "700" as const,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "600" as const,
    marginTop: 12,
    marginBottom: 4,
  },
  strong: {
    fontWeight: "600" as const,
  },
  em: {
    fontStyle: "italic" as const,
  },
  link: {
    color: colors.accent,
    textDecorationLine: "underline" as const,
  },
  blockquote: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: colors.surfaceElevated,
    color: colors.accent,
    fontFamily: monoFont,
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: colors.codeBackground,
    color: colors.codeText,
    fontFamily: monoFont,
    fontSize: 13,
    lineHeight: 19,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    overflow: "hidden" as const,
  },
  code_block: {
    backgroundColor: colors.codeBackground,
    color: colors.codeText,
    fontFamily: monoFont,
    fontSize: 13,
    lineHeight: 19,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: colors.textSecondary,
    fontSize: 14,
    marginRight: 6,
  },
  ordered_list_icon: {
    color: colors.textSecondary,
    fontSize: 14,
    marginRight: 6,
  },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: 12,
  },
  table: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: colors.surface,
  },
  th: {
    padding: 8,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontWeight: "600" as const,
    fontSize: 13,
  },
  td: {
    padding: 8,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
};

interface Props {
  children: string;
}

export function MarkdownText({ children }: Props) {
  return (
    <Markdown style={markdownStyles}>
      {children}
    </Markdown>
  );
}
