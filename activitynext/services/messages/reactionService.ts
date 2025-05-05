// Reaction API-kall til backend relatert til reactions, for øyeblikket kun på meldinger.
import { postRequest, deleteRequest } from "@/services/baseService";

const BASE_URL = "/api/reaction";

export interface ReactionRequest {
  messageId: number;
  emoji: string;
}

// 🔥 Legg til en reaction
export async function addReaction(reaction: ReactionRequest): Promise<void> {
  await postRequest<void, ReactionRequest>(BASE_URL, reaction);
}

// 🔥 Fjern en reaction
export async function removeReaction(messageId: number, emoji: string): Promise<void> {
  const url = `${BASE_URL}?messageId=${messageId}&emoji=${encodeURIComponent(emoji)}`;
  await deleteRequest<void>(url);
}
