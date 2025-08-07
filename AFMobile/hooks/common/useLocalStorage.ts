// hooks/useAsyncStorage.ts - React Native version
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useAsyncStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Read value from AsyncStorage
  const readValue = useCallback(async (): Promise<T> => {
    try {
      const item = await AsyncStorage.getItem(key);
      if (item !== null) {
        const parsed = JSON.parse(item);
        console.log(`📦 [AsyncStorage] Read '${key}':`, parsed);
        return parsed;
      } else {
        console.log(`📦 [AsyncStorage] No existing value for '${key}', using initialValue`);
        return initialValue;
      }
    } catch (error) {
      console.warn(`⚠️ [AsyncStorage] Error reading key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  // Set value in AsyncStorage and state
  const setValue = useCallback(async (value: T) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      console.log(`💾 [AsyncStorage] Updated '${key}' with:`, value);
      setStoredValue(value);
    } catch (error) {
      console.warn(`⚠️ [AsyncStorage] Error writing key "${key}":`, error);
    }
  }, [key]);

  // Remove value from AsyncStorage
  const removeValue = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(key);
      console.log(`🗑️ [AsyncStorage] Removed '${key}'`);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`⚠️ [AsyncStorage] Error removing key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Load initial value on mount
  useEffect(() => {
    const loadInitialValue = async () => {
      setIsLoading(true);
      const value = await readValue();
      setStoredValue(value);
      setIsLoading(false);
    };

    loadInitialValue();
  }, [readValue]);

  // Note: AsyncStorage doesn't have built-in cross-app storage events like localStorage
  // If you need cross-app synchronization, you'd need to implement a custom solution
  // or use a library like react-native-mmkv with listeners

  return [storedValue, setValue, removeValue, isLoading] as const;
}