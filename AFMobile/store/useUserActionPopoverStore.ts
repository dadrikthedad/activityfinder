// stores/useUserActionPopoverStore.ts
import { create } from "zustand";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

interface UserPopoverData {
  user: UserSummaryDTO;
  position: { x: number; y: number };
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
  conversationId?: number;
}

interface UserActionPopoverStore {
  data: UserPopoverData | null;
  show: (data: UserPopoverData) => void;
  hide: () => void;
}

export const useUserActionPopoverStore = create<UserActionPopoverStore>((set) => ({
  data: null,
  show: (data) => set({ data }),
  hide: () => set({ data: null }),
}));
