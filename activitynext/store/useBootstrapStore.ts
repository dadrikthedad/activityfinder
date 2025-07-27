import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { UserSettingsDTO } from "@/types/UserSettingsDTO";
import { CriticalBootstrapResponseDTO } from "@/types/bootstrap/CriticalBootstrapResponseDTO";
import { SecondaryBootstrapResponseDTO } from "@/types/bootstrap/SecondaryBootstrapResponseDTO";

type BootstrapStore = {
  // Critical data (lagres her)
  user: UserSummaryDTO | null;
  syncToken: string | null;
  
  // Secondary data (lagres her)
  settings: UserSettingsDTO | null;
  
  // Loading states
  criticalLoading: boolean;
  secondaryLoading: boolean;
  isBootstrapped: boolean;
  
  // Error states
  criticalError: string | null;
  secondaryError: string | null;
  
  // ✅ Cache timestamps (fra eksisterende store)
  criticalCacheTimestamp: number;
  secondaryCacheTimestamp: number;
  
  // ✅ Loading flags (fra eksisterende store)
  hasLoadedCritical: boolean;
  hasLoadedSecondary: boolean;
  
  // Actions - Critical data
  setCriticalData: (data: CriticalBootstrapResponseDTO) => void;
  setCriticalLoading: (loading: boolean) => void;
  setCriticalError: (error: string | null) => void;
  setUser: (user: UserSummaryDTO) => void;
  setSyncToken: (token: string) => void;
  
  // Actions - Secondary data  
  setSecondaryData: (data: SecondaryBootstrapResponseDTO) => void;
  setSecondaryLoading: (loading: boolean) => void;
  setSecondaryError: (error: string | null) => void;
  setSettings: (settings: UserSettingsDTO) => void;
  
  // Cache management (fra eksisterende store)
  cleanupOldCache: () => void;
  isCriticalCacheValid: () => boolean;
  isSecondaryCacheValid: () => boolean;
  
  // Bootstrap state management
  setBootstrapped: (value: boolean) => void;
  markCriticalAsLoaded: () => void;
  markSecondaryAsLoaded: () => void;
  
  /** Tøm alt ved logout */
  reset: () => void;
};

