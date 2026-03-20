import { useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useChatStore } from "@/stores/chat";
import { useSessionsStore } from "@/stores/sessions";
import { useProjectsStore } from "@/stores/projects";
import { MessageBubble } from "@/components/MessageBubble";
import { StreamingBubble } from "@/components/StreamingBubble";
import { ChatInput } from "@/components/ChatInput";
import { StatusBar } from "@/components/StatusBar";
import { QuickActions } from "@/components/QuickActions";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { useConnectionStore } from "@/stores/connection";
import type { Message } from "@/lib/protocol";

export default function ChatScreen() {
  const { projectId, sessionId } = useLocalSearchParams<{
    projectId: string;
    sessionId: string;
  }>();

  const messagesRaw = useChatStore((s) => s.messagesBySession[sessionId!]);
  const messages = useMemo(() => messagesRaw ?? [], [messagesRaw]);
  const streamingMessage = useChatStore((s) =>
    s.streamingMessage?.sessionId === sessionId ? s.streamingMessage : null,
  );
  const busySessionId = useChatStore((s) => s.busySessionId);
  const activity = useChatStore((s) => s.activity);
  const isBusy = busySessionId === sessionId;
  const { fetchMessages, sendUserMessage, interruptSession } = useChatStore();

  const session = useSessionsStore(
    (s) => s.sessionsByProject[projectId!]?.find((sess) => sess.id === sessionId),
  );
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const connectionStatus = useConnectionStore((s) => s.status);

  const flatListRef = useRef<FlatList>(null);
  const prevStatus = useRef(connectionStatus);

  useEffect(() => {
    if (sessionId) fetchMessages(sessionId);
  }, [sessionId, fetchMessages]);

  // Re-fetch messages after reconnect to sync missed messages
  useEffect(() => {
    if (prevStatus.current !== "connected" && connectionStatus === "connected" && sessionId) {
      fetchMessages(sessionId);
    }
    prevStatus.current = connectionStatus;
  }, [connectionStatus, sessionId, fetchMessages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!sessionId) return;
      // Add optimistic user message
      const optimisticMsg: Message = {
        id: `optimistic_${Date.now()}`,
        sessionId,
        role: "user",
        content: { type: "text", text },
        createdAt: new Date().toISOString(),
        seq: 0,
      };
      useChatStore.setState((state) => ({
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: [optimisticMsg, ...(state.messagesBySession[sessionId] || [])],
        },
      }));
      sendUserMessage(sessionId, text);
    },
    [sessionId, sendUserMessage],
  );

  const handleInterrupt = useCallback(() => {
    if (sessionId) interruptSession(sessionId);
  }, [sessionId, interruptSession]);

  const renderItem = useCallback(({ item }: { item: Message }) => {
    return <MessageBubble message={item} />;
  }, []);

  const ListHeader = useCallback(() => {
    if (!streamingMessage) {
      if (isBusy) {
        return (
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{ color: colors.textMuted, fontSize: 13, fontStyle: "italic" }}
            >
              {activity || "Thinking..."}
            </Text>
          </View>
        );
      }
      return null;
    }
    return <StreamingBubble streaming={streamingMessage} activity={activity} />;
  }, [streamingMessage, isBusy, activity]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <StatusBar
          sessionId={sessionId}
          projectName={project?.name || session?.title || "New Session"}
          gitBranch={project?.gitBranch}
        />
        <ReconnectBanner />

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 48 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                Start a conversation
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
                Send a message to begin
              </Text>
            </View>
          }
        />

        {messages.length === 0 && !isBusy && (
          <QuickActions onAction={handleSend} disabled={isBusy} />
        )}
        <ChatInput onSend={handleSend} onInterrupt={handleInterrupt} isBusy={isBusy} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
