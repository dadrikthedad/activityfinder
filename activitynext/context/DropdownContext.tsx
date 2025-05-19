"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

type Dropdown = {
  id: string;
  close: () => void;
};

type DropdownContextType = {
  register: (dropdown: Dropdown) => void;
  unregister: (id: string) => void;
};

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

export const DropdownProvider: React.FC<React.PropsWithChildren<object>> = ({ children }) => {
  const [dropdowns, setDropdowns] = useState<Dropdown[]>([]);
  const dropdownsRef = useRef<Dropdown[]>([]); // 💡 brukes til å lese siste verdi

  useEffect(() => {
    dropdownsRef.current = dropdowns;
  }, [dropdowns]);

  const register = useCallback((dropdown: Dropdown) => {
    setDropdowns((prev) => {
      const exists = prev.some((d) => d.id === dropdown.id);
      return exists ? prev : [...prev, dropdown];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setDropdowns((prev) => prev.filter((d) => d.id !== id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dropdownsRef.current.length > 0) {
        const lastDropdown = dropdownsRef.current[dropdownsRef.current.length - 1];
        lastDropdown.close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // ❗️kun én gang ved mount

  const contextValue = React.useMemo(
    () => ({ register, unregister }),
    [register, unregister]
  );

  return (
    <DropdownContext.Provider value={contextValue}>
      {children}
    </DropdownContext.Provider>
  );
};

export const useDropdown = (): DropdownContextType => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("useDropdown must be used within a DropdownProvider");
  }
  return context;
};