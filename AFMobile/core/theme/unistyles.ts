// core/theme/unistyles.ts
// Konfigurerer alle temaer i react-native-unistyles v3.
// Denne filen MÅ importeres én gang tidlig i app-oppstart (før første render).
// Vi importerer den øverst i App.tsx.
//
// V3 API: StyleSheet.configure() — ikke UnistylesRegistry (det var v2)

import { StyleSheet } from "react-native-unistyles";
import { appThemes, type ThemeName } from "./themes";

// Konfigurer temaer og standard
StyleSheet.configure({
  themes: appThemes,
  settings: {
    initialTheme: "light" as ThemeName,
  },
});

// Typeutvidelse — gjør at StyleSheet.create() kjenner til alle våre temaer
// og gir full autocomplete på theme.colors.primary osv.
type AppThemes = typeof appThemes;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}
