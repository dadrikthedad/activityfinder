import type { StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";

/**
 * Minimal adapter slik at zustand/persist kan lese / skrive i IndexedDB.
 */
export const indexedDBStorage: StateStorage = {
  /** returnerer JSON-string eller null  */
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
};