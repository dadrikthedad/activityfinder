// features/account/screens/ChangePhoneScreen.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  FlatList, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import AppHeader from "@/components/common/AppHeader";
import { requestPhoneChange } from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { DIAL_CODES, DialCodeEntry } from "@/core/data/phoneDialCodes";

const ALL_DIAL_OPTIONS = Object.entries(DIAL_CODES)
  .map(([iso, entry]) => ({ iso, ...entry }))
  .sort((a, b) => a.iso.localeCompare(b.iso));

type Props = StackScreenProps<RootStackParamList, "ChangePhoneScreen">;

export default function ChangePhoneScreen({ navigation }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [selectedDial, setSelectedDial] = useState<DialCodeEntry>({ dialCode: "+47", flag: "🇳🇴" });
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newPhone = localNumber ? `${selectedDial.dialCode}${localNumber}` : "";
  const canSubmit = currentPassword.length > 0 && localNumber.length >= 4 && !isSubmitting;

  const handleLocalNumberChange = (text: string) => {
    setLocalNumber(text.replace(/[^0-9]/g, ""));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await requestPhoneChange(currentPassword, newPhone);
    setIsSubmitting(false);

    if (!result.success) {
      let body = result.error;
      if (result.code === AccountErrorCode.InvalidCurrentPassword) body = t("profile.wrongCurrentPassword");
      if (result.code === AccountErrorCode.Conflict) body = t("profile.phoneAlreadyInUse");
      if (result.code === AccountErrorCode.RateLimited) body = t("profile.changePhoneRateLimit");

      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("profile.changePhoneErrorTitle"),
        customBody: body,
        position: "top",
      });
      return;
    }

    navigation.replace("VerifyEmailForPhoneChangeScreen", { newPhone, currentPassword });
  };

  const goBack = () =>
    navigation.reset({ index: 0, routes: [{ name: "ProfileSettingsScreen" }] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <AppHeader
        title={t("profile.changePhoneTitle")}
        onBackPress={goBack}
        backIcon={ArrowLeft}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
            paddingBottom: theme.spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{
            fontSize: theme.typography.sm,
            color: theme.colors.textSecondary,
            textAlign: "center",
            marginBottom: theme.spacing.xl,
          }}>
            {t("profile.changePhoneDescription")}
          </Text>

          <View style={{ gap: theme.spacing.md }}>
            <PasswordFieldNative
              id="currentPassword"
              label={t("auth.password")}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              disabled={isSubmitting}
            />

            <View>
              <Text style={{
                fontSize: theme.typography.sm,
                fontWeight: theme.typography.medium,
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.xs,
              }}>
                {t("profile.newPhone")}
              </Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                {/* Landskode-pill */}
                <TouchableOpacity
                  onPress={() => setDialModalVisible(true)}
                  disabled={isSubmitting}
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
                    minWidth: 84,
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
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                    backgroundColor: theme.colors.backgroundInput,
                    fontSize: theme.typography.md,
                    color: theme.colors.textPrimary,
                  }}
                  value={localNumber}
                  onChangeText={handleLocalNumberChange}
                  placeholder={t("auth.phonePlaceholder")}
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.xl }}>
            <ButtonNative
              text={t("profile.changePhoneSubmit")}
              loadingText={t("profile.changePhoneSubmitting")}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Landskode-modal */}
      <Modal
        visible={dialModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDialModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
          <FlatList
            data={ALL_DIAL_OPTIONS}
            keyExtractor={(item) => item.iso}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedDial({ dialCode: item.dialCode, flag: item.flag });
                  setDialModalVisible(false);
                }}
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
                <Text style={{ flex: 1, fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
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
    </SafeAreaView>
  );
}
