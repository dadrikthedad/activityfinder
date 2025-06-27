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
  register: (ref: RefObject<HTMLElement | null>) => number;
  unregister: (level: OverlayLevel) => void;
  closeLevel: (level: OverlayLevel) => void;
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
  const nextLevelRef = useRef(1);
  const componentLevelMap = useRef<Map<RefObject<HTMLElement | null>, OverlayLevel>>(new Map());

  const register = useCallback((ref: RefObject<HTMLElement | null>) => {
    // Sjekk om denne ref-en allerede er registrert
    const existingLevel = componentLevelMap.current.get(ref);
    if (existingLevel !== undefined) {
      console.log('OVERLAY ♻️ Reusing existing level for ref:', existingLevel);
      return existingLevel;
    }
    
    const newLevel = nextLevelRef.current++;
    refMap.current.set(newLevel, ref);
    componentLevelMap.current.set(ref, newLevel);
    setLevel(newLevel);
    
    console.log('OVERLAY 📝 Registered level:', newLevel, 'Total overlays:', refMap.current.size, 'Next counter:', nextLevelRef.current);
    return newLevel;
  }, []);

  const unregister = useCallback((lvl: OverlayLevel) => {
    if (!refMap.current.has(lvl)) return;
    
    const ref = refMap.current.get(lvl);
    refMap.current.delete(lvl);
    if (ref) {
      componentLevelMap.current.delete(ref);
    }
    console.log('OVERLAY ❌ Unregistered level:', lvl, 'Remaining levels:', Array.from(refMap.current.keys()));
    
    if (refMap.current.size === 0) {
      setLevel(0);
      nextLevelRef.current = 1; // Reset counter when no overlays left
      console.log('OVERLAY 🔄 Reset level counter to 1 - no overlays remaining');
    } else {
      const levels = Array.from(refMap.current.keys());
      const newLevel = Math.max(...levels);
      setLevel(newLevel);
      
      // ALWAYS reset counter to highest + 1 for better optimization
      const highestLevel = Math.max(...levels);
      nextLevelRef.current = highestLevel + 1;
      console.log('OVERLAY 🔄 Set level counter to:', nextLevelRef.current, 'based on highest level:', highestLevel);
    }
  }, []);

  const closeLevel = useCallback((targetLevel: OverlayLevel) => {
    // Close this level and all higher levels
    const levelsToClose = Array.from(refMap.current.keys())
      .filter(lvl => lvl >= targetLevel)
      .sort((a, b) => b - a); // Close highest first
    
    levelsToClose.forEach(lvl => unregister(lvl));
  }, [unregister]);

  const closeAllLevels = useCallback(() => {
    refMap.current.clear();
    componentLevelMap.current.clear();
    setLevel(0);
    nextLevelRef.current = 1;
    console.log('OVERLAY 🧹 Closed all levels and reset counter');
  }, []);

  // Handle clicks on lower-level components - close higher levels
  useEffect(() => {
    if (level === 0) return;

    const handleClick = (e: MouseEvent) => {
      // Check from lowest to highest level to find which level was clicked
      const levels = Array.from(refMap.current.keys()).sort((a, b) => a - b);
      let clickedLevel: number | null = null;
      
      for (const lvl of levels) {
        const ref = refMap.current.get(lvl);
        if (ref?.current?.contains(e.target as Node)) {
          clickedLevel = lvl;
          break; // Found the lowest level that contains the click
        }
      }
      
      if (clickedLevel !== null) {
        // Close all levels higher than the clicked level
        const levelsToClose = levels.filter(lvl => lvl > clickedLevel!);
        if (levelsToClose.length > 0) {
          console.log('OVERLAY 🎯 Click on lower level', clickedLevel, 'closing higher levels:', levelsToClose);
          levelsToClose.forEach(lvl => unregister(lvl));
        }
      } else {
        // Click was outside all overlays - close highest level (existing behavior)
        const highestLevel = Math.max(...levels);
        console.log('OVERLAY 🖱️ Outside click, closing level:', highestLevel);
        closeLevel(highestLevel);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [level, closeLevel, unregister]);

  // Handle escape key - close highest level
  useEffect(() => {
    if (level === 0) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        
        const levels = Array.from(refMap.current.keys());
        const highestLevel = Math.max(...levels);
        console.log('OVERLAY ⌨️ Escape pressed, closing level:', highestLevel);
        closeLevel(highestLevel);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [level, closeLevel]);

  return (
    <OverlayLayerContext.Provider value={{
      level,
      register,
      unregister,
      closeLevel,
      closeAllLevels,
    }}>
      {children}
    </OverlayLayerContext.Provider>
  );
};

// Simplified main overlay hook
export const useOverlay = () => {
  const { register, unregister } = useOverlayLayer();
  const [isOpen, setIsOpen] = useState(false);
  const [myLevel, setMyLevel] = useState<number | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const hasRegisteredRef = useRef(false);

  const callbackRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);

  const open = useCallback(() => {
    if (isOpen || hasRegisteredRef.current) return;
    
    // Kun registrer hvis vi ikke allerede har gjort det
    const level = register(ref);
    setMyLevel(level);
    setIsOpen(true);
    hasRegisteredRef.current = true;
    console.log('OVERLAY 🚀 Opened at level:', level);
  }, [isOpen, register]);

  const close = useCallback(() => {
    if (!isOpen || myLevel === null || !hasRegisteredRef.current) return;
    
    unregister(myLevel);
    setIsOpen(false);
    setMyLevel(null);
    hasRegisteredRef.current = false;
    console.log('OVERLAY 🔒 Closed level:', myLevel);
  }, [isOpen, myLevel, unregister]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasRegisteredRef.current && myLevel !== null) {
        unregister(myLevel);
        hasRegisteredRef.current = false;
      }
    };
  }, [myLevel, unregister]);

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

// Auto-close hook when level drops below component's level
export const useOverlayAutoClose = (onClose: () => void, myLevel?: number) => {
  const { level } = useOverlayLayer();
  const lastLevelRef = useRef(level);

  useEffect(() => {
    // Only close if we had a higher level before and now it's lower
    if (lastLevelRef.current > level && myLevel && level < myLevel) {
      console.log('📉 Auto-close triggered for level', myLevel);
      onClose();
    }
    lastLevelRef.current = level;
  }, [level, onClose, myLevel]);
};

// Simple hook for existing components that manage their own state
export const useOverlayAutoRegister = (
  ref: React.RefObject<HTMLElement | null>, 
  isOpen: boolean
) => {
  const { register, unregister } = useOverlayLayer();
  const myLevel = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && ref.current && myLevel.current === null) {
      myLevel.current = register(ref);
    } else if (!isOpen && myLevel.current !== null) {
      unregister(myLevel.current);
      myLevel.current = null;
    }
  }, [isOpen, register, unregister, ref]);

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