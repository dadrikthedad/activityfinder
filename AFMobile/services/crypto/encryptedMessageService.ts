import { postRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";

export async function uploadEncryptedAttachmentsJSON(request: {
  encryptedFilesData: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    keyInfo: { [userId: string]: string };
    iv: string;
    version: number;
  }>;
  text?: string;
  textKeyInfo?: string;
  textIV?: string;
  conversationId: number;
  receiverId?: number;
  parentMessageId?: number;
}) {
  const url = `${API_BASE_URL}/api/EncryptedMessage/upload-encrypted-json`;
  return await postRequest(url, request);
}