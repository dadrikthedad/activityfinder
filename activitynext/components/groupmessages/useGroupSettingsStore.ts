// store/useGroupSettingsStore.ts
import { create } from "zustand";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

interface GroupSettingsStoreData {
  user: UserSummaryDTO;
  conversationId: number;
  position: { x: number; y: number };
}

interface GroupSettingsStore {
  data: GroupSettingsStoreData | null;
  show: (data: GroupSettingsStoreData) => void;
  hide: () => void;
}

export const useGroupSettingsStore = create<GroupSettingsStore>((set) => ({
  data: null,
  
  show: (data) => {
    console.log("🔧 Opening GroupSettings for:", data.user.fullName);
    set({ data });
  },
  
  hide: () => {
    console.log("🔧 Closing GroupSettings");
    set({ data: null });
  },
}));