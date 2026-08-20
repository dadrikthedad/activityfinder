import React, { useState } from "react";
import { View, Text } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

import CheckboxFieldNative from "./CheckboxFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import LanguageSelector from "@/components/settings/LanguageSelector";
import ThemeSelector from "@/components/settings/ThemeSelector";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { updateSettings } from "@/features/profile/services/settingsService";
import { useUserCacheStore, useUserSettings } from "@/store/useUserCacheStore";
import { UserSettingsDTO } from "@shared/types/UserSettingsDTO";

export default function AdditionalSettingsNative() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const cachedSettings = useUserSettings();
  const setSettings = useUserCacheStore((s) => s.setSettings);

  const [localSettings, setLocalSettings] = useState<UserSettingsDTO | null>(cachedSettings);
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof UserSettingsDTO) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, [key]: !localSettings[key] });
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    const result = await updateSettings(localSettings);
    setSaving(false);

    if (!result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.saveErrorTitle"),
        customBody: result.error ?? t("profile.serverErrorBody"),
        position: "top",
      });
      return;
    }

    setSettings(localSettings);
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("profile.savedTitle"),
      customBody: t("profile.savedBody"),
      position: "top",
    });
  };

  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderTopWidth: 2,
    borderTopColor: theme.colors.primary,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xl,
  } as const;

  const sectionTitleStyle = {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.medium,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  } as const;

  const dividerStyle = {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  } as const;

  if (!localSettings) return null;

  return (
    <View style={cardStyle}>
      <Text
        style={{
          fontSize: theme.typography.lg,
          fontWeight: theme.typography.semibold,
          color: theme.colors.textPrimary,
          textAlign: "center",
          marginBottom: theme.spacing.md,
        }}
      >
        {t("profile.additionalSettingsTitle")}
      </Text>

      {/* Språk */}
      <View style={dividerStyle}>
        <LanguageSelector />
      </View>

      {/* Tema */}
      <View style={dividerStyle}>
        <ThemeSelector />
      </View>

      {/* Varsler */}
      <Text style={sectionTitleStyle}>{t("profile.notificationSettings")}</Text>
      <CheckboxFieldNative
        label={t("profile.receiveEmailNotifications")}
        checked={localSettings.receiveEmailNotifications}
        onChange={() => toggle("receiveEmailNotifications")}
      />
      <CheckboxFieldNative
        label={t("profile.receivePushNotifications")}
        checked={localSettings.receivePushNotifications}
        onChange={() => toggle("receivePushNotifications")}
      />

      {/* Personvern */}
      <Text style={{ ...sectionTitleStyle, marginTop: theme.spacing.lg }}>
        {t("profile.privacySettings")}
      </Text>
      <CheckboxFieldNative
        label={t("profile.publicProfile")}
        checked={localSettings.publicProfile}
        onChange={() => toggle("publicProfile")}
      />
      <CheckboxFieldNative
        label={t("profile.showEmail")}
        checked={localSettings.showEmail}
        onChange={() => toggle("showEmail")}
      />
      <CheckboxFieldNative
        label={t("profile.showPhone")}
        checked={localSettings.showPhone}
        onChange={() => toggle("showPhone")}
      />
      <CheckboxFieldNative
        label={t("profile.showWebsites")}
        checked={localSettings.showWebsites}
        onChange={() => toggle("showWebsites")}
      />
      <CheckboxFieldNative
        label={t("profile.showAge")}
        checked={localSettings.showAge}
        onChange={() => toggle("showAge")}
      />
      <CheckboxFieldNative
        label={t("profile.showBirthday")}
        checked={localSettings.showBirthday}
        onChange={() => toggle("showBirthday")}
      />

      {/* Lagre */}
      <View style={{ marginTop: theme.spacing.lg }}>
        <ButtonNative
          text={t("profile.savePreferences")}
          onPress={handleSave}
          variant="primary"
          size="large"
          fullWidth
          loading={saving}
          disabled={saving}
        />
      </View>
    </View>
  );
}
