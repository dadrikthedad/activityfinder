// store/useDecryptionStore.ts
import { create } from 'zustand';

interface DecryptionState {
  isLoading: boolean;
  error: string | null;
  decryptedUrl: string | null;
  progress: number; // 0-100
  status: 'idle' | 'downloading' | 'decrypting' | 'caching' | 'complete' | 'error';
  fileName?: string;
  startTime?: number; // For calculating time estimates
  estimatedTimeRemaining?: number; // in seconds
}

interface DecryptionStore {
  decryptionStates: Map<string, DecryptionState>;
  
  // Core state management
  updateDecryptionState: (fileUrl: string, updates: Partial<DecryptionState>) => void;
  getDecryptionState: (fileUrl: string) => DecryptionState;
  clearDecryptionState: (fileUrl: string) => void;
  clearAllDecryptionStates: () => void;
  
  // Convenience getters
  getDecryptedUrl: (fileUrl: string) => string | null;
  isDecrypting: (fileUrl: string) => boolean;
  getProgress: (fileUrl: string) => number;
  getStatus: (fileUrl: string) => string;
  getError: (fileUrl: string) => string | null;
  
  // Bulk operations
  getActiveDecryptions: () => Array<{ fileUrl: string; state: DecryptionState }>;
  getTotalProgress: () => number; // Average progress of all active decryptions
  
  // Progress helpers
  startDecryption: (fileUrl: string, fileName: string) => void;
  updateProgress: (fileUrl: string, progress: number, status?: DecryptionState['status']) => void;
  completeDecryption: (fileUrl: string, decryptedUrl: string) => void;
  failDecryption: (fileUrl: string, error: string) => void;

  cancelDecryption: (fileUrl: string) => void;
}

const createDefaultState = (): DecryptionState => ({
  isLoading: false,
  error: null,
  decryptedUrl: null,
  progress: 0,
  status: 'idle'
});

export const useDecryptionStore = create<DecryptionStore>((set, get) => ({
  decryptionStates: new Map(),
  
  // Core state management
  updateDecryptionState: (fileUrl: string, updates: Partial<DecryptionState>) => {
    set((state) => {
      const newMap = new Map(state.decryptionStates);
      const currentState = newMap.get(fileUrl) || createDefaultState();
      
      // Calculate estimated time remaining based on progress
      let estimatedTimeRemaining: number | undefined;
      if (updates.progress && currentState.startTime && updates.progress > 0) {
        const elapsed = (Date.now() - currentState.startTime) / 1000; // seconds
        const progressRate = updates.progress / elapsed;
        const remaining = (100 - updates.progress) / progressRate;
        estimatedTimeRemaining = Math.round(remaining);
      }
      
      const newState = { 
        ...currentState, 
        ...updates,
        estimatedTimeRemaining: estimatedTimeRemaining || currentState.estimatedTimeRemaining
      };
      
      newMap.set(fileUrl, newState);
      
      console.log(`🔐 Store: Updated decryption state for ${newState.fileName}:`, {
        progress: newState.progress,
        status: newState.status,
        isLoading: newState.isLoading,
        hasDecryptedUrl: !!newState.decryptedUrl,
        estimatedTimeRemaining: newState.estimatedTimeRemaining
      });
      
      return { decryptionStates: newMap };
    });
  },
  
  getDecryptionState: (fileUrl: string) => {
    const state = get().decryptionStates.get(fileUrl);
    return state || createDefaultState();
  },
  
  clearDecryptionState: (fileUrl: string) => {
    set((state) => {
      const newMap = new Map(state.decryptionStates);
      newMap.delete(fileUrl);
      return { decryptionStates: newMap };
    });
  },
  
  clearAllDecryptionStates: () => {
    set({ decryptionStates: new Map() });
  },
  
  // Convenience getters
  getDecryptedUrl: (fileUrl: string) => {
    return get().getDecryptionState(fileUrl).decryptedUrl;
  },
  
  isDecrypting: (fileUrl: string) => {
    return get().getDecryptionState(fileUrl).isLoading;
  },
  
  getProgress: (fileUrl: string) => {
    return get().getDecryptionState(fileUrl).progress;
  },
  
  getStatus: (fileUrl: string) => {
    const status = get().getDecryptionState(fileUrl).status;
    switch (status) {
      case 'downloading': return 'Decrypting...';
      case 'decrypting': return 'Decrypting...';
      case 'caching': return 'Decrypting...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Preparing...';
    }
  },
  
  getError: (fileUrl: string) => {
    return get().getDecryptionState(fileUrl).error;
  },
  
  // Bulk operations
  getActiveDecryptions: () => {
    const states = get().decryptionStates;
    const active: Array<{ fileUrl: string; state: DecryptionState }> = [];
    
    states.forEach((state, fileUrl) => {
      if (state.isLoading) {
        active.push({ fileUrl, state });
      }
    });
    
    return active;
  },
  
  getTotalProgress: () => {
    const active = get().getActiveDecryptions();
    if (active.length === 0) return 0;
    
    const totalProgress = active.reduce((sum, { state }) => sum + state.progress, 0);
    return Math.round(totalProgress / active.length);
  },
  
  // Progress helpers
  startDecryption: (fileUrl: string, fileName: string) => {
    get().updateDecryptionState(fileUrl, {
      isLoading: true,
      progress: 0,
      status: 'downloading',
      fileName,
      startTime: Date.now(),
      error: null,
      decryptedUrl: null
    });
  },

  cancelDecryption: (fileUrl: string) => {
    get().updateDecryptionState(fileUrl, {
        isLoading: false,
        status: 'idle',
        progress: 0,
        error: null
    });
    },
  
  updateProgress: (fileUrl: string, progress: number, status?: DecryptionState['status']) => {
    const updates: Partial<DecryptionState> = { progress };
    if (status) updates.status = status;
    
    get().updateDecryptionState(fileUrl, updates);
  },
  
  completeDecryption: (fileUrl: string, decryptedUrl: string) => {
  console.log(`BANAN STORE: Saving key: ${fileUrl} -> ${decryptedUrl}`);
  
  get().updateDecryptionState(fileUrl, {
    isLoading: false,
    progress: 100,
    status: 'complete',
    decryptedUrl,
    error: null,
    estimatedTimeRemaining: 0
  });
},
  
  failDecryption: (fileUrl: string, error: string) => {
    get().updateDecryptionState(fileUrl, {
      isLoading: false,
      status: 'error',
      error,
      decryptedUrl: null
    });
  }
}));