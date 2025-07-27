// stores/useUserCacheStore.ts
import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { SecondaryBootstrapResponseDTO } from "@/types/bootstrap/SecondaryBootstrapResponseDTO";
import { CriticalBootstrapResponseDTO } from "@/types/bootstrap/CriticalBootstrapResponseDTO";
import { UserSettingsDTO } from "@/types/UserSettingsDTO";

interface UserCacheStore {
  // Current user og settings
  currentUser: UserSummaryDTO | null;
  settings: UserSettingsDTO | null;

  // Data - nå med relationship status
  users: Record<number, UserSummaryDTO>;
  
  // Cache metadata
  lastUpdated: number;
  hasLoadedFromBootstrap: boolean;

  // CurrentUserActions
  setCurrentUser: (user: UserSummaryDTO) => void;
  getCurrentUser: () => UserSummaryDTO | null;
  setSettings: (settings: UserSettingsDTO) => void;
  getSettings: () => UserSettingsDTO | null;
  
  // Core actions
  setUser: (user: UserSummaryDTO) => void;
  setUsers: (users: UserSummaryDTO[]) => void;
  getUser: (userId: number) => UserSummaryDTO | null;
  updateUser: (userId: number, updates: Partial<UserSummaryDTO>) => void;
  
  // Relationship-specific actions
  setUserFriendStatus: (userId: number, isFriend: boolean, isBlocked?: boolean) => void;
  setUserBlockedStatus: (userId: number, isBlocked: boolean, isFriend?: boolean) => void;
  
  // Quick relationship checks
  isFriend: (userId: number) => boolean;
  isBlocked: (userId: number) => boolean;

  // Filtered getters
  getFriends: () => UserSummaryDTO[];
  getBlockedUsers: () => UserSummaryDTO[];
  
  // Enhanced bootstrap caching
  cacheUsersFromCriticalBootstrap: (data: CriticalBootstrapResponseDTO) => void;
  cacheUsersFromSecondaryBootstrap: (data: SecondaryBootstrapResponseDTO) => void;
  
  // Bulk operations
  getUsersByIds: (userIds: number[]) => UserSummaryDTO[];
  
  // Cache management
  cleanupOldUsers: () => void;
  isCacheValid: () => boolean;
  setHasLoadedFromBootstrap: (loaded: boolean) => void;
  reset: () => void;
}

