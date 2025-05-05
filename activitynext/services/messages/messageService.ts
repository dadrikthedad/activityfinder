import { postRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { SendMessageRequestDTO, MessageDTO } from "@/types/MessageDTO";

export async function sendMessage(
  payload: SendMessageRequestDTO
): Promise<MessageDTO | null> {
  const url = `${API_BASE_URL}/api/messages`;
  return await postRequest<MessageDTO, SendMessageRequestDTO>(url, payload);
}