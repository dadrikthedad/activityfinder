// features/messages/services/newMessageService.ts
// Sender første melding i en 1-til-1-samtale. Krypterer mot mottakerens (og egen)
// public key, og kaller POST /api/conversation/send-to-user.

import { postRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { Result } from "@/core/errors/Result";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { SendMessageToUserRequestDTO } from "../models/SendMessageToUserRequestDTO";
import { SendMessageToUserResponseDTO } from "../models/SendMessageToUserResponseDTO";
import { encryptForReceivers } from "./messageEncryptionService";
import { mapMessagingError } from "./mapMessagingError";

export async function sendMessageToUser(
  receiverId: string,
  text: string,
): Promise<Result<SendMessageToUserResponseDTO, MessagingErrorCode>> {
  try {
    const encrypted = await encryptForReceivers(text, [receiverId]);

    const request: SendMessageToUserRequestDTO = {
      receiverId,
      encryptedText: encrypted.encryptedText,
      keyInfo: encrypted.keyInfo,
      iv: encrypted.iv,
      version: encrypted.version,
    };

    const data = await postRequest<SendMessageToUserResponseDTO, SendMessageToUserRequestDTO>(
      ApiRoutes.conversation.sendToUser,
      request,
    );

    if (!data) {
      return Result.fail("Tom respons fra server.", MessagingErrorCode.ServerError);
    }

    return Result.ok(data);
  } catch (error) {
    return mapMessagingError(error);
  }
}
