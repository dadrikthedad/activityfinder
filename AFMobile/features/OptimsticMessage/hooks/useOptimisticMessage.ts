// Forenklet useOptimisticMessage.ts
import { MessageDTO, AttachmentDto } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { RNFile } from '@/utils/files/FileFunctions';
import { useChatStore } from '@/store/useChatStore';
import { GeneratedThumbnail } from '@/features/cryptoAttachments/hooks/useThumbnailGenerator';

interface CreateOptimisticMessageOptions {
  text?: string | null;
  files?: RNFile[];
  conversationId: number;
  user: UserSummaryDTO;
  parentMessageId?: number | null;
  thumbnails?: Map<string, GeneratedThumbnail>; // Pre-generated thumbnails
}

export function useOptimisticMessage() {
  const createOptimisticMessage = (options: CreateOptimisticMessageOptions): MessageDTO => {
    const { text, files, conversationId, user, parentMessageId, thumbnails } = options;
    
    const optimisticId = `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let optimisticAttachments: AttachmentDto[] = [];
    
    if (files && files.length > 0) {
      optimisticAttachments = files.map((file, index) => {
        const attachmentOptimisticId = `attachment_${Date.now()}_${index}`;
        
        // Get pre-generated thumbnail if available
        const thumbnail = thumbnails?.get(file.uri);
        
        return {
          optimisticId: attachmentOptimisticId,
          fileUrl: file.uri,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size || 0,
          isOptimistic: true,
          isUploading: true,
          uploadError: null,
          localUri: file.uri,
          localThumbnailUri: thumbnail?.uri,
          thumbnailUrl: thumbnail?.uri,
          thumbnailWidth: thumbnail?.width,
          thumbnailHeight: thumbnail?.height,
        };
      });
    }

    const optimisticMessage: MessageDTO = {
      id: Date.now(),
      optimisticId,
      senderId: user.id,
      text: text ?? null,
      sentAt: new Date().toISOString(),
      conversationId,
      attachments: optimisticAttachments,
      reactions: [],
      parentMessageId,
      parentMessageText: null,
      parentSender: null,
      sender: user,
      isSystemMessage: false,
      isDeleted: false,
      isOptimistic: true,
      isSending: true,
      sendError: null,
    };

    return optimisticMessage;
  };

  const addOptimisticMessage = (options: CreateOptimisticMessageOptions): MessageDTO => {
    const message = createOptimisticMessage(options);
    const store = useChatStore.getState();
    store.addMessageOptimistic(message);
    return message;
  };

  return {
    createOptimisticMessage,
    addOptimisticMessage
  };
}