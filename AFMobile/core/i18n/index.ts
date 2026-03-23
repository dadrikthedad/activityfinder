// core/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import no from "./locales/no";
import en from "./locales/en";

export const resources = { no: { translation: no }, en: { translation: en } } as const;

type SupportedLanguage = keyof typeof resources;

/**
 * Oppdager telefonens foretrukne språk og returnerer nærmeste støttede kode.
 * Pakket i try/catch fordi expo-localization kan krasje hvis Hermes-runtimen
 * ikke er klar ennå ved synkron modul-load (Hermes "Runtime not ready"-feil).
 * Faller tilbake til "no" i alle feiltilfeller.
 */
function detectDeviceLanguage(): SupportedLanguage {
  try {
    const Localization = require("expo-localization");
    const locales = Localization.getLocales?.();
    if (!locales) return "no";
    for (const locale of locales) {
      const lang = locale.languageCode ?? "";
      if (lang in resources) return lang as SupportedLanguage;
    }
  } catch {
    // Runtime ikke klar ennå — brukerens lagrede preferanse tar over i AppContent
  }
  return "no";
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: "no",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
export type { SupportedLanguage };
