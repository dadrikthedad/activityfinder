// features/auth/screens/E2EESetupScreen.tsx
import React, { useState } from "react";
import {
  View, Text, SafeAreaView, ActivityIndicator,
  ScrollView, Alert, StatusBar,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { Shield, KeyRound, AlertTriangle } from "lucide-react-native";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import FormFieldNative from "@/components/common/FormFieldNative";
import { useE2EESetup } from "@/features/auth/hooks/useE2EESetup";
import { E2EESetupScreenRouteProp } from "@/types/navigation";

export default function E2EESetupScreen() {
  const route = useRoute<E2EESetupScreenRouteProp>();
  const { accessToken, refreshToken } = route.params;
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [showNewKeyConfirm, setShowNewKeyConfirm] = useState(false);

  const {
    scenario,
    errorMessage,
    backupPhrase,
    setBackupPhrase,
    isRestoring,
    isCreatingNew,
    handleRestoreFromPhrase,
    handleCreateNewKeys,
    handleRetryCreate,
  } = useE2EESetup(accessToken, refreshToken);

  const handleCreateNewKeysPress = () => {
    Alert.alert(
      t("e2ee.newKeyWarningTitle"),
      t("e2ee.newKeyWarningBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("e2ee.createNewKeyConfirm"),
          style: "destructive",
          onPress: handleCreateNewKeys,
        },
      ]
    );
  };

  // Scenario A — feilet, vis retry
  if (scenario === "error-new-key") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        }}>
          <AlertTriangle size={48} color={theme.colors.error} />
          <Text style={{
            fontSize: theme.typography.lg,
            fontWeight: theme.typography.semibold,
            color: theme.colors.textPrimary,
            textAlign: "center",
          }}>
            {t("e2ee.setupFailed")}
          </Text>
          <Text style={{
            fontSize: theme.typography.md,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}>
            {errorMessage}
          </Text>
          <ButtonNative
            text={t("e2ee.retryButton")}
            onPress={handleRetryCreate}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  // Scenario A + B — loading/creating
  if (scenario === "loading" || scenario === "creating") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.surface,
            justifyContent: "center",
            alignItems: "center",
          }}>
            <Shield size={36} color={theme.colors.primary} />
          </View>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{
            fontSize: theme.typography.md,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}>
            {scenario === "creating" ? t("e2ee.generatingKeys") : t("e2ee.checkingKeys")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error
  if (scenario === "error") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        }}>
          <AlertTriangle size={48} color={theme.colors.error} />
          <Text style={{
            fontSize: theme.typography.lg,
            fontWeight: theme.typography.semibold,
            color: theme.colors.textPrimary,
            textAlign: "center",
          }}>
            {t("e2ee.setupFailed")}
          </Text>
          <Text style={{
            fontSize: theme.typography.md,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}>
            {errorMessage}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Scenario C — ny enhet, trenger gjenoppretting
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />

      {/* Header */}
      <View style={{
        backgroundColor: theme.colors.navbar,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
        alignItems: "center",
        gap: theme.spacing.sm,
      }}>
        <View style={{
          width: 72,
          height: 72,
          borderRadius: theme.radii.full,
          backgroundColor: "rgba(255,255,255,0.1)",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <KeyRound size={36} color={theme.colors.primary} />
        </View>
        <Text style={{
          fontSize: theme.typography.xl,
          fontWeight: theme.typography.bold,
          color: theme.colors.navbarText,
          textAlign: "center",
        }}>
          {t("e2ee.restoreTitle")}
        </Text>
        <Text style={{
          fontSize: theme.typography.sm,
          color: theme.colors.textMuted,
          textAlign: "center",
        }}>
          {t("e2ee.restoreSubtitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          maxWidth: 400,
          alignSelf: "center",
          width: "100%",
          gap: theme.spacing.lg,
        }}>

          {/* Gjenopprett fra backup-phrase */}
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 3,
          }}>
            <Text style={{
              fontSize: theme.typography.md,
              fontWeight: theme.typography.semibold,
              color: theme.colors.textPrimary,
            }}>
              {t("e2ee.restoreFromPhrase")}
            </Text>
            <Text style={{
              fontSize: theme.typography.sm,
              color: theme.colors.textSecondary,
              lineHeight: 20,
            }}>
              {t("e2ee.restoreFromPhraseDesc")}
            </Text>

            <FormFieldNative
              id="backupPhrase"
              label={t("e2ee.backupPhraseLabel")}
              value={backupPhrase}
              onChangeText={setBackupPhrase}
              placeholder={t("e2ee.backupPhrasePlaceholder")}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              error={errorMessage || undefined}
              touched={!!errorMessage}
            />

            <ButtonNative
              text={t("e2ee.restoreButton")}
              loadingText={t("e2ee.restoring")}
              onPress={handleRestoreFromPhrase}
              loading={isRestoring}
              disabled={isRestoring || isCreatingNew || !backupPhrase.trim()}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>

          {/* Opprett ny nøkkel — destruktiv */}
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.colors.error,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 3,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <AlertTriangle size={18} color={theme.colors.error} />
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.error,
              }}>
                {t("e2ee.createNewKeyTitle")}
              </Text>
            </View>
            <Text style={{
              fontSize: theme.typography.sm,
              color: theme.colors.textSecondary,
              lineHeight: 20,
            }}>
              {t("e2ee.createNewKeyDesc")}
            </Text>

            <ButtonNative
              text={t("e2ee.createNewKey")}
              loadingText={t("e2ee.creatingKeys")}
              onPress={handleCreateNewKeysPress}
              loading={isCreatingNew}
              disabled={isRestoring || isCreatingNew}
              variant="danger"
              size="large"
              fullWidth
            />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
