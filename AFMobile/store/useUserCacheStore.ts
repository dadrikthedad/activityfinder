import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { UserBootstrapDTO } from "@shared/types/UserBootstrapDTO";
import { UserProfileDTO } from "@shared/types/UserProfileDTO";
import { BlockedUserDTO } from "@shared/types/BlockedUserDTO";
import { SecondaryBootstrapResponseDTO } from "@shared/types/bootstrap/SecondaryBootstrapResponseDTO";
import { UserSettingsDTO } from "@shared/types/UserSettingsDTO";

interface UserCacheStore {
  // Innlogget bruker — full data fra critical bootstrap
  currentUser: UserBootstrapDTO | null;
  profile: UserProfileDTO | null;
  settings: UserSettingsDTO | null;
  blockedUsers: BlockedUserDTO[];

  // Andre brukere cachet fra samtaler etc.
  users: Record<string, UserSummaryDTO>;

  // Cache metadata
  lastUpdated: number;
  hasLoadedFromBootstrap: boolean;

  // Current user actions
  setCurrentUser: (user: UserBootstrapDTO) => void;
  getCurrentUser: () => UserBootstrapDTO | null;
  setProfile: (profile: UserProfileDTO) => void;
  setSettings: (settings: UserSettingsDTO) => void;
  getSettings: () => UserSettingsDTO | null;
  setBlockedUsers: (users: BlockedUserDTO[]) => void;
  addBlockedUser: (user: BlockedUserDTO) => void;
  removeBlockedUser: (userId: string) => void;

  // Core actions
  setUser: (user: Partial<UserSummaryDTO> & { id: string }) => void;
  setUsers: (users: UserSummaryDTO[]) => void;
  getUser: (userId: string) => UserSummaryDTO | null;
  updateUser: (userId: string, updates: Partial<UserSummaryDTO>) => void;

  // Relationship-specific actions
  setUserFriendStatus: (userId: string, isFriend: boolean, isBlocked?: boolean) => void;
  setUserBlockedStatus: (userId: string, isBlocked: boolean, isFriend?: boolean) => void;

  // Quick relationship checks
  isFriend: (userId: string) => boolean;
  isBlocked: (userId: string) => boolean;

  // Filtered getters
  getFriends: () => UserSummaryDTO[];

  // UNIFIED: Single bootstrap caching method
  cacheUsersFromBootstrap: (secondaryData?: SecondaryBootstrapResponseDTO) => void;

  // Bulk operations
  getUsersByIds: (userIds: string[]) => UserSummaryDTO[];

  // Cache management

  isCacheValid: () => boolean;
  setHasLoadedFromBootstrap: (loaded: boolean) => void;
  reset: () => void;
}

