// components/settings/ThemeSelector.tsx
import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useUnistyles, UnistylesRuntime } from "react-native-unistyles";
import { useThemeStore } from "@/store/useThemeStore";
import { type ThemeName } from "@/core/theme/themes";

const themeLabels: Record<ThemeName, string> = {
  light: "☀️  Lyst",
  dark:  "🌙  Mørkt",
};

/**
 * Viser tilgjengelige temaer som trykkbare alternativer.
 * Aktivt tema er markert. Bytte trigger app-restart.
 */
export default function ThemeSelector() {
  const { themeName, setTheme } = useThemeStore();
  const { theme } = useUnistyles();

  const handleThemeChange = (name: ThemeName) => {
    if (name === themeName) return;

    Alert.alert(
      "Bytt tema",
      `Bytte til "${themeLabels[name]}" vil starte appen på nytt.`,
      [
        { text: "Avbryt", style: "cancel" },
        { text: "Bytt", onPress: () => setTheme(name) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.colors.textMuted }]}>Tema</Text>
      <View style={styles.row}>
        {(Object.keys(themeLabels) as ThemeName[]).map((name) => {
          const isActive = name === themeName;
          return (
            <TouchableOpacity
              key={name}
              style={[
                styles.option,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                isActive && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
              ]}
              onPress={() => handleThemeChange(name)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                { color: theme.colors.textPrimary },
                isActive && { color: theme.colors.onPrimary, fontWeight: "600" },
              ]}>
                {themeLabels[name]}
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
