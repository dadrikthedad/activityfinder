// features/messages/services/groupConversationService.ts
// Oppretter en gruppesamtale (multipart, POST /api/groupconversation/create) og sender
// en valgfri kryptert førstemelding til den nye samtalen via POST /api/message.

import { postFormDataRequest, postRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { Result, VoidResult } from "@/core/errors/Result";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { CreateGroupConversationRequestDTO } from "../models/CreateGroupConversationRequestDTO";
import { CreateGroupConversationResponseDTO } from "../models/CreateGroupConversationResponseDTO";
import { encryptForConversation } from "./messageEncryptionService";
import { mapMessagingError } from "./mapMessagingError";

// Body til POST /api/message (speil av MessageRequest.cs — tekstvarianten)
interface SendMessageBody {
  conversationId: number;
  encryptedText: string;
  keyInfo: Record<string, string>;
  iv: string;
  version: number;
  optimisticId: string;
}

export async function createGroupConversation(
  payload: CreateGroupConversationRequestDTO,
): Promise<Result<CreateGroupConversationResponseDTO, MessagingErrorCode>> {
  try {
    const formData = new FormData();
    payload.receiverIds.forEach((id) => formData.append("ReceiverIds", id));
    formData.append("GroupName", payload.groupName);
    if (payload.groupDescription) {
      formData.append("GroupDescription", payload.groupDescription);
    }
    if (payload.groupImage) {
      formData.append("GroupImage", {
        uri: payload.groupImage.uri,
        name: payload.groupImage.name,
        type: payload.groupImage.type,
      } as unknown as Blob);
    }

    const data = await postFormDataRequest<CreateGroupConversationResponseDTO>(
      ApiRoutes.groupConversation.create,
      formData,
    );

    if (!data) {
      return Result.fail("Tom respons fra server.", MessagingErrorCode.ServerError);
    }

    return Result.ok(data);
  } catch (error) {
    return mapMessagingError(error);
  }
}

/**
 * Sender en kryptert førstemelding til en nyopprettet gruppe.
 * Henter gruppens deltakernøkler via conversationId og forsegler per deltaker.
 */
export async function sendGroupInitialMessage(
  conversationId: number,
  text: string,
): Promise<VoidResult<MessagingErrorCode>> {
  try {
    const encrypted = await encryptForConversation(text, conversationId);

    const body: SendMessageBody = {
      conversationId,
      encryptedText: encrypted.encryptedText,
      keyInfo: encrypted.keyInfo,
      iv: encrypted.iv,
      version: encrypted.version,
      optimisticId: "",
    };

    await postRequest<unknown, SendMessageBody>(ApiRoutes.message.send, body);
    return Result.okVoid();
  } catch (error) {
    return mapMessagingError(error);
  }
}
