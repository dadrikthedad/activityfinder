// features/auth/components/SignUpContactFieldsNative.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import LabelWithTooltipNative from "@/components/common/buttons/LabelWithTooltipNative";
import { DIAL_CODES, DialCodeEntry } from "@/core/data/phoneDialCodes";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";

// Sorter alle oppringningskoder som en flat liste for modal-visning
const ALL_DIAL_OPTIONS = Object.entries(DIAL_CODES)
  .map(([iso, entry]) => ({ iso, ...entry }))
  .sort((a, b) => a.iso.localeCompare(b.iso));

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
  // Auto-foreslått landskode basert på valgt land — kan overrides av bruker
  suggestedDialCode?: DialCodeEntry;
}

export default function SignUpContactFieldsNative({
  formData, handleChange, handleBlur, errors, touchedFields, suggestedDialCode,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [selectedDial, setSelectedDial] = useState<DialCodeEntry>(
    suggestedDialCode ?? { dialCode: "+47", flag: "🇳🇴" }
  );
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [localNumber, setLocalNumber] = useState("");

  // Auto-oppdater valgt landskode når land endres — men kun hvis bruker ikke har overstyrt manuelt
  const [userHasOverridden, setUserHasOverridden] = useState(false);
  useEffect(() => {
    if (suggestedDialCode && !userHasOverridden) {
      setSelectedDial(suggestedDialCode);
    }
  }, [suggestedDialCode]);

  // Kombiner landskode + lokalt nummer til fullt internasjonalt format
  const updatePhone = (dial: DialCodeEntry, number: string) => {
    const digits = number.replace(/[^0-9]/g, "");
    const full = digits ? `${dial.dialCode}${digits}` : "";
    handleChange("phone", full);
  };

  const handleDialSelect = (entry: DialCodeEntry) => {
    setSelectedDial(entry);
    setUserHasOverridden(true);
    setDialModalVisible(false);
    updatePhone(entry, localNumber);
  };

  const handleLocalNumberChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    setLocalNumber(digits);
    updatePhone(selectedDial, digits);
  };

  const showPhoneError = touchedFields.phone && !!errors.phone;

  return (
    <View style={{ gap: 16 }}>
      {/* E-post */}
      <View style={{ marginBottom: theme.spacing.md }}>
        <LabelWithTooltipNative label={t("auth.email")} tooltip={t("auth.emailTooltip")} />
        <TextInput
          style={{
            height: 48,
            paddingHorizontal: theme.spacing.md,
            borderWidth: 1,
            borderColor: (touchedFields.email && errors.email) ? theme.colors.borderError : theme.colors.border,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.backgroundInput,
            fontSize: theme.typography.md,
            color: theme.colors.textPrimary,
          }}
          value={formData.email}
          onChangeText={(v) => handleChange("email", v)}
          onBlur={() => handleBlur("email")}
          placeholder={t("auth.emailPlaceholderSignup")}
          placeholderTextColor={theme.colors.textPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {touchedFields.email && errors.email && (
          <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
            {errors.email}
          </Text>
        )}
      </View>

      {/* Telefon med landskode-picker */}
      <View style={{ marginBottom: theme.spacing.md }}>
        <LabelWithTooltipNative label={t("auth.phone")} tooltip={t("auth.phoneTooltip")} />
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>

          {/* Landskode-pill */}
          <TouchableOpacity
            onPress={() => setDialModalVisible(true)}
            style={{
              height: 48,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: theme.spacing.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.backgroundInput,
              gap: 4,
              minWidth: 80,
            }}
          >
            <Text style={{ fontSize: 18 }}>{selectedDial.flag}</Text>
            <Text style={{
              fontSize: theme.typography.sm,
              fontWeight: theme.typography.semibold,
              color: theme.colors.textPrimary,
            }}>
              {selectedDial.dialCode}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Lokalt nummer */}
          <TextInput
            style={{
              flex: 1,
              height: 48,
              paddingHorizontal: theme.spacing.md,
              borderWidth: 1,
              borderColor: showPhoneError ? theme.colors.borderError : theme.colors.border,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.backgroundInput,
              fontSize: theme.typography.md,
              color: theme.colors.textPrimary,
            }}
            value={localNumber}
            onChangeText={handleLocalNumberChange}
            onBlur={() => handleBlur("phone")}
            placeholder={t("auth.phonePlaceholder")}
            placeholderTextColor={theme.colors.textPlaceholder}
            keyboardType="phone-pad"
          />
        </View>
        {showPhoneError && (
          <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
            {errors.phone}
          </Text>
        )}
      </View>

      {/* Modal for å velge landskode */}
      <Modal
        visible={dialModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDialModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Modal-header */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.navbar,
          }}>
            <Text style={{
              fontSize: theme.typography.lg,
              fontWeight: theme.typography.semibold,
              color: theme.colors.navbarText,
            }}>
              {t("auth.selectDialCode")}
            </Text>
            <TouchableOpacity
              onPress={() => setDialModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.navbarText} />
            </TouchableOpacity>
          </View>

          {/* Liste over alle land/koder */}
          <FlatList
            data={ALL_DIAL_OPTIONS}
            keyExtractor={(item) => item.iso}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleDialSelect({ dialCode: item.dialCode, flag: item.flag })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor:
                    selectedDial.dialCode === item.dialCode && selectedDial.flag === item.flag
                      ? theme.colors.surface
                      : theme.colors.background,
                }}
              >
                <Text style={{ fontSize: 22, marginRight: theme.spacing.md }}>{item.flag}</Text>
                <Text style={{
                  flex: 1,
                  fontSize: theme.typography.md,
                  color: theme.colors.textPrimary,
                }}>
                  {item.iso}
                </Text>
                <Text style={{
                  fontSize: theme.typography.md,
                  fontWeight: theme.typography.semibold,
                  color: theme.colors.primary,
                }}>
                  {item.dialCode}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
