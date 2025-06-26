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

  console.log('🔥 OverlayLayerProvider rendered, current level:', level);

  // ✅ Mer stabil register funksjon
  const register = useCallback((lvl: OverlayLevel, ref: RefObject<HTMLElement | null>) => {
    // ✅ Forhindre doble registreringer
    if (refMap.current.has(lvl)) {
      console.log('⚠️ Level', lvl, 'already registered, skipping');
      return;
    }
    
    console.log('📝 Registering overlay at level:', lvl);
    refMap.current.set(lvl, ref);
    
    setLevel((prev) => {
      const newLevel = Math.max(prev, lvl);
      console.log('📊 Level updated from', prev, 'to', newLevel);
      return newLevel;
    });
    
    // Prevent immediate outside click detection
    isProcessingRef.current = true;
    setTimeout(() => {
      isProcessingRef.current = false;
      console.log('✅ Processing protection lifted');
    }, 100);
  }, []); // ✅ Ingen dependencies - funksjon er stabil

  const unregister = useCallback((lvl: OverlayLevel) => {
    // ✅ Sjekk om level faktisk finnes
    if (!refMap.current.has(lvl)) {
      console.log('⚠️ Level', lvl, 'not found for unregistering, skipping');
      return;
    }
    
    console.log('❌ Unregistering overlay at level:', lvl);
    refMap.current.delete(lvl);
    
    if (refMap.current.size === 0) {
      console.log('🧹 All overlays closed, resetting to level 0');
      setLevel(0);
    } else {
      const levels = Array.from(refMap.current.keys());
      const newLevel = Math.max(...levels);
      console.log('📊 Level updated to:', newLevel, 'remaining levels:', levels);
      setLevel(newLevel);
    }
  }, []); // ✅ Ingen dependencies - funksjon er stabil

  const closeOneLevel = useCallback(() => {
    if (level > 0) {
      unregister(level);
    }
  }, [level, unregister]);

  const closeAllLevels = useCallback(() => {
    console.log('🧹 Closing all levels');
    refMap.current.clear();
    setLevel(0);
  }, []);

  // Handle outside clicks
  useEffect(() => {
    if (level === 0) return;

    const handleClick = (e: MouseEvent) => {
      if (isProcessingRef.current) return;

      // Check from highest to lowest level
      for (let current = level; current >= 1; current--) {
        const ref = refMap.current.get(current);
        if (!ref?.current) continue;
        if (ref.current.contains(e.target as Node)) return;
      }
      
      // Click was outside all overlays - close the topmost one
      console.log('🖱️ Outside click detected, closing level:', level);
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
        console.log('⌨️ Escape pressed, closing level:', level);
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

// ✅ Fikset useOverlay hook
export const useOverlay = (initialLevel?: number) => {
  const { level: currentLevel, register, unregister } = useOverlayLayer();
  const [isOpen, setIsOpen] = useState(false);
  const [myLevel, setMyLevel] = useState<number | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const hasRegisteredRef = useRef(false); // ✅ Forhindre doble registreringer

  // Create a callback ref that works with any HTML element
  const callbackRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);

  const open = useCallback(() => {
    console.log('🚀 useOverlay.open called:', { 
      isOpen, 
      hasElement: !!ref.current, 
      currentLevel, 
      initialLevel,
      hasRegistered: hasRegisteredRef.current 
    });
    
    if (!isOpen && !hasRegisteredRef.current) { // ✅ Sjekk begge conditions
      const newLevel = initialLevel ?? currentLevel + 1;
      console.log('✅ Opening overlay at level:', newLevel);
      setMyLevel(newLevel);
      setIsOpen(true);
      hasRegisteredRef.current = true; // ✅ Marker som registrert
      register(newLevel, ref);
    } else {
      console.log('⚠️ Open cancelled - already open or registered');
    }
  }, [isOpen, initialLevel, currentLevel, register]);

  const close = useCallback(() => {
    console.log('🔒 useOverlay.close called:', { isOpen, myLevel, hasRegistered: hasRegisteredRef.current });
    
    if (isOpen && myLevel !== null && hasRegisteredRef.current) {
      console.log('✅ Closing overlay at level:', myLevel);
      setIsOpen(false);
      unregister(myLevel);
      setMyLevel(null);
      hasRegisteredRef.current = false; // ✅ Reset registrering
    }
  }, [isOpen, myLevel, unregister]);

  const toggle = useCallback(() => {
    console.log('🔄 useOverlay.toggle called:', { isOpen });
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // ✅ Forbedret auto-close logic
  useEffect(() => {
    if (isOpen && myLevel !== null && currentLevel < myLevel) {
      console.log('📉 Current level dropped below my level, auto-closing');
      close();
    }
  }, [currentLevel, myLevel, isOpen, close]);

  // ✅ Bedre cleanup
  useEffect(() => {
    return () => {
      if (hasRegisteredRef.current && myLevel !== null) {
        console.log('🧹 Cleanup: unregistering level', myLevel);
        unregister(myLevel);
        hasRegisteredRef.current = false;
      }
    };
  }, [myLevel, unregister]); // ✅ Legg til dependencies

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
export const useOverlayAutoClose = (onClose: () => void) => {
  const { level } = useOverlayLayer();
  const lastLevelRef = useRef(level);

  useEffect(() => {
    if (lastLevelRef.current > level) {
      onClose();
    }
    lastLevelRef.current = level;
  }, [level, onClose]);
};