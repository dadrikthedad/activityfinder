"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";

type OverlayLevel = number;

interface OverlayLayerContextType {
  level: OverlayLevel;
  register: (level: OverlayLevel, ref: RefObject<HTMLElement | null>) => void;
  unregister: (level: OverlayLevel) => void;
  closeOneLevel: () => void;
  closeAllLevels: () => void;
}

const OverlayLayerContext = createContext<OverlayLayerContextType | undefined>(undefined);

export const useOverlayLayer = () => {
  const ctx = useContext(OverlayLayerContext);
  if (!ctx) throw new Error("useOverlayLayer must be used within OverlayLayerProvider");
  return ctx;
};

export const OverlayLayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [level, setLevel] = useState<OverlayLevel>(0);
  const refMap = useRef<Map<OverlayLevel, RefObject<HTMLElement | null>>>(new Map());
  const isProcessingRef = useRef(false);

  console.log('OVERLAY 🔥 OverlayLayerProvider rendered, current level:', level);

  const register = useCallback((lvl: OverlayLevel, ref: RefObject<HTMLElement | null>) => {
    if (refMap.current.has(lvl)) {
      console.log('OVERLAY ⚠️ Level', lvl, 'already registered, updating ref only');
      refMap.current.set(lvl, ref); // ✅ Opdater ref, men skip setLevel
      return;
    }
    
    console.log('OVERLAY 📝 Registering overlay at level:', lvl);
    refMap.current.set(lvl, ref);
    
    setLevel((prev) => {
      const newLevel = Math.max(prev, lvl);
      console.log('OVERLAY 📊 Level updated from', prev, 'to', newLevel);
      return newLevel;
    });
    
    isProcessingRef.current = true;
    setTimeout(() => {
      isProcessingRef.current = false;
      console.log('OVERLAY ✅ Processing protection lifted');
    }, 100);
  }, []);

  const unregister = useCallback((lvl: OverlayLevel) => {
    if (!refMap.current.has(lvl)) {
      console.log('OVERLAY ⚠️ Level', lvl, 'not found for unregistering, skipping');
      return;
    }
    
    console.log('OVERLAY ❌ Unregistering overlay at level:', lvl);
    refMap.current.delete(lvl);
    
    if (refMap.current.size === 0) {
      console.log('OVERLAY 🧹 All overlays closed, resetting to level 0');
      setLevel(0);
    } else {
      const levels = Array.from(refMap.current.keys());
      const newLevel = Math.max(...levels);
      console.log('OVERLAY 📊 Level updated to:', newLevel, 'remaining levels:', levels);
      setLevel(newLevel);
    }
  }, []);

  const closeOneLevel = useCallback(() => {
    if (level > 0) {
      unregister(level);
    }
  }, [level, unregister]);

  const closeAllLevels = useCallback(() => {
    console.log('OVERLAY 🧹 Closing all levels');
    refMap.current.clear();
    setLevel(0);
  }, []);

  // Handle outside clicks
  useEffect(() => {
    if (level === 0) return;

    const handleClick = (e: MouseEvent) => {
      if (isProcessingRef.current) return;

      for (let current = level; current >= 1; current--) {
        const ref = refMap.current.get(current);
        if (!ref?.current) continue;
        if (ref.current.contains(e.target as Node)) return;
      }
      
      console.log('OVERLAY 🖱️ Outside click detected, closing level:', level);
      closeOneLevel();
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [level, closeOneLevel]);

  // Handle escape key
  useEffect(() => {
    if (level === 0) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        console.log('OVERLAY ⌨️ Escape pressed, closing level:', level);
        closeOneLevel();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [level, closeOneLevel]);

  const contextValue = {
    level,
    register,
    unregister,
    closeOneLevel,
    closeAllLevels,
  };

  return (
    <OverlayLayerContext.Provider value={contextValue}>
      {children}
    </OverlayLayerContext.Provider>
  );
};

export const useOverlay = (initialLevel?: number) => {
  const { level: currentLevel, register, unregister } = useOverlayLayer();
  const [isOpen, setIsOpen] = useState(false);
  const [myLevel, setMyLevel] = useState<number | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const hasRegisteredRef = useRef(false);
  const myLevelRef = useRef<number | null>(null);
  const strictModeRef = useRef(false);

  const callbackRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);

  const open = useCallback(() => {
    console.log('OVERLAY 🚀 useOverlay.open called:', { 
      isOpen, 
      hasElement: !!ref.current, 
      currentLevel, 
      initialLevel,
      hasRegistered: hasRegisteredRef.current,
      strictMode: strictModeRef.current,
      env: process.env.NODE_ENV
    });
    
    // ✅ ÄNDRAT: Striktare check - även blockera i development vid re-registrering
    if (process.env.NODE_ENV === 'development' && hasRegisteredRef.current) {
      console.log('OVERLAY ⚠️ Open blocked - already registered in development');
      return;
    }
    
    if (!isOpen && !hasRegisteredRef.current) {
      const newLevel = initialLevel ?? currentLevel + 1;
      console.log('OVERLAY ✅ Opening overlay at level:', newLevel);
      setMyLevel(newLevel);
      myLevelRef.current = newLevel;
      setIsOpen(true);
      hasRegisteredRef.current = true;
      register(newLevel, ref);
    } else {
      console.log('OVERLAY ⚠️ Open cancelled - already open or registered');
    }
  }, [isOpen, initialLevel, currentLevel, register]);

  const close = useCallback(() => {
    console.log('OVERLAY 🔒 useOverlay.close called:', { 
      isOpen, 
      myLevel, 
      hasRegistered: hasRegisteredRef.current,
      strictMode: strictModeRef.current,
      env: process.env.NODE_ENV
    });
    
    // ✅ Blokér ALL close() calls i development
    if (process.env.NODE_ENV === 'development') {
      console.log('OVERLAY ⚠️ Close completely blocked in development mode');
      return;
    }
    
    if (isOpen && myLevel !== null && hasRegisteredRef.current) {
      console.log('OVERLAY ✅ Closing overlay at level:', myLevel);
      setIsOpen(false);
      unregister(myLevel);
      setMyLevel(null);
      myLevelRef.current = null;
      hasRegisteredRef.current = false;
    } else {
      console.log('OVERLAY ⚠️ Close cancelled - not open or not registered');
    }
  }, [isOpen, myLevel, unregister]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // ✅ HELT DISABLE auto-close useEffect i development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('OVERLAY 🚫 AUTO-CLOSE completely disabled in development');
      return; // ✅ Exit tidligt - ingen logic overhovedet
    }
    
    if (isOpen && myLevel !== null && currentLevel < myLevel) {
      console.log('OVERLAY 📉 AUTO-CLOSE triggered (production only)');
      close();
    }
  }, []); // ✅ TOM array i development for at undgå ANY triggers

  // ✅ Minimal cleanup
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('OVERLAY 🧹 CLEANUP completely disabled in development');
        strictModeRef.current = true;
        return;
      }
      
      if (hasRegisteredRef.current && myLevelRef.current !== null) {
        console.log('OVERLAY 🧹 CLEANUP (production only):', myLevelRef.current);
        unregister(myLevelRef.current);
        hasRegisteredRef.current = false;
      }
    };
  }, []);

  return {
    ref: callbackRef,
    isOpen,
    open,
    close,
    toggle,
    level: myLevel,
    zIndex: myLevel ? 1000 + myLevel : undefined,
  };
};

