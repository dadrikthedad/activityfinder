import { postRequest, getRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { UserPublicKeyDTO, ConversationKeyDTO } from "@/features/crypto/types/EncryptedMessageTypes";

// E2EE Key management
export async function storePublicKey(publicKey: string): Promise<any> {
  const url = `${API_BASE_URL}/api/e2ee/public-key`;
  return await postRequest<any, { publicKey: string }>(url, { publicKey });
}

export async function getConversationKeys(conversationId: number): Promise<ConversationKeyDTO | null> {
  const url = `${API_BASE_URL}/api/e2ee/conversation/${conversationId}/keys`;
  return await getRequest<ConversationKeyDTO>(url);
}

export async function getPublicKeysForUsers(userIds: number[]): Promise<UserPublicKeyDTO[] | null> {
  const url = `${API_BASE_URL}/api/e2ee/users/public-keys`;
  return await postRequest<UserPublicKeyDTO[], number[]>(url, userIds);
}

export async function getMyPublicKey(): Promise<UserPublicKeyDTO | null> {
  const url = `${API_BASE_URL}/api/e2ee/public-key`;
  return await getRequest<UserPublicKeyDTO>(url);
}
