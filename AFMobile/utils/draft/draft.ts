// For å lagre det vi har starte på i en samtale
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = "chat-drafts";

export const getDraftFor = async (conversationId: number): Promise<string> => {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed[conversationId] || "";
};

export const saveDraftFor = async (conversationId: number, text: string) => {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  parsed[conversationId] = text;
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(parsed));
};

export const clearDraftFor = async (conversationId: number) => {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  delete parsed[conversationId];
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(parsed));
};

export const clearAllDrafts = async () => {
  await AsyncStorage.removeItem(DRAFTS_KEY);
};