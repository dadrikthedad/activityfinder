import { postRequest, getRequest, deleteRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/api/routes";
import { SendMessageRequestDTO, MessageDTO } from "@shared/types/MessageDTO";
import { MessageRequestDTO } from "@shared/types/MessageReqeustDTO";
import { RejectRequestDTO } from "@shared/types/RejectRequestDTO";
import { PaginatedMessageRequestsDTO } from "@shared/types/PaginatedMessageRequestsDTO";

// Sende meldinger til bruker eller grupper
export async function sendTextMessage(
  payload: SendMessageRequestDTO
): Promise<MessageDTO | null> {
  const url = `${API_BASE_URL}/api/messages`;
  return await postRequest<MessageDTO, SendMessageRequestDTO>(url, payload);
}
// Henter alle meldingsforespørsler
export async function getPendingMessageRequests(
  page: number = 1, 
  pageSize: number = 10
): Promise<PaginatedMessageRequestsDTO | null> {
  const url = `${API_BASE_URL}/api/messages/pending?page=${page}&pageSize=${pageSize}`;
  return await getRequest<PaginatedMessageRequestsDTO>(url);
}

// Godkjenner meldingsforespørsler
export async function approveMessageRequest(conversationId: number): Promise<void> {
  const url = `${API_BASE_URL}/api/messages/approve-request/${conversationId}`;
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

// Henter én spesifikk meldingsforespørsel
export async function getPendingMessageRequestById(conversationId: number): Promise<MessageRequestDTO | null> {
  const url = `${API_BASE_URL}/api/messages/pending/${conversationId}`;
  return await getRequest<MessageRequestDTO>(url);
}

// Avslår en meldingsforespørsel
export async function rejectRequest(dto: RejectRequestDTO): Promise<void> {
  const url = `${API_BASE_URL}/api/messages/reject-request`;
  await postRequest<void, RejectRequestDTO>(url, dto);
}

export async function deleteMessage(messageId: number): Promise<MessageDTO | null> {
  const url = `${API_BASE_URL}/api/messages/${messageId}`;
  return await deleteRequest<MessageDTO>(url);
}