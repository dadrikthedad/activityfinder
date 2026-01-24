import { postRequest, getRequest, deleteRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { SendMessageRequestDTO, MessageDTO } from "@shared/types/MessageDTO";

// Ny metode for å sende melding via SendMessageController
export async function sendMessage(
  payload: SendMessageRequestDTO
): Promise<MessageDTO | null> {
  const url = `${API_BASE_URL}/api/sendmessage`;
  return await postRequest<MessageDTO, SendMessageRequestDTO>(url, payload);
}