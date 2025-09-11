import { postRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { SendEncryptedMessageWithFilesRequestDTO } from "@/features/OptimsticMessage/types/MessagesToBackendTypes";

export async function uploadEncryptedAttachmentsJSON(request: SendEncryptedMessageWithFilesRequestDTO) {
  const url = `${API_BASE_URL}/api/EncryptedMessage/upload-encrypted-json`;
  return await postRequest(url, request);
}