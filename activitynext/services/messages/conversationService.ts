// Samtale API-kall til backend relatert til samtaler. Henter samtaler, henter meldinger til samtaler
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";
import { MessageDTO } from "@/types/MessageDTO"; // ← viktig!
import { PagedConversationsResponseDTO } from "@/types/ConversationDTO";
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

// her henter vi pending-samtaler



  

