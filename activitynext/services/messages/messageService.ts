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