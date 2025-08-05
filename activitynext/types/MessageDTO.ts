// interface til en melding for å matche DTO fra backend. Inneholder AttachmentDTO, ReactionDTO, MessageDTO og SendMessageRequestDTO
import { UserSummaryDTO } from "./UserSummaryDTO";

export interface AttachmentDto {
  fileUrl: string;
  fileType: string;
  fileName: string;
}

export interface ReactionDTO {
  messageId: number;
  emoji: string;
  userId: number;
  isRemoved: boolean;
  userFullName?: string;
  conversationId: number; 
}

export interface MessageDTO {
  id: number;
  senderId: number | null;
  text: string | null;
  sentAt: string; // ISO-dato som kommer fra backend
  conversationId: number;
  attachments: AttachmentDto[];
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

  // Optimistic fields - frontend only
  isOptimistic?: boolean;
  optimisticId?: string; // Temporary ID før vi får riktig ID fra backend
  isSending?: boolean;
  sendError?: string | null;
}


export interface SendMessageRequestDTO {
  text?: string;
  attachments?: AttachmentDto[];
  conversationId?: number;
  receiverId?: string;
  parentMessageId?: number | null;
}

export interface UploadAttachmentsRequestDTO {
  text?: string;
  files: File[];
  conversationId: number;
  receiverId?: string;
  parentMessageId?: number | null;
}

// Hjelpetype for å bygge FormData
export interface MessageWithFilesData {
  text?: string;
  files?: File[];
  conversationId: number;
  receiverId?: string;
  parentMessageId?: number | null;
}
