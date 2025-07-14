import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { UserSettingsDTO } from "@/types/UserSettingsDTO";
import { CriticalBootstrapResponseDTO } from "@/types/bootstrap/CriticalBootstrapResponseDTO";
import { SecondaryBootstrapResponseDTO } from "@/types/bootstrap/SecondaryBootstrapResponseDTO";

type BootstrapStore = {
  // Critical data
  user: UserSummaryDTO | null;
  syncToken: string | null;
  
  // Secondary data
  friends: UserSummaryDTO[];
  blockedUsers: UserSummaryDTO[];
  settings: UserSettingsDTO | null;
  
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
  setFriends: (friends: UserSummaryDTO[]) => void;
  setBlockedUsers: (users: UserSummaryDTO[]) => void;
  setSettings: (settings: UserSettingsDTO) => void;
  
  // Friends management
  addFriend: (friend: UserSummaryDTO) => void;
  removeFriend: (friendId: number) => void;
  
  // Blocked users management
  blockUser: (user: UserSummaryDTO) => void;
  unblockUser: (userId: number) => void;
  
  // Cache management
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
      friends: [],
      blockedUsers: [],
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
          isBootstrapped: true,
        })),

      setCriticalLoading: (loading: boolean) =>
        set(() => ({ criticalLoading: loading })),

      setCriticalError: (error: string | null) =>
        set(() => ({ 
          criticalError: error, 
          criticalLoading: false,
          isBootstrapped: false 
        })),

      setUser: (user: UserSummaryDTO) =>
        set(() => ({ user })),

      setSyncToken: (token: string) =>
        set(() => ({ syncToken: token })),

      // --- Secondary data actions ---
      setSecondaryData: (data: SecondaryBootstrapResponseDTO) =>
        set(() => ({
          friends: data.friends,
          blockedUsers: data.blockedUsers,
          settings: data.settings,
          secondaryLoading: false,
          secondaryError: null,
          secondaryCacheTimestamp: Date.now(),
          hasLoadedSecondary: true,
        })),

      setSecondaryLoading: (loading: boolean) =>
        set(() => ({ secondaryLoading: loading })),

      setSecondaryError: (error: string | null) =>
        set(() => ({ 
          secondaryError: error, 
          secondaryLoading: false 
        })),

      setFriends: (friends: UserSummaryDTO[]) =>
        set(() => ({ friends: [...friends] })),

      setBlockedUsers: (users: UserSummaryDTO[]) =>
        set(() => ({ blockedUsers: [...users] })),

      setSettings: (settings: UserSettingsDTO) =>
        set(() => ({ settings })),

      // --- Friends management ---
      addFriend: (friend: UserSummaryDTO) =>
        set((state) => {
          const exists = state.friends.some(f => f.id === friend.id);
          if (exists) return {};
          
          return {
            friends: [...state.friends, friend],
            secondaryCacheTimestamp: Date.now(),
          };
        }),

      removeFriend: (friendId: number) =>
        set((state) => ({
          friends: state.friends.filter(f => f.id !== friendId),
          secondaryCacheTimestamp: Date.now(),
        })),

      // --- Blocked users management ---
      blockUser: (user: UserSummaryDTO) =>
        set((state) => {
          const exists = state.blockedUsers.some(u => u.id === user.id);
          if (exists) return {};
          
          return {
            blockedUsers: [...state.blockedUsers, user],
            // Fjern fra venner hvis de var venner
            friends: state.friends.filter(f => f.id !== user.id),
            secondaryCacheTimestamp: Date.now(),
          };
        }),

      unblockUser: (userId: number) =>
        set((state) => ({
          blockedUsers: state.blockedUsers.filter(u => u.id !== userId),
          secondaryCacheTimestamp: Date.now(),
        })),

      // --- Cache management ---
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
            updates.friends = [];
            updates.blockedUsers = [];
            updates.settings = null;
            updates.secondaryCacheTimestamp = 0;
            updates.hasLoadedSecondary = false;
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
          friends: [],
          blockedUsers: [],
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
       * partialize: Lagre alt som er nyttig for caching
       * - user, syncToken (critical data)
       * - friends, blockedUsers, settings (secondary data)
       * - cache timestamps og loading flags
       * 
       * IKKE lagre:
       * - loading states (criticalLoading, secondaryLoading)
       * - error states (criticalError, secondaryError)
       */
      partialize: (state) => ({
        // Critical data
        user: state.user,
        syncToken: state.syncToken,
        criticalCacheTimestamp: state.criticalCacheTimestamp,
        hasLoadedCritical: state.hasLoadedCritical,
        
        // Secondary data
        friends: state.friends,
        blockedUsers: state.blockedUsers,
        settings: state.settings,
        secondaryCacheTimestamp: state.secondaryCacheTimestamp,
        hasLoadedSecondary: state.hasLoadedSecondary,
        
        // Bootstrap state
        isBootstrapped: state.isBootstrapped,
      }),

      version: 1,
      migrate: (persisted: unknown) => {
        // Håndter migrering hvis nødvendig
        const state = persisted as Partial<BootstrapStore>;
        return state as BootstrapStore;
      },
    }
  )
);