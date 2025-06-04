import { postRequest, getRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { SendMessageRequestDTO, MessageDTO } from "@/types/MessageDTO";
import { MessageRequestDTO } from "@/types/MessageReqeustDTO";

// Sende meldinger til bruker eller grupper
export async function sendMessage(
  payload: SendMessageRequestDTO
): Promise<MessageDTO | null> {
  const url = `${API_BASE_URL}/api/messages`;
  return await postRequest<MessageDTO, SendMessageRequestDTO>(url, payload);
}
// Henter alle meldingsforespørsler
export async function getPendingMessageRequests(): Promise<MessageRequestDTO[] | null> {
  const url = `${API_BASE_URL}/api/messages/pending`;
  return await getRequest<MessageRequestDTO[]>(url);
}

// Godkjenner meldingsforespørsler
export async function approveMessageRequest(senderId: number): Promise<void> {
  const url = `${API_BASE_URL}/api/messages/approve-request`;
  await postRequest<void, number>(url, senderId);
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

// Henter én spesifikk meldingsforespørsel
export async function getPendingMessageRequestById(conversationId: number): Promise<MessageRequestDTO | null> {
  const url = `${API_BASE_URL}/api/messages/pending/${conversationId}`;
  return await getRequest<MessageRequestDTO>(url);
}