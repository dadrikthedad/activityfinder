// Reaction API-kall til backend relatert til reactions, for øyeblikket kun på meldinger.
import { postRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/api/routes";

export interface ReactionRequest {
  messageId: number;
  emoji: string;
}

// 🔥 Legg til en reaction
export async function addReaction(reaction: ReactionRequest): Promise<void> {
  const url = `${API_BASE_URL}/api/reaction`;
  await postRequest<void, ReactionRequest>(url, reaction);
}
