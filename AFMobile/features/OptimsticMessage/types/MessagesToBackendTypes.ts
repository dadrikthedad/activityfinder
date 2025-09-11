// Opprett typer som matcher backend DTOs
export interface SendEncryptedMessageWithFilesRequestDTO {
  encryptedFilesData: EncryptedFileDataRequestDto[];
  text?: string;
  textKeyInfo?: string;
  textIV?: string;
  conversationId: number;
  receiverId?: number;
  parentMessageId?: number;
}


export interface EncryptedFileDataRequestDto {
  fileName: string;
  fileType: string;
  fileSize: number;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
  encryptedFileData: string; // Base64
  // Thumbnail felter
  thumbnailKeyInfo?: { [userId: string]: string };
  thumbnailIV?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  encryptedThumbnailData?: string;
  // For mapping
  optimisticId?: string; // Endret fra number til string
}

export interface SendEncryptedMessageResponseDTO {
  messageId: number;
  sentAt: string;
  conversationId: number;
  attachments?: AttachmentResponseDto[];
}

export interface AttachmentResponseDto {
  id: number;
  optimisticId: string;
  fileUrl: string;
  thumbnailUrl?: string;
}