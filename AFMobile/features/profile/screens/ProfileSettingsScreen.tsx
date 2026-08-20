import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

import { useUpdateUserField } from "@/hooks/useUpdateUserField";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useCountryName } from "@/features/profile/hooks/useCountryName";
import { changePassword } from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";

import AppHeader from "@/components/common/AppHeader";
import AdditionalSettingsNative from "@/features/profile/components/AdditionalSettingsNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";

import type { ProfileSettingsScreenNavigationProp } from "@/types/navigation";

export default function ProfileSettingsScreen() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileSettingsScreenNavigationProp>();

  const currentUser = useUserCacheStore((s) => s.currentUser);
  const profile = useUserCacheStore((s) => s.profile);
  const setCurrentUser = useUserCacheStore((s) => s.setCurrentUser);
  const countryName = useCountryName(profile?.countryCode);

  const { updateField, isSubmitting: isNameSubmitting } = useUpdateUserField();

  const [nameEditMode, setNameEditMode] = useState(false);
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? "");
  const [lastName, setLastName] = useState(currentUser?.lastName ?? "");

  const [passwordEditMode, setPasswordEditMode] = useState(false);
  const [currentPasswordValue, setCurrentPasswordValue] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmNewPasswordValue, setConfirmNewPasswordValue] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveName = async () => {
    const ok = await updateField("updateName", { firstName, lastName });
    if (ok) {
      if (currentUser) setCurrentUser({ ...currentUser, firstName, lastName });
      setNameEditMode(false);
    }
  };

  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  } as const;

  const handleCancelName = () => {
    setFirstName(currentUser?.firstName ?? "");
    setLastName(currentUser?.lastName ?? "");
    setNameEditMode(false);
  };

  const passwordRequirementsRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const handleSavePassword = async () => {
    setPasswordError(null);
    if (!passwordRequirementsRegex.test(newPasswordValue)) {
      setPasswordError(t("auth.passwordTooltip"));
      return;
    }
    if (newPasswordValue !== confirmNewPasswordValue) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    setIsPasswordSubmitting(true);
    const result = await changePassword(currentPasswordValue, newPasswordValue, confirmNewPasswordValue);
    setIsPasswordSubmitting(false);
    if (!result.success) {
      switch (result.code) {
        case AccountErrorCode.InvalidCurrentPassword:
          setPasswordError(t("profile.wrongCurrentPassword"));
          break;
        case AccountErrorCode.RateLimited:
          setPasswordError(t("profile.changeEmailRateLimit"));
          break;
        default:
          setPasswordError(result.error ?? t("profile.serverErrorBody"));
      }
      return;
    }
    setPasswordEditMode(false);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
    setConfirmNewPasswordValue("");
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("profile.passwordChanged"),
      customBody: t("profile.passwordChangedBody"),
    });
  };

  const isPasswordSaveDisabled =
    isPasswordSubmitting ||
    !currentPasswordValue.trim() ||
    !newPasswordValue.trim() ||
    !confirmNewPasswordValue.trim();

  const handleCancelPassword = () => {
    setPasswordEditMode(false);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
    setConfirmNewPasswordValue("");
    setPasswordError(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <AppHeader
        title={t("profile.settingsTitle")}
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Seksjon: Brukerinfo ── */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.lg }}>

          {/* Kombinert navnekort */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                {t("profile.name")}
              </Text>
              {!nameEditMode && (
                <TouchableOpacity onPress={() => setNameEditMode(true)}>
                  <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                    {t("profile.editName")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {nameEditMode ? (
              <>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={t("profile.firstName")}
                  placeholderTextColor={theme.colors.textPlaceholder}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.borderFocus,
                    borderRadius: theme.radii.sm,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    fontSize: theme.typography.md,
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.backgroundInput,
                  }}
                />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t("profile.lastName")}
                  placeholderTextColor={theme.colors.textPlaceholder}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.borderFocus,
                    borderRadius: theme.radii.sm,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    fontSize: theme.typography.md,
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.backgroundInput,
                  }}
                />
                <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                  <TouchableOpacity
                    onPress={handleSaveName}
                    disabled={isNameSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: isNameSubmitting ? theme.colors.disabled : theme.colors.primary,
                      borderRadius: theme.radii.sm,
                      paddingVertical: theme.spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: theme.colors.onPrimary, fontSize: theme.typography.sm, fontWeight: theme.typography.semibold }}>
                      {isNameSubmitting ? t("profile.saving") : t("profile.saveName")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCancelName}
                    disabled={isNameSubmitting}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.sm,
                      paddingVertical: theme.spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.sm }}>
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
                {[currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ") || "—"}
              </Text>
            )}
          </View>

          {/* Fødselsdatokort */}
          {profile?.dateOfBirth && (
            <View style={cardStyle}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                  {t("profile.dateOfBirth")}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("EditProfileScreen")}>
                  <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                    {t("profile.editDateOfBirth")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
                {format(parseISO(profile.dateOfBirth), "dd.MM.yyyy")}
              </Text>
            </View>
          )}

          {/* Landkort */}
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                {t("profile.country")}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("EditProfileScreen")}>
                <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                  {t("profile.editCountry")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: theme.typography.md, color: profile?.countryCode ? theme.colors.textPrimary : theme.colors.textMuted }}>
              {profile?.countryCode ? countryName : "—"}
            </Text>
          </View>

          {/* E-postkort */}
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                {t("profile.email")}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("ChangeEmailScreen")}>
                <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                  {t("profile.editEmail")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
              {currentUser?.email || "—"}
            </Text>
          </View>

          {/* Telefonnummerkort */}
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                {t("profile.phone")}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("ChangePhoneScreen")}>
                <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                  {t("profile.editPhone")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
              {currentUser?.phoneNumber || "—"}
            </Text>
          </View>

          {/* Passordkort */}
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.medium }}>
                {t("profile.password")}
              </Text>
              {!passwordEditMode && (
                <TouchableOpacity onPress={() => setPasswordEditMode(true)}>
                  <Text style={{ fontSize: theme.typography.sm, color: theme.colors.primary, fontWeight: theme.typography.medium }}>
                    {t("profile.changePasswordTitle")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {passwordEditMode ? (
              <>
                <PasswordFieldNative
                  id="currentPassword"
                  label={t("profile.currentPassword")}
                  value={currentPasswordValue}
                  onChangeText={setCurrentPasswordValue}
                />
                <PasswordFieldNative
                  id="newPassword"
                  label={t("auth.newPassword")}
                  value={newPasswordValue}
                  onChangeText={setNewPasswordValue}
                />
                <PasswordFieldNative
                  id="confirmNewPassword"
                  label={t("auth.confirmNewPassword")}
                  value={confirmNewPasswordValue}
                  onChangeText={setConfirmNewPasswordValue}
                />
                {passwordError && (
                  <Text style={{ fontSize: theme.typography.sm, color: theme.colors.error }}>
                    {passwordError}
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                  <TouchableOpacity
                    onPress={handleSavePassword}
                    disabled={isPasswordSaveDisabled}
                    style={{
                      flex: 1,
                      backgroundColor: isPasswordSaveDisabled ? theme.colors.disabled : theme.colors.primary,
                      borderRadius: theme.radii.sm,
                      paddingVertical: theme.spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: theme.colors.onPrimary, fontSize: theme.typography.sm, fontWeight: theme.typography.semibold }}>
                      {isPasswordSubmitting ? t("profile.changePasswordSubmitting") : t("profile.changePasswordSubmit")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCancelPassword}
                    disabled={isPasswordSubmitting}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.sm,
                      paddingVertical: theme.spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.sm }}>
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textPrimary }}>
                {"••••••••"}
              </Text>
            )}
          </View>

        </View>

        {/* ── Seksjon: Personvern og varsler ── */}
        <AdditionalSettingsNative />

        {/* ── Navigasjonsknapper ── */}
        <View
          style={{
            flexDirection: "column",
            gap: theme.spacing.md,
            marginTop: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <ButtonNative
            text={t("profile.editProfileTitle")}
            onPress={() => navigation.navigate("EditProfileScreen")}
            variant="outline"
            size="large"
            fullWidth
          />

          <ButtonNative
            text={t("profile.manageEncryption")}
            onPress={() => navigation.navigate("CryptationScreen")}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
