// types/EncryptedMessageDTO.ts - Fixed consistent version
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { ReactionDTO } from "@shared/types/MessageDTO";
import { AttachmentDto } from "@shared/types/MessageDTO";

export interface EncryptedAttachmentDto {
  encryptedFileUrl: string;
  fileType: string;
  fileName: string;
  fileSize?: number;
  keyInfo: { [userId: string]: string }; // encrypted symmetric key for each recipient
  iv: string; // REQUIRED for AES-GCM decryption
  version: number; // REQUIRED for versioning
  
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

// Type guards for runtime validation
export const isValidEncryptedMessage = (obj: any): obj is EncryptedMessageDTO => {
  if (!obj || typeof obj !== 'object') return false;
  
  // Basic required fields
  if (typeof obj.id !== 'number') return false;
  if (!obj.keyInfo || typeof obj.keyInfo !== 'object' || Object.keys(obj.keyInfo).length === 0) return false;
  if (typeof obj.iv !== 'string' || obj.iv.length === 0) return false;
  if (typeof obj.version !== 'number' || obj.version <= 0) return false;
  
  // At least one content type must be present
  const hasText = obj.encryptedText !== null && typeof obj.encryptedText === 'string' && obj.encryptedText.length > 0;
  const hasAttachments = Array.isArray(obj.encryptedAttachments) && obj.encryptedAttachments.length > 0;
  
  return hasText || hasAttachments;
};

export const isValidSendEncryptedMessageRequest = (obj: any): obj is SendEncryptedMessageRequestDTO => {
  if (!obj || typeof obj !== 'object') return false;
  
  // Basic required fields
  if (!obj.keyInfo || typeof obj.keyInfo !== 'object' || Object.keys(obj.keyInfo).length === 0) return false;
  if (typeof obj.iv !== 'string' || obj.iv.length === 0) return false;
  if (typeof obj.version !== 'number' || obj.version <= 0) return false;
  
  // At least one content type must be present
  const hasText = obj.encryptedText !== null && typeof obj.encryptedText === 'string' && obj.encryptedText.length > 0;
  const hasAttachments = Array.isArray(obj.encryptedAttachments) && obj.encryptedAttachments.length > 0;
  
  return hasText || hasAttachments;
};

// Utility type for handling both encrypted and regular messages
export type MessageUnion = EncryptedMessageDTO | DecryptedMessageDTO;

// Helper to check if message is encrypted
export const isEncryptedMessage = (message: MessageUnion): message is EncryptedMessageDTO => {
  return 'encryptedText' in message && !('isDecrypted' in message && message.isDecrypted === true);
};

// Helper to check if message is decrypted
export const isDecryptedMessage = (message: MessageUnion): message is DecryptedMessageDTO => {
  return 'isDecrypted' in message && message.isDecrypted === true;
};


export const createEmptyEncryptedMessage = (conversationId: number, senderId: number): Partial<EncryptedMessageDTO> => {
  return {
    conversationId,
    senderId,
    encryptedText: null,
    keyInfo: {},
    iv: '',
    version: 1,
    encryptedAttachments: [],
    reactions: [],
    isSystemMessage: false,
    isDeleted: false,
    sentAt: new Date().toISOString()
  };
};