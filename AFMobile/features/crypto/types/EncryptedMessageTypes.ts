import { ReactionDTO, AttachmentDto } from "@shared/types/MessageDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

export interface EncryptedAttachmentDto {
  encryptedFileUrl: string;
  fileType: string;
  fileName: string;
  fileSize?: number;
  keyInfo: { [userId: string]: string }; // encrypted symmetric key for each recipient
  iv: string; // REQUIRED for AES-GCM decryption
  version: number; // REQUIRED for versioning

  // Thumbnail fields
  encryptedThumbnailUrl?: string;
  thumbnailKeyInfo?: { [userId: string]: string } | null;
  thumbnailIV?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  encryptedThumbnailData?: string; // Base64 encrypted thumbnail
  
  // Original fields for compatibility
  isOptimistic?: boolean;
  optimisticId?: string;
  localUri?: string;
  isUploading?: boolean;
  uploadError?: string | null;
}

export interface EncryptedMessageDTO {
  id: number;
  senderId: number | null;
 
  // Encrypted content
  encryptedText: string | null;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
 
  sentAt: string;
  conversationId: number;
 
  // Encrypted attachments
  encryptedAttachments: EncryptedAttachmentDto[];
 
  reactions: ReactionDTO[];
 
  // Reply metadata
  parentMessageId?: number | null;
  parentMessagePreview?: string | null; // Dette er det backend kaller ParentMessagePreview
  parentSender?: UserSummaryDTO | null;
 
  // System flags - disse må være non-optional for å matche backend
  isRejectedRequest?: boolean;
  sender?: UserSummaryDTO | null;
  isNowApproved?: boolean;
  isSilent?: boolean;
  isSystemMessage: boolean; // Backend sender denne som required
  isDeleted: boolean; // Backend sender denne som required (ikke optional)
 
  // Client-side decryption status
  isDecrypted?: boolean;
  decryptionError?: string | null;
 
  // Optimistic fields - frontend only
  isOptimistic?: boolean;
  optimisticId?: string;
  isSending?: boolean;
  sendError?: string | null;
}

// Decrypted message for local use
export interface DecryptedMessageDTO {
  id: number;
  senderId: number | null;
  text: string | null;
  sentAt: string;
  conversationId: number;
  attachments: AttachmentDto[]; // Decrypted attachments
  reactions: ReactionDTO[];
  parentMessageId?: number | null;
  parentMessageText?: string | null;
  parentSender?: UserSummaryDTO | null;
  isRejectedRequest?: boolean;
  sender?: UserSummaryDTO | null;
  isNowApproved?: boolean;
  isSilent?: boolean;
  isSystemMessage: boolean;
  isDeleted?: boolean;
 
  // Client-side fields
  isDecrypted: true;
  isOptimistic?: boolean;
  optimisticId?: string;
  isSending?: boolean;
  sendError?: string | null;
}

export interface SendEncryptedMessageRequestDTO {
  // At least one of encryptedText or encryptedAttachments must be present
  encryptedText: string | null; // null for attachment-only messages
  keyInfo: { [userId: string]: string }; // encrypted symmetric key for each recipient
  iv: string; // initialization vector for AES-GCM
  version: number; // encryption version
  
  // Optional fields
  encryptedAttachments?: EncryptedAttachmentDto[];
  conversationId?: number;
  receiverId?: string;
  parentMessageId?: number | null;
  parentMessagePreview?: string | null; // Unencrypted parent preview for threading UX
}

// User's public key info
export interface UserPublicKeyDTO {
  userId: number;
  publicKey: string;
  keyVersion: number; // For key rotation
  createdAt: string;
}

// Conversation key exchange info for groups
export interface ConversationKeyDTO {
  conversationId: number;
  participantKeys: UserPublicKeyDTO[];
  keyRotationVersion: number;
}