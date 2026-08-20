import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Shield } from "lucide-react-native";
import AppHeader from "@/components/common/AppHeader";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import { useNavigation } from "@react-navigation/native";
import E2EERestoreModal from "@/features/crypto/components/E2EERestoreModal";
import BackupPhraseModal from "@/features/crypto/components/BackupPhraseModal";
import { useEncryptionSettings } from "@/features/profile/hooks/useEncryptionSettings";

export default function CryptationScreen() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const {
    phase,
    backupPhrase,
    showBackupPhraseModal,
    isLoading,
    errorMessage,
    showRestoreModal,
    restoreMode,
    handleVerifyPassword,
    handleShowPhrase,
    handleCloseBackupPhraseModal,
    handleConfirmReset,
    handleCancelReset,
    handleCreateNewKeys,
    handleOpenRestoreModal,
    handleCloseRestoreModal,
    handleRestoreComplete,
  } = useEncryptionSettings();

  const onVerifyPassword = async () => {
    setPasswordError(null);
    await handleVerifyPassword(passwordInput);
    if (errorMessage) {
      setPasswordError(t(`profile.encryption.${errorMessage}`));
    }
    setPasswordInput("");
  };


  // Password gate
  if (phase === "password-gate") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          title={t("profile.encryption.title")}
          subtitle={t("profile.encryption.subtitle")}
          onBackPress={() => navigation.navigate("ProfileSettingsScreen" as never)}
          backIcon={ArrowLeft}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.lg, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center", gap: theme.spacing.lg, maxWidth: 400, alignSelf: "center", width: "100%", paddingVertical: theme.spacing.xl }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Shield size={48} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: theme.typography.xl, fontWeight: theme.typography.bold, color: theme.colors.textPrimary, textAlign: "center" }}>
                {t("profile.encryption.passwordGateTitle")}
              </Text>
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 24 }}>
                {t("profile.encryption.passwordGateDescription")}
              </Text>
              <View style={{ width: "100%", gap: theme.spacing.md }}>
                <PasswordFieldNative
                  id="encryptionPassword"
                  label={t("profile.encryption.currentPassword")}
                  value={passwordInput}
                  onChangeText={(text) => {
                    setPasswordInput(text);
                    setPasswordError(null);
                  }}
                  error={passwordError || undefined}
                  touched={!!passwordError}
                />
                <ButtonNative
                  text={isLoading ? t("profile.encryption.verifying") : t("profile.encryption.verifyPassword")}
                  onPress={onVerifyPassword}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading || !passwordInput}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Resetting
  if (phase === "resetting") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          title={t("profile.encryption.title")}
          subtitle={t("profile.encryption.subtitle")}
          onBackPress={() => navigation.navigate("ProfileSettingsScreen" as never)}
          backIcon={ArrowLeft}
        />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: theme.spacing.md }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ fontSize: theme.typography.md, color: theme.colors.textSecondary }}>
            {t("profile.encryption.resettingTitle")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error
  if (phase === "error") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          title={t("profile.encryption.title")}
          subtitle={t("profile.encryption.subtitle")}
          onBackPress={() => navigation.navigate("ProfileSettingsScreen" as never)}
          backIcon={ArrowLeft}
        />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: theme.spacing.lg }}>
          <Text style={{ fontSize: theme.typography.md, color: theme.colors.error, textAlign: "center" }}>
            {errorMessage ? t(`profile.encryption.${errorMessage}`) : t("common.error")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Meny
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t("profile.encryption.title")}
        subtitle={t("profile.encryption.subtitle")}
        onBackPress={() => navigation.navigate("ProfileSettingsScreen" as never)}
        backIcon={ArrowLeft}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, gap: theme.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={{
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}>
          <Text style={{ fontSize: theme.typography.md, fontWeight: theme.typography.semibold, color: theme.colors.onPrimary, marginBottom: theme.spacing.xs }}>
            {t("profile.encryption.infoTitle")}
          </Text>
          {(["infoLine1", "infoLine2", "infoLine3", "infoLine4"] as const).map((key) => (
            <Text key={key} style={{ fontSize: theme.typography.sm, color: theme.colors.onPrimary, lineHeight: 20 }}>
              {t(`profile.encryption.${key}`)}
            </Text>
          ))}
        </View>

        {/* Vis backup-frase */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          gap: theme.spacing.md,
        }}>
          <Text style={{ fontSize: theme.typography.lg, fontWeight: theme.typography.semibold, color: theme.colors.textPrimary }}>
            {t("profile.encryption.showPhraseTitle")}
          </Text>
          <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, lineHeight: 20 }}>
            {t("profile.encryption.showPhraseDescription")}
          </Text>
          <ButtonNative
            text={t("profile.encryption.showPhrase")}
            onPress={handleShowPhrase}
            variant="secondary"
            size="large"
            fullWidth
            loading={isLoading}
          />
        </View>

        {/* Gjenopprett fra backup-frase */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          gap: theme.spacing.md,
        }}>
          <Text style={{ fontSize: theme.typography.lg, fontWeight: theme.typography.semibold, color: theme.colors.textPrimary }}>
            {t("profile.encryption.restoreTitle")}
          </Text>
          <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary, lineHeight: 20 }}>
            {t("profile.encryption.restoreDescription")}
          </Text>
          <ButtonNative
            text={t("profile.encryption.restoreButton")}
            onPress={() => handleOpenRestoreModal("old")}
            variant="secondary"
            size="large"
            fullWidth
          />
        </View>

        {/* Bekreft reset */}
        {phase === "confirm-reset" && (
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            padding: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.colors.error,
            gap: theme.spacing.md,
          }}>
            <Text style={{ fontSize: theme.typography.lg, fontWeight: theme.typography.semibold, color: theme.colors.error }}>
              {t("profile.encryption.confirmResetTitle")}
            </Text>
            <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textPrimary, lineHeight: 20 }}>
              {t("profile.encryption.confirmResetWarning")}
            </Text>
            <ButtonNative
              text={t("profile.encryption.confirmResetButton")}
              onPress={handleCreateNewKeys}
              variant="danger"
              size="large"
              fullWidth
            />
            <ButtonNative
              text={t("profile.encryption.cancelButton")}
              onPress={handleCancelReset}
              variant="secondary"
              size="large"
              fullWidth
            />
          </View>
        )}

        {/* Danger zone */}
        {phase === "menu" && (
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            padding: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.colors.error,
            gap: theme.spacing.md,
          }}>
            <Text style={{ fontSize: theme.typography.lg, fontWeight: theme.typography.semibold, color: theme.colors.error }}>
              {t("profile.encryption.resetTitle")}
            </Text>
            <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textPrimary, lineHeight: 20 }}>
              {t("profile.encryption.resetDescription")}
            </Text>
            <ButtonNative
              text={t("profile.encryption.resetButton")}
              onPress={handleConfirmReset}
              variant="danger"
              size="large"
              fullWidth
            />
          </View>
        )}
      </ScrollView>

      <BackupPhraseModal
        visible={showBackupPhraseModal && !!backupPhrase}
        phrase={backupPhrase ?? ""}
        onContinue={handleCloseBackupPhraseModal}
      />

      <E2EERestoreModal
        visible={showRestoreModal}
        restoreMode={restoreMode}
        onRestore={handleRestoreComplete}
        onSkip={handleCloseRestoreModal}
        onClose={handleCloseRestoreModal}
      />
    </SafeAreaView>
  );
}
