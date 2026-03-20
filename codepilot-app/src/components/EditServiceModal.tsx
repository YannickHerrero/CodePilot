import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { colors } from "@/constants/theme";
import { useServicesStore } from "@/stores/services";
import type { Service } from "@/lib/protocol";

interface EditServiceModalProps {
  visible: boolean;
  service: Service | null;
  hasRunningInstances: boolean;
  onClose: () => void;
}

export function EditServiceModal({
  visible,
  service,
  hasRunningInstances,
  onClose,
}: EditServiceModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const updateService = useServicesStore((s) => s.updateService);
  const deleteService = useServicesStore((s) => s.deleteService);

  // Initialize form when service changes
  useEffect(() => {
    if (service) {
      setName(service.name);
      setCommand(service.command);
    }
  }, [service]);

  const handleSave = () => {
    if (service && name.trim() && command.trim()) {
      updateService(service.id, name.trim(), command.trim());
      onClose();
    }
  };

  const handleDelete = () => {
    if (!service) return;

    if (hasRunningInstances) {
      Alert.alert(
        "Cannot Delete",
        "Stop all running instances before deleting this service.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Delete Service",
      `Are you sure you want to delete "${service.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteService(service.id);
            onClose();
          },
        },
      ],
    );
  };

  const handleClose = () => {
    onClose();
  };

  const isValid = name.trim().length > 0 && command.trim().length > 0;
  const hasChanges =
    service &&
    (name.trim() !== service.name || command.trim() !== service.command);

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
          <Text style={styles.title}>Edit Service</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Service name"
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
              placeholder="Command to run"
              placeholderTextColor={colors.textMuted}
              value={command}
              onChangeText={setCommand}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </View>

          <View style={styles.buttons}>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.button,
                styles.deleteButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>

            <View style={styles.rightButtons}>
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
                onPress={handleSave}
                disabled={!isValid || !hasChanges}
                style={({ pressed }) => [
                  styles.button,
                  styles.saveButton,
                  {
                    backgroundColor:
                      isValid && hasChanges ? colors.accent : colors.textMuted,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rightButtons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: "transparent",
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.error,
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
  saveButton: {
    backgroundColor: colors.accent,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
