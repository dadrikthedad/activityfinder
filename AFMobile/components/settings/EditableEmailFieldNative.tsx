import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from "react-native";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import ButtonNative from "../common/buttons/ButtonNative";
import { useAuth } from "@/context/AuthContext";
import { updateEmail } from "@/services/user/security";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import { showNotificationToastNative, LocalToastType } from "../toast/NotificationToastNative";


interface EditableEmailFieldProps {
  email: string;
  onEmailUpdated?: (newEmail: string) => void;
}

export default function EditableEmailFieldNative({ email, onEmailUpdated }: EditableEmailFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAuth();

  const handleSave = async () => {
    const validationError = validateSingleField("email" as FieldName, inputValue);
    if (validationError) {
      setError(validationError);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Validation Error",
        customBody: validationError,
        position: 'top'
      });
      return;
    }

    if (!currentPassword || currentPassword.length < 4) {
      setError("Current password is required.");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: "Current password is required.",
        position: 'top'
      });
      return; 
    }

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

    setIsSaving(true); 
    try {
      await updateEmail(inputValue, currentPassword, token);
      if (onEmailUpdated) {
        onEmailUpdated(inputValue);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setError(null);
      setCurrentPassword("");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Success",
        customBody: "Email updated successfully!",
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
    setInputValue(email);
    setCurrentPassword("");
    setEditing(false);
    setError(null);
  };

  // Update inputValue when email prop changes (from parent)
  React.useEffect(() => {
    if (!editing) {
      setInputValue(email);
    }
  }, [email, editing]);

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>Email:</Text>
      
      {/* Value or Input */}
      <View style={styles.valueContainer}>
        {editing ? (
          <View style={styles.editingContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  error ? styles.inputError : styles.inputNormal
                ]}
                value={inputValue}
                onChangeText={(text) => {
                  setInputValue(text);
                  setError(null);
                }}
                placeholder="Enter new email"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                autoFocus={true}
                selectTextOnFocus={true}
              />
            </View>

            <PasswordFieldNative
              id="currentPassword"
              label="Current Password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setError(null);
              }}
              placeholder="Enter password to confirm"
              error={error || undefined}
              touched={true}
              style={styles.passwordField}
            />

          </View>
        ) : (
          <View style={styles.displayValueContainer}>
            <Text style={styles.displayValue}>{email}</Text>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        {saved ? (
          <ButtonNative
            text="✓ Saved"
            onPress={() => {}} // No action needed
            variant="primary"
            size="small"
            disabled={true}
          />
        ) : editing ? (
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
  
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  valueContainer: {
    marginBottom: 12,
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
  
  inputContainer: {
    width: '100%',
  },
  
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
    textAlign: 'center',
    minHeight: 44,
  },
  
  inputNormal: {
    borderColor: '#d1d5db',
  },
  
  inputError: {
    borderColor: '#ef4444',
    textAlign: 'center',
  },
  
  passwordField: {
    marginBottom: 0, // Override default margin from PasswordFieldNative
  },
  
  buttonsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  editingButtons: {
    gap: 12,
    width: '100%',
  },
  singleButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});