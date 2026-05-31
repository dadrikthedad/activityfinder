import { create } from "zustand";

type E2EEStore = {
  initialized: boolean;
  hasKeyPair: boolean;
  error: string | null;
  isGeneratingKeys: boolean;

  setE2EEState: (initialized: boolean, hasKeyPair: boolean, error?: string | null) => void;
  setE2EEGenerating: (isGenerating: boolean) => void;
  reset: () => void;
};

export const useE2EEStore = create<E2EEStore>()((set) => ({
  initialized: false,
  hasKeyPair: false,
  error: null,
  isGeneratingKeys: false,

  setE2EEState: (initialized, hasKeyPair, error) =>
    set({ initialized, hasKeyPair, error: error ?? null }),

  setE2EEGenerating: (isGenerating) =>
    set({ isGeneratingKeys: isGenerating }),

  reset: () =>
    set({ initialized: false, hasKeyPair: false, error: null, isGeneratingKeys: false }),
}));
