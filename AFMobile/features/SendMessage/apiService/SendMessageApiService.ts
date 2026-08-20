import { postRequest } from "@/services/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { SendEncryptedMessageRequestDTO } from "@/features/crypto/types/EncryptedMessageTypes";
import { SendEncryptedMessageResponseDTO } from "@/features/OptimsticMessage/types/MessagesToBackendTypes";

// Sender en kryptert melding til en eksisterende samtale via MessageController (POST /api/message).
// Backend svarer med SendMessageResponse (messageId + sentAt + attachments).
export async function sendMessage(
  payload: SendEncryptedMessageRequestDTO
): Promise<SendEncryptedMessageResponseDTO | null> {
  return await postRequest<SendEncryptedMessageResponseDTO, SendEncryptedMessageRequestDTO>(
    ApiRoutes.message.send,
    payload
  );
}