export const useUserCacheStore = create<UserCacheStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // --- Initial state ---
      currentUser: null,
      settings: null,
      users: {},
      lastUpdated: 0,
      hasLoadedFromBootstrap: false,

      // --- Current user actions ---
      setCurrentUser: (user: UserSummaryDTO) => {
        console.log("👤 Setting current user:", user.fullName);
        set(state => ({
          currentUser: user,
          lastUpdated: Date.now(),
          // Også legg current user i users cache
          users: {
            ...state.users,
            [user.id]: {
              ...user,
              lastUpdated: Date.now()
            }
          }
        }));
      },
      
      getCurrentUser: () => get().currentUser,

      setSettings: (settings: UserSettingsDTO) => {
        console.log("⚙️ Setting user settings:", settings.language);
        set(() => ({
          settings,
          lastUpdated: Date.now()
        }));
      },
      
      getSettings: () => get().settings,
      
      // --- Core actions ---
      setUser: (user: UserSummaryDTO) => 
        set(state => {
            const existingUser = state.users[user.id];
            const now = Date.now();
            
            // Legg til timestamp hvis mangler
            const userWithTimestamp = {
            ...user,
            lastUpdated: user.lastUpdated || now
            };
            
            // Smart merge hvis eksisterende bruker finnes
            if (existingUser) {
            // Kun overskrive hvis nyere data
            if (!existingUser.lastUpdated || 
                userWithTimestamp.lastUpdated >= existingUser.lastUpdated) {
                return {
                users: { ...state.users, [user.id]: userWithTimestamp },
                lastUpdated: Date.now()
                };
            } else {
                // Behold eksisterende (nyere)
                console.log(`👤 setUser: Keeping existing user ${user.id} (newer timestamp)`);
                return state;
            }
            }
            
            // Ny bruker
            return {
            users: { ...state.users, [user.id]: userWithTimestamp },
            lastUpdated: Date.now()
            };
        }),



      // setUsers with smart merging for relationship data
      setUsers: (users: UserSummaryDTO[]) => {
        const now = Date.now();
        const userMap = new Map<number, UserSummaryDTO>();
        let duplicatesInInput = 0;
        
        // 🔧 SMART DEDUPLICATION med timestamp
        users.forEach(user => {
            const userWithTimestamp = {
            ...user,
            lastUpdated: user.lastUpdated || now
            };
            
            if (userMap.has(user.id)) {
            duplicatesInInput++;
            const existing = userMap.get(user.id)!;
            
            // Velg nyeste basert på timestamp
            if (userWithTimestamp.lastUpdated >= (existing.lastUpdated || 0)) {
                userMap.set(user.id, userWithTimestamp);
            }
            // Ellers behold existing
            } else {
            userMap.set(user.id, userWithTimestamp);
            }
        });
        
        if (duplicatesInInput > 0) {
            console.warn(`👤 setUsers: Resolved ${duplicatesInInput} duplicates using timestamps`);
        }
        
        // 🔧 SMART MERGE med eksisterende state
        set(state => {
            const updatedUsers = { ...state.users };
            let newUsers = 0;
            let updatedExisting = 0;
            let preservedExisting = 0;
            
            userMap.forEach((newUser, userId) => {
            const existingUser = updatedUsers[userId];
            
            if (existingUser) {
                // 🆕 ALWAYS UPDATE if new user has relationship data (from backend)
                if (newUser.isFriend !== undefined || newUser.isBlocked !== undefined) {
                // Backend data is authoritative for relationships
                updatedUsers[userId] = newUser;
                updatedExisting++;
                } else if (!existingUser.lastUpdated || 
                    newUser.lastUpdated! >= existingUser.lastUpdated) {
                // Regular timestamp-based update for non-relationship data
                updatedUsers[userId] = {
                    ...newUser,
                    // Preserve existing relationship status if new user doesn't have it
                    isFriend: newUser.isFriend ?? existingUser.isFriend,
                    isBlocked: newUser.isBlocked ?? existingUser.isBlocked
                };
                updatedExisting++;
                } else {
                preservedExisting++;
                }
            } else {
                updatedUsers[userId] = newUser;
                newUsers++;
            }
            });
            
            console.log(`👤 setUsers result: ${newUsers} new, ${updatedExisting} updated, ${preservedExisting} preserved`);
            
            return {
            users: updatedUsers,
            lastUpdated: Date.now()
            };
        });
        },
      
      getUser: (userId: number) => get().users[userId] || null,
      
      updateUser: (userId: number, updates: Partial<UserSummaryDTO>) =>
        set(state => {
            const existingUser = state.users[userId];
            if (!existingUser) return state;
            
            return {
            users: {
                ...state.users,
                [userId]: { 
                ...existingUser, 
                ...updates,
                lastUpdated: Date.now()
                }
            },
            lastUpdated: Date.now()
            };
        }),
      
      // Relationship actions
      setUserFriendStatus: (userId: number, isFriend: boolean, isBlocked = false) => {
        set(state => {
            const user = state.users[userId];
            if (!user) return state;
            
            return {
            users: {
                ...state.users,
                [userId]: {
                ...user,
                isFriend,
                isBlocked,
                lastUpdated: Date.now()
                }
            },
            lastUpdated: Date.now()
            };
        });
        },
      
      setUserBlockedStatus: (userId: number, isBlocked: boolean, isFriend = false) => {
        set(state => {
            const user = state.users[userId];
            if (!user) return state;
            
            return {
            users: {
                ...state.users,
                [userId]: {
                ...user,
                isBlocked,
                isFriend,
                lastUpdated: Date.now()
                }
            },
            lastUpdated: Date.now()
            };
        });
        },
      
      // 🚀 Super enkle boolean checks
      isFriend: (userId: number) => {
        const user = get().users[userId];
        return user?.isFriend === true;
      },
      
      isBlocked: (userId: number) => {
        const user = get().users[userId];
        return user?.isBlocked === true;
      },
      
      // 🆕 Filtered getters
      getFriends: () => {
        const state = get();
        return Object.values(state.users).filter(user => user.isFriend === true);
      },
      
      getBlockedUsers: () => {
        const state = get();
        return Object.values(state.users).filter(user => user.isBlocked === true);
      },
      
      // 🔧 UPDATED: Critical bootstrap caching (no relationship status)
      cacheUsersFromCriticalBootstrap: (data: CriticalBootstrapResponseDTO) => {
        const userMap = new Map<number, UserSummaryDTO>();
        const now = Date.now();
        
        console.log("👤 Caching users from CRITICAL bootstrap...");
        
        data.recentConversations?.forEach(conv => 
            conv.participants?.forEach(user => {
            if (!userMap.has(user.id)) {
                userMap.set(user.id, {
                ...user,
                // Don't set relationship status from critical bootstrap
                lastUpdated: now
                });
            }
            })
        );
        
        const uniqueUsers = Array.from(userMap.values());
        console.log(`👤 Cached ${uniqueUsers.length} users from critical bootstrap`);
        
        // Use setUsers for smart merging
        get().setUsers(uniqueUsers);
        },
      
      // Secondary bootstrap now handles allUserSummaries AND other users
      cacheUsersFromSecondaryBootstrap: (data: SecondaryBootstrapResponseDTO) => {
        const userMap = new Map<number, UserSummaryDTO>();
        const now = Date.now();
        
        console.log("👤 Caching remaining users from SECONDARY bootstrap...");
        
        // allUserSummaries is handled separately in distributor
        // Here we only cache users from other sources (notifications, invitations, etc.)
        
        // Friend invitations
        data.pendingFriendInvitations?.forEach(inv => {
          if (inv.userSummary && !userMap.has(inv.userSummary.id)) {
            userMap.set(inv.userSummary.id, {
              ...inv.userSummary,
              // Don't override relationship status - these are invitation users
              lastUpdated: now 
            });
          }
        });
        
        // App notifications
        data.recentNotifications?.forEach(notif => {
          if (notif.relatedUser && !userMap.has(notif.relatedUser.id)) {
            userMap.set(notif.relatedUser.id, {
              ...notif.relatedUser,
              // Don't set relationship status for notification users
              lastUpdated: now 
            });
          }
        });
        
        const uniqueUsers = Array.from(userMap.values());
        
        if (uniqueUsers.length > 0) {
          console.log(`👤 Cached ${uniqueUsers.length} additional users from secondary bootstrap`);
          // Use setUsers for smart merging
          get().setUsers(uniqueUsers);
        }
        
        // Mark as loaded from bootstrap
        set({ hasLoadedFromBootstrap: true });
        },
      
      // Bulk operations
      getUsersByIds: (userIds: number[]) => {
        const state = get();
        return userIds.map(id => state.users[id]).filter(Boolean);
      },
      
      // Cache management
      cleanupOldUsers: () => {
        const now = Date.now();
        const TTL = 1000 * 60 * 60 * 24; // 24 timer
        
        set(state => {
          if (!state.lastUpdated || (now - state.lastUpdated < TTL)) {
            console.log("👤 User cache still valid, no cleanup needed");
            return state;
          }
          
          console.log("👤 Cleaning up old user cache");
          return {
            currentUser: null,
            settings: null,
            users: {},
            lastUpdated: 0,
            hasLoadedFromBootstrap: false
          };
        });
      },
      
      isCacheValid: () => {
        const state = get();
        const now = Date.now();
        const TTL = 1000 * 60 * 60 * 24; // 24 timer
        
        return state.lastUpdated > 0 && 
               (now - state.lastUpdated < TTL) &&
               state.hasLoadedFromBootstrap;
      },
      
      setHasLoadedFromBootstrap: (loaded: boolean) =>
        set(() => ({ hasLoadedFromBootstrap: loaded })),
      
      reset: () =>
        set({
          currentUser: null, 
          settings: null, 
          users: {},
          lastUpdated: 0,
          hasLoadedFromBootstrap: false
        })
    })),
    {
      name: "user-cache-enhanced",
      storage: createJSONStorage(() => indexedDBStorage),
      
      partialize: (state) => ({
        currentUser: state.currentUser,
        settings: state.settings,
        users: state.users,
        lastUpdated: state.lastUpdated,
        hasLoadedFromBootstrap: state.hasLoadedFromBootstrap
      }),
      
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<UserCacheStore>;
        
        if (version < 2) {
          // Clear old cache since structure changed
          console.log("👤 Migrating UserCache to v2 - clearing old data");
          return {
            currentUser: null,
            settings: null,
            users: {},
            lastUpdated: 0,
            hasLoadedFromBootstrap: false
          } as UserCacheStore;
        }
        
        return state as UserCacheStore;
      }
    }
  )
);

export const useCurrentUser = () => {
  return useUserCacheStore(state => state.currentUser);
};

export const useUserSettings = () => {
  return useUserCacheStore(state => state.settings);
};

export const useFriends = () => {
  return useUserCacheStore(state => state.getFriends());
};

export const useBlockedUsers = () => {
  return useUserCacheStore(state => state.getBlockedUsers());
};

export const useUserById = (userId: number) => {
  return useUserCacheStore(state => state.getUser(userId));
};

export const useIsUserFriend = (userId: number) => {
  return useUserCacheStore(state => state.isFriend(userId));
};

export const useIsUserBlocked = (userId: number) => {
  return useUserCacheStore(state => state.isBlocked(userId));
};