// features/messages/services/messageEncryptionService.ts
// Krypterer en melding for en NY samtale, der vi ikke har en conversationId i cachen ennå.
// Henter mottakernes (og avsenderens egen) public keys direkte fra backend og forsegler
// meldingen per mottaker via EncryptMessageService (crypto_box_seal).

import { getRequest, postRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import authServiceNative from "@/core/auth/authServiceNative";
import { EncryptMessageService } from "@/features/crypto/services/EncryptMessageService";

// Speil av UserPublicKeyResponse.cs / ConversationKeysResponse.cs i AFBack
interface UserPublicKeyResponse {
  userId: string;
  publicKey: string;
  keyVersion: number;
}

interface ConversationKeysResponse {
  participantKeys: UserPublicKeyResponse[];
}

export interface EncryptedPayload {
  encryptedText: string;
  keyInfo: Record<string, string>;
  iv: string;
  version: number;
}

function buildRecipientKeys(keys: UserPublicKeyResponse[]): Record<string, string> {
  const recipientKeys: Record<string, string> = {};
  for (const key of keys) {
    recipientKeys[key.userId] = key.publicKey;
  }
  return recipientKeys;
}

/**
 * Krypterer en melding for en ny 1-til-1-samtale.
 * KeyInfo inkluderer BÅDE mottaker og avsender slik at avsender kan dekryptere egen melding.
 * Kaster ved feil (ingen nøkler, krypteringsfeil) — kalleren mapper til MessagingErrorCode.
 */
export async function encryptForReceivers(
  text: string,
  receiverIds: string[],
): Promise<EncryptedPayload> {
  const selfId = await authServiceNative.getCurrentUserId();

  // Unngå duplikater og ta med egen ID slik at vi kan lese vår egen sendte melding
  const userIds = Array.from(new Set([...receiverIds, ...(selfId ? [selfId] : [])]));

  const keys = await postRequest<UserPublicKeyResponse[], { userIds: string[] }>(
    ApiRoutes.encryption.usersPublicKeys,
    { userIds },
  );

  if (!keys || keys.length === 0) {
    throw new Error("No public keys available for recipients");
  }

  const encrypted = await EncryptMessageService.getInstance().encryptMessage(
    text,
    buildRecipientKeys(keys),
  );

  return {
    encryptedText: encrypted.encryptedText ?? "",
    keyInfo: encrypted.keyInfo,
    iv: encrypted.iv,
    version: encrypted.version,
  };
}

/**
 * Krypterer en melding for en eksisterende samtale (brukes for gruppens første melding
 * etter at gruppen er opprettet). Henter alle deltakeres public keys via conversationId.
 */
export async function encryptForConversation(
  text: string,
  conversationId: number,
): Promise<EncryptedPayload> {
  const keys = await getRequest<ConversationKeysResponse>(
    ApiRoutes.encryption.conversationKeys(conversationId),
  );

  if (!keys || keys.participantKeys.length === 0) {
    throw new Error("No participant keys available for conversation");
  }

  const encrypted = await EncryptMessageService.getInstance().encryptMessage(
    text,
    buildRecipientKeys(keys.participantKeys),
  );

  return {
    encryptedText: encrypted.encryptedText ?? "",
    keyInfo: encrypted.keyInfo,
    iv: encrypted.iv,
    version: encrypted.version,
  };
}