export const useUserCacheStore = create<UserCacheStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      currentUser: null,
      profile: null,
      settings: null,
      blockedUsers: [],
      users: {},
      lastUpdated: 0,
      hasLoadedFromBootstrap: false,

      setCurrentUser: (user: UserBootstrapDTO) => {
        set({ currentUser: user, lastUpdated: Date.now() });
      },

      getCurrentUser: () => get().currentUser,

      setProfile: (profile: UserProfileDTO) => {
        set({ profile, lastUpdated: Date.now() });
      },

      setSettings: (settings: UserSettingsDTO) => {
        set({ settings, lastUpdated: Date.now() });
      },

      getSettings: () => get().settings,

      setBlockedUsers: (users: BlockedUserDTO[]) => {
        set({ blockedUsers: users, lastUpdated: Date.now() });
      },

      addBlockedUser: (user: BlockedUserDTO) => {
        set(state => ({
          blockedUsers: state.blockedUsers.some(b => b.userId === user.userId)
            ? state.blockedUsers
            : [...state.blockedUsers, user],
          lastUpdated: Date.now()
        }));
      },

      removeBlockedUser: (userId: string) => {
        set(state => ({
          blockedUsers: state.blockedUsers.filter(b => b.userId !== userId),
          lastUpdated: Date.now()
        }));
      },

      setUser: (user: Partial<UserSummaryDTO> & { id: string }) =>
        set(state => {
          const existingUser = state.users[user.id];
          const now = Date.now();

          const displayName = user.fullName || existingUser?.fullName || `User ${user.id}`;

          if (existingUser) {
            const mergedUser = {
              ...existingUser,
              ...user,
              fullName: (user.fullName !== undefined && user.fullName !== null) ? user.fullName : existingUser.fullName,
              profileImageUrl: user.profileImageUrl !== undefined ? user.profileImageUrl : existingUser.profileImageUrl,
              isFriend: user.isFriend !== undefined ? user.isFriend : existingUser.isFriend,
              isBlocked: user.isBlocked !== undefined ? user.isBlocked : existingUser.isBlocked,
              hasBlockedMe: user.hasBlockedMe !== undefined ? user.hasBlockedMe : existingUser.hasBlockedMe,
              lastUpdated: now
            };

            const friendChanged = existingUser.isFriend !== mergedUser.isFriend;
            const blockChanged = existingUser.isBlocked !== mergedUser.isBlocked;
            const nameChanged = existingUser.fullName !== mergedUser.fullName;
            const imageChanged = existingUser.profileImageUrl !== mergedUser.profileImageUrl;
            const hasBlockedMeChanged = existingUser.hasBlockedMe !== mergedUser.hasBlockedMe;

            if (friendChanged || blockChanged || nameChanged || imageChanged || hasBlockedMeChanged) {
              console.log(`setUser   📝 Changes detected for ${displayName}`);
            }

            return {
              users: { ...state.users, [user.id]: mergedUser },
              lastUpdated: now
            };
          }

          if (!user.fullName) {
            console.warn(`setUser   ⚠️ Adding new user without fullName`);
          }

          return {
            users: {
              ...state.users,
              [user.id]: {
                fullName: user.fullName || `User ${user.id}`,
                profileImageUrl: user.profileImageUrl ?? null,
                ...user,
                lastUpdated: now
              }
            },
            lastUpdated: now
          };
        }),

      setUsers: (users: UserSummaryDTO[]) => {
        const now = Date.now();
        const userMap = new Map<string, UserSummaryDTO>();
        let duplicatesInInput = 0;

        users.forEach(user => {
          const userWithTimestamp = { ...user, lastUpdated: user.lastUpdated || now };

          if (userMap.has(user.id)) {
            duplicatesInInput++;
            const existing = userMap.get(user.id)!;
            if (userWithTimestamp.lastUpdated >= (existing.lastUpdated || 0)) {
              userMap.set(user.id, userWithTimestamp);
            }
          } else {
            userMap.set(user.id, userWithTimestamp);
          }
        });

        if (duplicatesInInput > 0) {
          console.warn(`👤 setUsers: Resolved ${duplicatesInInput} duplicates using timestamps`);
        }

        set(state => {
          const updatedUsers = { ...state.users };

          userMap.forEach((newUser, userId) => {
            const existingUser = updatedUsers[userId];

            if (existingUser) {
              if (newUser.isFriend !== undefined || newUser.isBlocked !== undefined) {
                updatedUsers[userId] = newUser;
              } else if (!existingUser.lastUpdated || newUser.lastUpdated! >= existingUser.lastUpdated) {
                updatedUsers[userId] = {
                  ...newUser,
                  isFriend: newUser.isFriend ?? existingUser.isFriend,
                  isBlocked: newUser.isBlocked ?? existingUser.isBlocked
                };
              }
            } else {
              updatedUsers[userId] = newUser;
            }
          });

          return { users: updatedUsers, lastUpdated: Date.now() };
        });
      },

      getUser: (userId: string) => get().users[userId] || null,

      updateUser: (userId: string, updates: Partial<UserSummaryDTO>) =>
        set(state => {
          const existingUser = state.users[userId];
          if (!existingUser) return state;

          return {
            users: {
              ...state.users,
              [userId]: { ...existingUser, ...updates, lastUpdated: Date.now() }
            },
            lastUpdated: Date.now()
          };
        }),

      setUserFriendStatus: (userId: string, isFriend: boolean, isBlocked = false) => {
        set(state => {
          const user = state.users[userId];
          if (!user) return state;

          return {
            users: {
              ...state.users,
              [userId]: { ...user, isFriend, isBlocked, lastUpdated: Date.now() }
            },
            lastUpdated: Date.now()
          };
        });
      },

      setUserBlockedStatus: (userId: string, isBlocked: boolean, isFriend = false) => {
        set(state => {
          const user = state.users[userId];
          if (!user) return state;

          return {
            users: {
              ...state.users,
              [userId]: { ...user, isBlocked, isFriend, lastUpdated: Date.now() }
            },
            lastUpdated: Date.now()
          };
        });
      },

      isFriend: (userId: string) => {
        const user = get().users[userId];
        return user?.isFriend === true;
      },

      isBlocked: (userId: string) => {
        const user = get().users[userId];
        return user?.isBlocked === true;
      },

      getFriends: () => {
        return Object.values(get().users).filter(user => user.isFriend === true);
      },

      cacheUsersFromBootstrap: (secondaryData?: SecondaryBootstrapResponseDTO) => {
        const userMap = new Map<string, UserSummaryDTO>();
        const now = Date.now();

        // Cache deltakere fra aktive samtaler
        secondaryData?.activeConversations?.forEach(conv =>
          conv.participants?.forEach(p => {
            if (!userMap.has(p.user.id)) {
              userMap.set(p.user.id, { ...p.user, lastUpdated: now });
            }
          })
        );

        // Cache deltakere fra ventende samtaler
        secondaryData?.pendingConversations?.forEach(conv =>
          conv.participants?.forEach(p => {
            if (!userMap.has(p.user.id)) {
              userMap.set(p.user.id, { ...p.user, lastUpdated: now });
            }
          })
        );

        // Cache avsendere fra meldingsnotifikasjoner
        secondaryData?.messageNotifications?.forEach(notif => {
          const sender = notif.senderUserDto;
          if (sender && !userMap.has(sender.id)) {
            userMap.set(sender.id, { ...sender, lastUpdated: now });
          }
        });

        const uniqueUsers = Array.from(userMap.values());

        if (uniqueUsers.length > 0) {
          console.log(`👤 Cached ${uniqueUsers.length} users from bootstrap data`);
          get().setUsers(uniqueUsers);
        }

        if (secondaryData) {
          set({ hasLoadedFromBootstrap: true });
        }
      },

      getUsersByIds: (userIds: string[]) => {
        const state = get();
        return userIds.map(id => state.users[id]).filter(Boolean);
      },


      isCacheValid: () => {
        const state = get();
        return state.hasLoadedFromBootstrap && state.currentUser !== null;
      },

      setHasLoadedFromBootstrap: (loaded: boolean) =>
        set(() => ({ hasLoadedFromBootstrap: loaded })),

      reset: () =>
        set({
          currentUser: null,
          profile: null,
          settings: null,
          blockedUsers: [],
          users: {},
          lastUpdated: 0,
          hasLoadedFromBootstrap: false
        })
    })),
    {
      name: "user-cache-enhanced",
      storage: createJSONStorage(() => asyncStorage),

      partialize: (state) => ({
        currentUser: state.currentUser,
        profile: state.profile,
        settings: state.settings,
        blockedUsers: state.blockedUsers,
        users: state.users,
        lastUpdated: state.lastUpdated,
        hasLoadedFromBootstrap: state.hasLoadedFromBootstrap
      }),

      version: 3,
      migrate: () => {
        console.log("Migrating UserCache to v3 - clearing old data (user-id number to string)");
        return {
          currentUser: null,
          profile: null,
          settings: null,
          blockedUsers: [],
          users: {},
          lastUpdated: 0,
          hasLoadedFromBootstrap: false
        } as UserCacheStore;
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

export const useUserById = (userId: string) => {
  return useUserCacheStore(state => state.getUser(userId));
};

export const useIsUserFriend = (userId: string) => {
  return useUserCacheStore(state => state.isFriend(userId));
};

export const useIsUserBlocked = (userId: string) => {
  return useUserCacheStore(state => state.isBlocked(userId));
};

export const useIsUserBlockedByGuid = (userId: string) => {
  return useUserCacheStore(state => state.blockedUsers.some(u => u.userId === userId));
};
