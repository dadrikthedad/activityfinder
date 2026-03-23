// components/common/DatePickerNative.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import LabelWithTooltipNative from "./buttons/LabelWithTooltipNative";

interface DatePickerNativeProps {
  id: string;
  label: string;
  tooltip?: string;
  value: string; // YYYY-MM-DD
  onChangeText: (dateString: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxDate?: Date;
  minDate?: Date;
}

export default function DatePickerNative({
  id, label, tooltip, value, onChangeText, onBlur,
  error, touched, placeholder, disabled = false, maxDate, minDate,
}: DatePickerNativeProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const showError = touched && !!error;

  const getDateFromString = (dateString: string): Date => {
    if (!dateString) return new Date();
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDisplayDate = (): string => {
    if (!value) return placeholder || t("auth.dateOfBirthPlaceholder");
    const date = getDateFromString(value);
    if (isNaN(date.getTime())) return placeholder || t("auth.dateOfBirthPlaceholder");
    return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selectedDate && event.type !== "dismissed") {
      onChangeText(formatDateToString(selectedDate));
    }
  };

  const buttonStyle = {
    height: 48,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: showError
      ? theme.colors.borderError
      : theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: disabled ? theme.colors.disabled : theme.colors.backgroundInput,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  };

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <LabelWithTooltipNative label={label} tooltip={tooltip} />

      <TouchableOpacity style={buttonStyle} onPress={() => !disabled && setShowPicker(true)} disabled={disabled}>
        <Text style={{
          fontSize: theme.typography.md,
          color: value
            ? disabled ? theme.colors.textDisabled : theme.colors.textPrimary
            : theme.colors.textPlaceholder,
          flex: 1,
        }}>
          {getDisplayDate()}
        </Text>
        <Ionicons
          name="calendar"
          size={20}
          color={disabled ? theme.colors.textDisabled : theme.colors.textMuted}
        />
      </TouchableOpacity>

      {showError && (
        <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
          {error}
        </Text>
      )}

      {/* iOS — modal med spinner */}
      {Platform.OS === "ios" && showPicker && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
            }}>
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: theme.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ fontSize: theme.typography.md, color: theme.colors.textMuted }}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <Text style={{
                  fontSize: theme.typography.lg,
                  fontWeight: theme.typography.semibold,
                  color: theme.colors.textPrimary,
                }}>
                  {label}
                </Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{
                    fontSize: theme.typography.md,
                    color: theme.colors.primary,
                    fontWeight: theme.typography.semibold,
                  }}>
                    {t("common.ok")}
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={getDateFromString(value)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={maxDate || new Date()}
                minimumDate={minDate}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android — native picker */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={getDateFromString(value)}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={maxDate || new Date()}
          minimumDate={minDate}
        />
      )}
    </View>
  );
}
