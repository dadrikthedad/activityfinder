import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "../common/buttons/ButtonNative";
import { validateSingleField } from "@shared/utils/validators";
import { updatePassword } from "@/services/user/security";
import { useAuth } from "@/context/AuthContext";
import { showNotificationToastNative, LocalToastType } from "../toast/NotificationToastNative";

export default function EditablePasswordFieldsNative() {
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAuth();

  const handleSave = async () => {
    if (!token) {
      setError("Not authenticated");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: "Not authenticated",
        position: 'top'
      });
      return;
    }

    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      setError(passwordError);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Validation Error",
        customBody: passwordError,
        position: 'top'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: "Passwords do not match.",
        position: 'top'
      });
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(currentPassword, newPassword, confirmPassword, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Success",
        customBody: "Password updated successfully!",
        position: 'top'
      });
    } catch (err: unknown) {
      let errorMessage = "Something went wrong.";
      
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "message" in parsed &&
            typeof (parsed as { message: unknown }).message === "string"
          ) {
            errorMessage = (parsed as { message: string }).message;
          } else {
            errorMessage = err.message;
          }
        } catch {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: errorMessage,
        position: 'top'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  if (!editing) {
    return (
      <View style={styles.container}>
        <View style={styles.displayContainer}>
          <Text style={styles.label}>Password:</Text>
          <View style={styles.displayValueContainer}>
            <Text style={styles.displayValue}>********</Text>
          </View>
        </View>
        
        <View style={styles.buttonsContainer}>
          {saved ? (
            <ButtonNative
              text="✓ Saved"
              onPress={() => {}}
              variant="primary"
              size="small"
              disabled={true}
            />
          ) : (
            <ButtonNative
              text="Edit"
              onPress={() => setEditing(true)}
              variant="primary"
              size="small"
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.editingContainer}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        
        <PasswordFieldNative
          id="currentPassword"
          label="Current Password"
          value={currentPassword}
          onChangeText={(text) => {
            setCurrentPassword(text);
            setError(null);
          }}
          placeholder="Enter current password"
          error={error || undefined}
          touched={true}
        />

        <PasswordFieldNative
          id="newPassword"
          label="New Password"
          value={newPassword}
          onChangeText={(text) => {
            setNewPassword(text);
            setError(null);
          }}
          placeholder="Enter new password"
          error={error || undefined}
          touched={true}
        />

        <PasswordFieldNative
          id="confirmPassword"
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            setError(null);
          }}
          placeholder="Confirm new password"
          error={error || undefined}
          touched={true}
        />

        <View style={styles.editingButtons}>
          <ButtonNative
            text={isSaving ? "Saving..." : "Save"}
            onPress={handleSave}
            variant="primary"
            size="medium"
            loading={isSaving}
            disabled={isSaving}
            fullWidth
          />
          <ButtonNative
            text="Cancel"
            onPress={handleCancel}
            variant="secondary"
            size="medium"
            disabled={isSaving}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  displayContainer: {
    marginBottom: 12,
  },
  
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  displayValueContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 44,
    justifyContent: 'center',
  },
  
  displayValue: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },

  editingContainer: {
    gap: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },

  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },

  buttonsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  editingButtons: {
    gap: 12,
    marginTop: 16,
  },
});