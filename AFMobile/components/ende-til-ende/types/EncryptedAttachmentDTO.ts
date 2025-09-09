// Interfaces for encrypted attachments
export interface EncryptedAttachmentDto {
  encryptedFileUrl: string;
  fileType: string;
  fileName: string;
  fileSize?: number;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
}

export interface UploadEncryptedAttachmentsRequest {
  encryptedFiles: File[];
  attachmentMetadata: EncryptedAttachmentDto[];
  text?: string;
  textKeyInfo?: string;
  textIV?: string;
  conversationId?: number;
  receiverId?: number;
  parentMessageId?: number;
}

export interface UploadEncryptedAttachmentsResponse {
  attachmentResults: EncryptedAttachmentDto[];
  success: boolean;
  errorMessage?: string;
}