import { postRequest, getRequest, deleteRequest } from "@/services/baseService";
import { API_BASE_URL, ApiRoutes } from "@/constants/routes";
import { SendMessageRequestDTO, MessageDTO } from "@shared/types/MessageDTO";
import { EncryptedMessageDTO } from "@/features/crypto/types/EncryptedMessageTypes";
import { SendEncryptedMessageRequestDTO } from "@/features/crypto/types/EncryptedMessageTypes";

// Sende meldinger til bruker eller grupper
export async function sendTextMessage(
  payload: SendMessageRequestDTO
): Promise<MessageDTO | null> {
  const url = ApiRoutes.message.send;
  return await postRequest<MessageDTO, SendMessageRequestDTO>(url, payload);
}
// Godkjenner en pending direktesamtale-forespørsel.
// Backend: POST /api/conversation/{id}/accept (flyttet fra MessageController, ingen body).
export async function approveMessageRequest(conversationId: number): Promise<void> {
  const url = ApiRoutes.conversation.accept(conversationId);
  await postRequest<void, undefined>(url, undefined); // Ingen body
}

// Søker etter meldinger i en gitt samtale
export async function searchMessagesInConversation(
  conversationId: number,
  query: string,
  skip: number = 0,
  take: number = 50
): Promise<MessageDTO[] | null> {
  const url = `${API_BASE_URL}/api/messages/search?conversationId=${conversationId}&query=${encodeURIComponent(query)}&skip=${skip}&take=${take}`;
  return await getRequest<MessageDTO[]>(url);
}

// Avslår en pending direktesamtale-forespørsel.
// Backend: POST /api/conversation/{id}/reject (identifikator flyttet fra body til route-param, ingen body).
// Merk: gruppe-reject hører til GroupConversationController og tas i gruppe-batchen.
export async function rejectRequest(conversationId: number): Promise<void> {
  const url = ApiRoutes.conversation.reject(conversationId);
  await postRequest<void, undefined>(url, undefined);
}

export async function deleteMessage(messageId: number): Promise<MessageDTO | null> {
  const url = ApiRoutes.message.byId(messageId);
  return await deleteRequest<MessageDTO>(url);
}

// Død kode (ingen konsumenter) — den live krypterte sende-stien går via
// features/SendMessage/apiService (ApiRoutes.message.send). Beholdt repekt mot riktig endepunkt.
export async function sendEncryptedMessage(
  payload: SendEncryptedMessageRequestDTO
): Promise<EncryptedMessageDTO | null> {
  const url = ApiRoutes.message.send;
  return await postRequest<EncryptedMessageDTO, SendEncryptedMessageRequestDTO>(url, payload);
}