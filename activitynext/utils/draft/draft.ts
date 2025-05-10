// For å lagre det vi har starte på i en samtale
const DRAFTS_KEY = "chat-drafts";

export const getDraftFor = (conversationId: number): string => { //Henter draften ved samtalebytte
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed[conversationId] || "";
};

export const saveDraftFor = (conversationId: number, text: string) => { // lagrer draften
  const raw = localStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  parsed[conversationId] = text;
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(parsed));
};

export const clearDraftFor = (conversationId: number) => { // sletter draften ved sending
  const raw = localStorage.getItem(DRAFTS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  delete parsed[conversationId];
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(parsed));
};

export const clearAllDrafts = () => { // Sletter alle drafts ved utlogging
  localStorage.removeItem("chat-drafts");
};