import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";

type BootstrapStore = {
  syncToken: string | null;

  // Loading states
  criticalLoading: boolean;
  secondaryLoading: boolean;
  isBootstrapped: boolean;

  // Error states
  criticalError: string | null;
  secondaryError: string | null;

  // Cache timestamps
  criticalCacheTimestamp: number;
  secondaryCacheTimestamp: number;

  // Loading flags
  hasLoadedCritical: boolean;
  hasLoadedSecondary: boolean;

  // Actions
  setSyncToken: (token: string | null) => void;
  setCriticalLoading: (loading: boolean) => void;
  setCriticalError: (error: string | null) => void;
  setSecondaryLoading: (loading: boolean) => void;
  setSecondaryError: (error: string | null) => void;

  // Oppdater cache-metadata etter vellykket critical bootstrap
  markCriticalLoaded: (syncToken?: string | null) => void;
  // Oppdater cache-metadata etter vellykket secondary bootstrap
  markSecondaryLoaded: () => void;

  // Cache management
  cleanupOldCache: () => void;
  isCriticalCacheValid: () => boolean;
  isSecondaryCacheValid: () => boolean;

  // Bootstrap state
  setBootstrapped: (value: boolean) => void;
  markCriticalAsLoaded: () => void;
  markSecondaryAsLoaded: () => void;

  /** Tøm alt ved logout */
  reset: () => void;
};

export const useBootstrapStore = create<BootstrapStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      syncToken: null,

      criticalLoading: false,
      secondaryLoading: false,
      isBootstrapped: false,

      criticalError: null,
      secondaryError: null,

      criticalCacheTimestamp: 0,
      secondaryCacheTimestamp: 0,

      hasLoadedCritical: false,
      hasLoadedSecondary: false,

      setSyncToken: (token) => set({ syncToken: token }),

      setCriticalLoading: (loading) => set({ criticalLoading: loading }),

      setCriticalError: (error) => set({ criticalError: error, criticalLoading: false }),

      setSecondaryLoading: (loading) => set({ secondaryLoading: loading }),

      setSecondaryError: (error) => set({ secondaryError: error, secondaryLoading: false }),

      markCriticalLoaded: (syncToken) =>
        set((state) => ({
          syncToken: syncToken !== undefined ? syncToken : state.syncToken,
          criticalLoading: false,
          criticalError: null,
          criticalCacheTimestamp: Date.now(),
          hasLoadedCritical: true,
        })),

      markSecondaryLoaded: () =>
        set((state) => ({
          secondaryLoading: false,
          secondaryError: null,
          secondaryCacheTimestamp: Date.now(),
          hasLoadedSecondary: true,
          isBootstrapped: state.hasLoadedCritical,
        })),

      cleanupOldCache: () =>
        set((state) => {
          const now = Date.now();
          const CRITICAL_TTL = 1000 * 60 * 60;
          const SECONDARY_TTL = 1000 * 60 * 60 * 6;

          const resetCritical =
            state.criticalCacheTimestamp > 0 &&
            now - state.criticalCacheTimestamp > CRITICAL_TTL;
          const resetSecondary =
            state.secondaryCacheTimestamp > 0 &&
            now - state.secondaryCacheTimestamp > SECONDARY_TTL;

          if (!resetCritical && !resetSecondary) return {};

          const updates: Partial<BootstrapStore> = {};

          if (resetCritical) {
            updates.syncToken = null;
            updates.criticalCacheTimestamp = 0;
            updates.hasLoadedCritical = false;
            updates.isBootstrapped = false;
          }

          if (resetSecondary) {
            updates.secondaryCacheTimestamp = 0;
            updates.hasLoadedSecondary = false;
            if (!resetCritical) updates.isBootstrapped = false;
          }

          return updates;
        }),

      isCriticalCacheValid: () => {
        const state = get();
        const TTL = 1000 * 60 * 60;
        return (
          state.criticalCacheTimestamp > 0 &&
          Date.now() - state.criticalCacheTimestamp < TTL &&
          state.hasLoadedCritical
        );
      },

      isSecondaryCacheValid: () => {
        const state = get();
        const TTL = 1000 * 60 * 60 * 6;
        return (
          state.secondaryCacheTimestamp > 0 &&
          Date.now() - state.secondaryCacheTimestamp < TTL &&
          state.hasLoadedSecondary
        );
      },

      setBootstrapped: (value) => set({ isBootstrapped: value }),

      markCriticalAsLoaded: () => set({ hasLoadedCritical: true }),

      markSecondaryAsLoaded: () => set({ hasLoadedSecondary: true }),

      reset: () =>
        set({
          syncToken: null,
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
      storage: createJSONStorage(() => asyncStorage),

      partialize: (state) => ({
        syncToken: state.syncToken,
        criticalCacheTimestamp: state.criticalCacheTimestamp,
        hasLoadedCritical: state.hasLoadedCritical,
        secondaryCacheTimestamp: state.secondaryCacheTimestamp,
        hasLoadedSecondary: state.hasLoadedSecondary,
        isBootstrapped: state.isBootstrapped,
      }),

      version: 2,
      migrate: () => ({
        syncToken: null,
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
    }
  )
);
