// components/settings/LanguageSelector.tsx
// Komponent for å bytte språk i innstillinger.
// Språkbytte er umiddelbart — ingen app-restart nødvendig.
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { useLanguageStore } from "@/store/useLanguageStore";
import { type SupportedLanguage } from "@/core/i18n";

const languageCodes: SupportedLanguage[] = ["no", "en"];

/**
 * Viser tilgjengelige språk som trykkbare alternativer.
 * Aktivt språk er markert. Bytte skjer umiddelbart uten restart.
 */
export default function LanguageSelector() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.colors.textMuted }]}>
        {t("settings.language")}
      </Text>
      <View style={styles.row}>
        {languageCodes.map((code) => {
          const isActive = code === language;
          // Henter label fra oversettelsene — "🇳🇴  Norsk" / "🇬🇧  Engelsk"
          const label = t(`settings.languages.${code}`);
          return (
            <TouchableOpacity
              key={code}
              style={[
                styles.option,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                isActive && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setLanguage(code)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                { color: theme.colors.textPrimary },
                isActive && { color: theme.colors.onPrimary, fontWeight: "600" },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  heading: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
