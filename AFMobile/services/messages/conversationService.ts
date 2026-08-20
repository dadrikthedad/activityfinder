// Samtale API-kall til backend relatert til samtaler. Henter samtaler, henter meldinger til samtaler
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { ApiRoutes } from "@/constants/routes";
import { MessageDTO } from "@shared/types/MessageDTO"; // ← viktig!
import { PagedConversationsResponseDTO } from "@shared/types/ConversationDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { EncryptedMessageDTO } from "@/features/crypto/types/EncryptedMessageTypes";
import { decryptMessagesToDto } from "@/features/crypto/services/messageDecryption";

// Speil av MessagesResponse.cs i AFBack — paginert, E2EE-kryptert meldingsliste
interface MessagesResponse {
  messages: EncryptedMessageDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
// Henter alle samtalene til en bruker
export async function getMyConversations(
    skip: number = 0,
    take: number = 20
  ): Promise<PagedConversationsResponseDTO | null> {
    const page = Math.floor(skip / take) + 1;
    const query = new URLSearchParams({ Page: page.toString(), PageSize: take.toString() });
    const url = `${ApiRoutes.conversation.active}?${query.toString()}`;

    console.log("🔵 Henter samtaler:", url);

    return await fetchWithAuth<PagedConversationsResponseDTO>(url);
  }

// Henter meldinger for en samtale fra MessageController (GET /api/message/{conversationId}).
// Backend bruker Page/PageSize (1-indeksert) og returnerer E2EE-krypterte meldinger i en
// MessagesResponse-wrapper. Vi oversetter skip/take → Page/PageSize, pakker ut .messages,
// og dekrypterer til MessageDTO[] slik at konsumentene beholder samme kontrakt som før.
export async function getMessagesForConversation(
  conversationId: number,
  skip: number = 0,
  take: number = 20
): Promise<MessageDTO[] | null> {
  const page = Math.floor(skip / take) + 1;
  const query = new URLSearchParams({ Page: page.toString(), PageSize: take.toString() });
  const url = `${ApiRoutes.message.byConversation(conversationId)}?${query.toString()}`;

  console.log("🔵 Kaller backend med:", url);

  const data = await fetchWithAuth<MessagesResponse>(url);
  if (!data) return null;

  return await decryptMessagesToDto(data.messages ?? []);
}

// Henter kun en enkelt samtale, brukes når vi oppretter en ny samtale ved å sende fra frontend
export async function getConversationById(
  conversationId: number
): Promise<ConversationDTO | null> {
  const url = ApiRoutes.conversation.byId(conversationId);

  console.log("🔵 Henter samtale:", url);

  return await fetchWithAuth<ConversationDTO>(url);
}

// Søker etter samtaler basert på navn eller gruppenavn.
// Backend (GET /api/conversation/search) krever Query + paginering og svarer med ConversationsResponse-wrapper.
export async function searchConversations(query: string): Promise<ConversationDTO[] | null> {
  const params = new URLSearchParams({ Query: query.trim(), Page: "1", PageSize: "20" });
  const url = `${ApiRoutes.conversation.search}?${params.toString()}`;

  console.log("🔵 Søker samtaler med:", url);

  const data = await fetchWithAuth<PagedConversationsResponseDTO>(url);
  return data?.conversations ?? null;
}

// Henter pending (uavklarte) samtaler — direktesamtale-forespørsler og gruppeinvitasjoner.
// Backend (GET /api/conversation/pending) er paginert og svarer med ConversationsResponse-wrapper.
// Returnerer hele wrapperen slik at hooken kan utlede totalCount/hasMore.
export async function getPendingConversations(
  page: number = 1,
  pageSize: number = 10
): Promise<PagedConversationsResponseDTO | null> {
  const params = new URLSearchParams({ Page: page.toString(), PageSize: pageSize.toString() });
  const url = `${ApiRoutes.conversation.pending}?${params.toString()}`;

  console.log("🟡 Henter pending samtaler:", url);

  return await fetchWithAuth<PagedConversationsResponseDTO>(url);
}

// Henter samtaler som er avslått av mottakeren.
// Backend (GET /api/conversation/rejected) er paginert og svarer med ConversationsResponse-wrapper.
export async function getRejectedConversations(): Promise<ConversationDTO[] | null> {
  const params = new URLSearchParams({ Page: "1", PageSize: "100" });
  const url = `${ApiRoutes.conversation.rejected}?${params.toString()}`;

  console.log("🔵 Henter avslåtte samtaler:", url);

  const data = await fetchWithAuth<PagedConversationsResponseDTO>(url);
  return data?.conversations ?? null;
}

// Sletter (arkiverer) en samtale for brukeren.
// Backend har ingen separat soft-delete: DELETE /api/conversation/{id} = arkivér (ConversationArchived = true).
export async function deleteConversation(conversationId: number): Promise<{ message: string } | null> {
  const url = ApiRoutes.conversation.byId(conversationId);
  console.log("🔴 Sletter (arkiverer) samtale:", url);

  return await fetchWithAuth<{ message: string }>(url, {
    method: 'DELETE'
  });
}

// Gjenoppretter en arkivert samtale for brukeren.
export async function restoreConversation(conversationId: number): Promise<{ message: string } | null> {
  const url = ApiRoutes.conversation.restore(conversationId);
  console.log("🟢 Gjenoppretter samtale:", url);

  return await fetchWithAuth<{ message: string }>(url, {
    method: 'POST'
  });
}

// "Slettede" samtaler = arkiverte samtaler (backend skiller ikke).
// GET /api/conversation/archived svarer med ConversationsResponse-wrapper — pakk ut .conversations.
export async function getDeletedConversations(): Promise<ConversationDTO[] | null> {
  const url = ApiRoutes.conversation.archived;
  console.log("🗑️ Henter arkiverte (slettede) samtaler:", url);

  const data = await fetchWithAuth<PagedConversationsResponseDTO>(url);
  return data?.conversations ?? null;
}
  

