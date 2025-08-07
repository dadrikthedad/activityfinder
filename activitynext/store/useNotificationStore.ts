import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import type { NotificationDTO } from "@shared/types/NotificationEventDTO";
import { FriendInvitationDTO } from "@shared/types/FriendInvitationDTO";

interface NotificationState {
  // --- data ---
  notifications: NotificationDTO[];
  friendRequests: FriendInvitationDTO[];

  // --- actions ---
  /** Erstatter hele listene (kalles etter initial fetch) */
  setNotifications: (list: NotificationDTO[]) => void;
  setFriendRequests: (list: FriendInvitationDTO[]) => void;

  /** Legg til én ny (brukes av SignalR-hooken) */
  addNotification: (n: NotificationDTO) => void;
  addFriendRequest: (fr: FriendInvitationDTO) => void;

  /** UI-hjelpere */
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead:() => void;        
  removeFriendRequest: (id: number) => void;

  hasLoadedFriendRequests: boolean;
  hasLoadedNotifications:   boolean; 
  setHasLoadedFriendRequests: (b: boolean) => void;
  setHasLoadedNotifications:   (b: boolean) => void; 

  // Teller antall forespørsler for vis i dropdown
  friendRequestTotalCount: number;
  setFriendRequestTotalCount: (count: number) => void;

  // Åpner dropdownen
  showNotificationDropdown: boolean;
  setShowNotificationDropdown: (value: boolean) => void;

  // Slett notifikasjoner
    clearNotifications: () => void;  

  /** Tøm alt ved logout  */
  reset: () => void;
}

/**
 * Hold begge listene i samme store – gjør det enkelt for Navbar-dropdownen
 * å lese begge i ett kall.
 */
export const useNotificationStore = create<NotificationState>()(
  persist(
    subscribeWithSelector((set) => ({
      // --- initial state ---
      notifications: [],
      friendRequests: [],
      hasLoadedFriendRequests: false,
      hasLoadedNotifications:  false,
      friendRequestTotalCount: 0,
      setFriendRequestTotalCount: (count) => set({ friendRequestTotalCount: count }),


      // --- setters ---
      setNotifications: (list) => set({ notifications: list }),
      setFriendRequests: (list) => set({ friendRequests: list }),

      // --- adders (unngå duplikater) ---
      addNotification: (n) =>
        set((state) =>
          state.notifications.some((x) => x.id === n.id)
            ? state
            : { notifications: [n, ...state.notifications] }
        ),

      addFriendRequest: (fr) =>
        set((state) =>
          state.friendRequests.some((x) => x.id === fr.id)
            ? state
            : { friendRequests: [fr, ...state.friendRequests] }
        ),

      // --- helpers ---
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

    markAllNotificationsRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) =>
            n.isRead ? n : { ...n, isRead: true },
            ),
        })),

      removeFriendRequest: (id) =>
        set((state) => ({
          friendRequests: state.friendRequests.filter((fr) => fr.id !== id),
        })),


       setHasLoadedFriendRequests: (b) => set({ hasLoadedFriendRequests: b }),
       setHasLoadedNotifications:   (b) => set({ hasLoadedNotifications:  b }),
       clearNotifications: () => set({ notifications: [] }),

      showNotificationDropdown: false,
      setShowNotificationDropdown: (value) =>
        set({ showNotificationDropdown: value }),

      // --- full reset (bruk ved logout) ---
      reset: () =>
        set({
            notifications: [],
            friendRequests: [],
            hasLoadedFriendRequests: false,   // ⬅︎ beholder
            hasLoadedNotifications:  false,   // ⬅︎ legg til
            friendRequestTotalCount: 0,
        }),
    })),
    {
      name: "notif-cache",
      storage: createJSONStorage(() => indexedDBStorage),

      /**
       * partialize: begrens hvor mye som lagres.
       *   – 200 siste notifikasjoner
       *   – 100 siste friendRequests
       */
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 200),
        friendRequests: state.friendRequests.slice(0, 100),
        hasLoadedFriendRequests: state.hasLoadedFriendRequests,
        hasLoadedNotifications:  state.hasLoadedNotifications,
        friendRequestTotalCount: state.friendRequestTotalCount, 
      }),

      version: 1,
      migrate: (persisted) => persisted as NotificationState,
    }
  )
);
