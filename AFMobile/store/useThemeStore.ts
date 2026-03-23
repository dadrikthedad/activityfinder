// store/useThemeStore.ts
// Zustand store for tema-preferanse.
// Lagrer valgt tema i AsyncStorage så det huskes mellom app-oppstart.
//
// Bruk:
//   const { themeName, setTheme } = useThemeStore();
//   setTheme("dark"); // ← appen starter på nytt med nytt tema

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UnistylesRuntime } from "react-native-unistyles";
import { type ThemeName } from "@/core/theme/themes";

interface ThemeState {
  /** Aktivt tema-navn */
  themeName: ThemeName;
  /**
   * Bytter tema og persisterer valget.
   * Appen starter på nytt — dette er forventet oppførsel.
   * @param name - Tema-ID fra ThemeName
   */
  setTheme: (name: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: "light",

      setTheme: (name) => {
        // Oppdater unistyles runtime (trigger app-restart)
        UnistylesRuntime.setTheme(name);
        // Lagre i store så det persisteres
        set({ themeName: name });
      },
    }),
    {
      name: "af-theme-preference",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
