import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from "zustand/middleware";

/**
 * AsyncStorage adapter for zustand/persist på React Native
 */
export const asyncStorage: StateStorage = {
  /** returnerer JSON-string eller null */
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
    }
  },
};