export const useBootstrapStore = create<BootstrapStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // --- Initial state ---
      user: null,
      syncToken: null,
      settings: null,
      
      criticalLoading: false,
      secondaryLoading: false,
      isBootstrapped: false,
      
      criticalError: null,
      secondaryError: null,
      
      criticalCacheTimestamp: 0,
      secondaryCacheTimestamp: 0,
      
      hasLoadedCritical: false,
      hasLoadedSecondary: false,

      // --- Critical data actions ---
      setCriticalData: (data: CriticalBootstrapResponseDTO) =>
        set(() => ({
          user: data.user,
          syncToken: data.syncToken,
          criticalLoading: false,
          criticalError: null,
          criticalCacheTimestamp: Date.now(),
          hasLoadedCritical: true,
        })),

      setCriticalLoading: (loading: boolean) =>
        set(() => ({ criticalLoading: loading })),

      setCriticalError: (error: string | null) =>
        set(() => ({ 
          criticalError: error, 
          criticalLoading: false,
        })),

      setUser: (user: UserSummaryDTO) =>
        set(() => ({ user })),

      setSyncToken: (token: string) =>
        set(() => ({ syncToken: token })),

      // --- Secondary data actions ---
      setSecondaryData: (data: SecondaryBootstrapResponseDTO) =>
        set((state) => ({
          settings: data.settings,
          secondaryLoading: false,
          secondaryError: null,
          secondaryCacheTimestamp: Date.now(),
          hasLoadedSecondary: true,
          // isBootstrapped settes kun når BÅDE critical og secondary er loaded
          isBootstrapped: state.hasLoadedCritical && true,
        })),

      setSecondaryLoading: (loading: boolean) =>
        set(() => ({ secondaryLoading: loading })),

      setSecondaryError: (error: string | null) =>
        set(() => ({ 
          secondaryError: error, 
          secondaryLoading: false 
        })),

      setSettings: (settings: UserSettingsDTO) =>
        set(() => ({ settings })),

      // --- ✅ Cache management (fra eksisterende store) ---
      cleanupOldCache: () =>
        set((state) => {
          console.log("🧹 Cleaning up bootstrap cache at", new Date().toLocaleTimeString());
          
          const now = Date.now();
          const CRITICAL_TTL = 1000 * 60 * 60; // 1 time
          const SECONDARY_TTL = 1000 * 60 * 60 * 6; // 6 timer
          
          let resetCritical = false;
          let resetSecondary = false;
          
          // Sjekk om critical cache er for gammelt
          if (state.criticalCacheTimestamp && (now - state.criticalCacheTimestamp > CRITICAL_TTL)) {
            resetCritical = true;
            console.log("🧹 Critical cache expired, resetting");
          }
          
          // Sjekk om secondary cache er for gammelt
          if (state.secondaryCacheTimestamp && (now - state.secondaryCacheTimestamp > SECONDARY_TTL)) {
            resetSecondary = true;
            console.log("🧹 Secondary cache expired, resetting");
          }
          
          if (!resetCritical && !resetSecondary) {
            console.log("🧹 Cache still valid, no cleanup needed");
            return {};
          }
          
          const updates: Partial<BootstrapStore> = {};
          
          if (resetCritical) {
            updates.user = null;
            updates.syncToken = null;
            updates.criticalCacheTimestamp = 0;
            updates.hasLoadedCritical = false;
            updates.isBootstrapped = false;
          }
          
          if (resetSecondary) {
            updates.settings = null;
            updates.secondaryCacheTimestamp = 0;
            updates.hasLoadedSecondary = false;
            // Kun reset isBootstrapped hvis critical også resettes
            if (!resetCritical) {
              updates.isBootstrapped = false;
            }
          }
          
          return updates;
        }),

      isCriticalCacheValid: () => {
        const state = get();
        const now = Date.now();
        const TTL = 1000 * 60 * 60; // 1 time
        
        return state.criticalCacheTimestamp > 0 && 
               (now - state.criticalCacheTimestamp < TTL) &&
               state.hasLoadedCritical;
      },

      isSecondaryCacheValid: () => {
        const state = get();
        const now = Date.now();
        const TTL = 1000 * 60 * 60 * 6; // 6 timer
        
        return state.secondaryCacheTimestamp > 0 && 
               (now - state.secondaryCacheTimestamp < TTL) &&
               state.hasLoadedSecondary;
      },

      // --- Bootstrap state management ---
      setBootstrapped: (value: boolean) =>
        set(() => ({ isBootstrapped: value })),

      markCriticalAsLoaded: () =>
        set(() => ({ hasLoadedCritical: true })),

      markSecondaryAsLoaded: () =>
        set(() => ({ hasLoadedSecondary: true })),

      // --- Reset for logout ---
      reset: () =>
        set({
          user: null,
          syncToken: null,
          settings: null,
          
          criticalLoading: false,
          secondaryLoading: false,
          isBootstrapped: false,
          
          criticalError: null,
          secondaryError: null,
          
          criticalCacheTimestamp: 0,
          secondaryCacheTimestamp: 0,
          
          hasLoadedCritical: false,
          hasLoadedSecondary: false,
        }),
    })),
    {
      name: "bootstrap-cache",
      storage: createJSONStorage(() => indexedDBStorage),

      /**
       * ✅ partialize fra eksisterende store - lagre alt som er nyttig for caching
       */
      partialize: (state) => ({
        // Critical data
        user: state.user,
        syncToken: state.syncToken,
        criticalCacheTimestamp: state.criticalCacheTimestamp,
        hasLoadedCritical: state.hasLoadedCritical,
        
        // Secondary data
        settings: state.settings,
        secondaryCacheTimestamp: state.secondaryCacheTimestamp,
        hasLoadedSecondary: state.hasLoadedSecondary,
        
        // Bootstrap state
        isBootstrapped: state.isBootstrapped,
      }),

      version: 1,
      migrate: (persisted: unknown) => {
        // ✅ Håndter migrering fra eksisterende store
        const state = persisted as Partial<BootstrapStore>;
        return state as BootstrapStore;
      },
    }
  )
);