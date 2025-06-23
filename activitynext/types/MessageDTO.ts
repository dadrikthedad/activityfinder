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
  senderId: number;
  text: string | null;
  sentAt: string; // ISO-dato som kommer fra backend
  conversationId: number;
  attachments: AttachmentDto[];
  reactions: ReactionDTO[];
  parentMessageId?: number | null;
  parentMessageText?: string | null;
  isRejectedRequest?: boolean;
  sender?: UserSummaryDTO;
  isNowApproved?: boolean;
  isSilent?: boolean;
}

export interface SendMessageRequestDTO {
  text?: string;
  attachments?: {
    fileUrl: string;
    fileType: string;
    fileName: string;
  }[];
  conversationId?: number;
  receiverId?: string;
  parentMessageId?: number | null;
}
