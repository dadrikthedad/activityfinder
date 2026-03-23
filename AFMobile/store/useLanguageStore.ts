// store/useLanguageStore.ts
// Zustand store for språkpreferanse.
// Lagrer valgt språk i AsyncStorage — samme mønster som useThemeStore.
//
// Bruk:
//   const { language, setLanguage } = useLanguageStore();
//   setLanguage("en"); // ← bytter språk umiddelbart, ingen app-restart

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { type SupportedLanguage } from "@/core/i18n";

interface LanguageState {
  /** Aktivt språk — "no" eller "en" */
  language: SupportedLanguage;
  /**
   * Bytter språk og persisterer valget.
   * Ingen app-restart nødvendig — i18next oppdaterer alle komponenter reaktivt.
   * @param lang - Språkkode fra SupportedLanguage
   */
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "no",

      setLanguage: (lang) => {
        // Oppdater i18next — alle komponenter som bruker useTranslation() oppdateres
        i18n.changeLanguage(lang);
        set({ language: lang });
      },
    }),
    {
      name: "af-language-preference",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
