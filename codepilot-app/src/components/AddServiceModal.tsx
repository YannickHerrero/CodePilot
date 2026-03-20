import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "@/constants/theme";
import { useServicesStore } from "@/stores/services";

interface AddServiceModalProps {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

export function AddServiceModal({ visible, projectId, onClose }: AddServiceModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const createService = useServicesStore((s) => s.createService);

  const handleCreate = () => {
    if (name.trim() && command.trim()) {
      createService(projectId, name.trim(), command.trim());
      setName("");
      setCommand("");
      onClose();
    }
  };

  const handleClose = () => {
    setName("");
    setCommand("");
    onClose();
  };

  const isValid = name.trim().length > 0 && command.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.modal}>
          <Text style={styles.title}>Add Service</Text>
          <Text style={styles.subtitle}>
            Create a service to run dev servers, watchers, or other long-running processes.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dev Server"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Command</Text>
            <TextInput
              style={[styles.input, styles.commandInput]}
              placeholder="e.g., pnpm dev"
              placeholderTextColor={colors.textMuted}
              value={command}
              onChangeText={setCommand}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </View>

          {/* Common presets */}
          <View style={styles.presets}>
            <Text style={styles.presetsLabel}>Quick fill:</Text>
            <View style={styles.presetButtons}>
              <PresetButton
                label="pnpm dev"
                onPress={() => {
                  setCommand("pnpm dev");
                  if (!name) setName("Dev Server");
                }}
              />
              <PresetButton
                label="npm start"
                onPress={() => {
                  setCommand("npm start");
                  if (!name) setName("Dev Server");
                }}
              />
              <PresetButton
                label="bun dev"
                onPress={() => {
                  setCommand("bun dev");
                  if (!name) setName("Dev Server");
                }}
              />
            </View>
          </View>

          <View style={styles.buttons}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleCreate}
              disabled={!isValid}
              style={({ pressed }) => [
                styles.button,
                styles.createButton,
                {
                  backgroundColor: isValid ? colors.accent : colors.textMuted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface PresetButtonProps {
  label: string;
  onPress: () => void;
}

function PresetButton({ label, onPress }: PresetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.presetButton,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={styles.presetButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  commandInput: {
    fontFamily: "monospace",
  },
  presets: {
    marginBottom: 20,
  },
  presetsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  createButton: {
    backgroundColor: colors.accent,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