// Super enkel hook for eksisterende komponenter
export const useOverlayAutoRegister = (ref: React.RefObject<HTMLElement | null>, isOpen: boolean) => {
  const { level: currentLevel, register, unregister } = useOverlayLayer();
  const myLevel = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && ref.current && myLevel.current === null) {
      const newLevel = currentLevel + 1;
      myLevel.current = newLevel;
      register(newLevel, ref);
    } else if (!isOpen && myLevel.current !== null) {
      unregister(myLevel.current);
      myLevel.current = null;
    }
  }, [isOpen, currentLevel, register, unregister, ref]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (myLevel.current !== null) {
        unregister(myLevel.current);
      }
    };
  }, [unregister]);

  return {
    level: myLevel.current,
    zIndex: myLevel.current ? 1000 + myLevel.current : undefined,
  };
};

// Simple hook for components that just need to know if they should close
export const useOverlayAutoClose = (onClose: () => void, myLevel?: number) => {
  const { level } = useOverlayLayer();
  const lastLevelRef = useRef(level);

  useEffect(() => {
    console.log('🔍 OverlayAutoClose check:', {
      currentLevel: level,
      lastLevel: lastLevelRef.current,
      myLevel,
      shouldClose: lastLevelRef.current > level && (!myLevel || level < myLevel)
    });

    // ✅ Kun lukk hvis:
    // 1. Level har droppet (lastLevel > currentLevel)
    // 2. OG enten ingen myLevel er spesifisert, eller currentLevel er under myLevel
    if (lastLevelRef.current > level && (!myLevel || level < myLevel)) {
      console.log('📉 Auto-close triggered for level', myLevel || 'any');
      onClose();
    }
    lastLevelRef.current = level;
  }, [level, onClose, myLevel]);
};