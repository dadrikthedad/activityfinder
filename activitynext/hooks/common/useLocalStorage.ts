// hooks/useLocalStorage.ts
import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") return initialValue;
  
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        console.log(`📦 [localStorage] Read '${key}':`, parsed);
        return parsed;
      } else {
        console.log(`📦 [localStorage] No existing value for '${key}', using initialValue`);
        return initialValue;
      }
    } catch (error) {
      console.warn(`⚠️ [localStorage] Error reading key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = (value: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      console.log(`💾 [localStorage] Updated '${key}' with:`, value);
      setStoredValue(value);
    } catch (error) {
      console.warn(`⚠️ [localStorage] Error writing key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const newValue = readValue();
      console.log(`🔄 [localStorage] Storage event triggered for '${key}':`, newValue);
      setStoredValue(newValue);
    };
  
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, readValue]);

  return [storedValue, setValue] as const;
}