// Samtale API-kall til backend relatert til samtaler. Henter samtaler, henter meldinger til samtaler
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { MessageDTO } from "@shared/types/MessageDTO"; // ← viktig!
import { PagedConversationsResponseDTO } from "@shared/types/ConversationDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";
// Henter alle samtalene til en bruker
export async function getMyConversations(
    skip: number = 0,
    take: number = 20
  ): Promise<PagedConversationsResponseDTO | null> {
    const query = new URLSearchParams({ skip: skip.toString(), take: take.toString() });
    const url = `${API_BASE_URL}/api/conversations/my-conversations?${query.toString()}`;
  
    console.log("🔵 Henter samtaler:", url);
  
    return await fetchWithAuth<PagedConversationsResponseDTO>(url);
  }

// Her henter vi meldinger til en samtale fra backend sin GetMessagesForConversation i ConversationController.cs. Henter en liste utifra conversationId, og 20 stk omgangen med paginering
export async function getMessagesForConversation(
  conversationId: number,
  skip: number = 0,
  take: number = 20
): Promise<MessageDTO[] | null> {
  const query = new URLSearchParams({ skip: skip.toString(), take: take.toString() });
  const url = `${API_BASE_URL}/api/conversations/conversation/${conversationId}?${query.toString()}`;

  console.log("🔵 Kaller backend med:", url);

  return await fetchWithAuth<MessageDTO[]>(url);
}

// Henter kun en enkelt samtale, brukes når vi oppretter en ny samtale ved å sende fra frontend
export async function getConversationById(
  conversationId: number
): Promise<ConversationDTO | null> {
  const url = `${API_BASE_URL}/api/conversations/${conversationId}`;

  console.log("🔵 Henter samtale:", url);

  return await fetchWithAuth<ConversationDTO>(url);
}

// Søker etter samtaler basert på navn eller gruppenavn
export async function searchConversations(query: string): Promise<ConversationDTO[] | null> {
  const encodedQuery = encodeURIComponent(query.trim());
  const url = `${API_BASE_URL}/api/conversations/search-conversations?query=${encodedQuery}`;

  console.log("🔵 Søker samtaler med:", url);

  return await fetchWithAuth<ConversationDTO[]>(url);
}

// Henter samtaler som er avslått av mottakeren
export async function getRejectedConversations(): Promise<ConversationDTO[] | null> {
  const url = `${API_BASE_URL}/api/conversations/rejected`;

  console.log("🔵 Henter avslåtte samtaler:", url);

  return await fetchWithAuth<ConversationDTO[]>(url);
}

// Sletter en 1-1 samtale
export async function deleteConversation(conversationId: number): Promise<{ message: string } | null> {
  const url = `${API_BASE_URL}/api/conversations/${conversationId}/delete`;
  console.log("🔴 Sletter samtale:", url);
  
  return await fetchWithAuth<{ message: string }>(url, {
    method: 'DELETE'
  });
}

// Gjenoppretter en slettet samtale for brukeren
export async function restoreConversation(conversationId: number): Promise<{ message: string } | null> {
  const url = `${API_BASE_URL}/api/conversations/${conversationId}/restore`;
  console.log("🟢 Gjenoppretter samtale:", url);
  
  return await fetchWithAuth<{ message: string }>(url, {
    method: 'POST'
  });
}

// Slettede samtaleliste
export async function getDeletedConversations(): Promise<ConversationDTO[] | null> {
  const url = `${API_BASE_URL}/api/conversations/deleted`;
  console.log("🗑️ Henter slettede samtaler:", url);
  return await fetchWithAuth<ConversationDTO[]>(url);
}
  

