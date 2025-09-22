// hooks/crypto/useBackgroundImageDecryption.ts
import { useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { backgroundDecryptionManager } from '../BackgroundDecryptionManager';
import { AttachmentDto } from '@shared/types/MessageDTO';

export const useBackgroundImageDecryption = () => {
  const { 
    conversations, 
    unreadConversationIds, 
    liveMessages,
    cachedMessages 
  } = useChatStore();

  const startBackgroundDecryption = useCallback(async () => {
    console.log('🖼️ Starting background image decryption for unread conversations...');
    
    try {
      // Get unread conversations
      const unreadConversations = conversations.filter(conv => 
        unreadConversationIds.includes(conv.id)
      );
      
      console.log(`🖼️ Found ${unreadConversations.length} unread conversations`);
      
      let totalImagesQueued = 0;
      
      for (const conversation of unreadConversations) {
        // Get messages for this conversation from both live and cached
        const conversationMessages = [
          ...(liveMessages[conversation.id] || []),
          ...(cachedMessages[conversation.id] || [])
        ];
        
        // Remove duplicates based on message ID
        const uniqueMessages = conversationMessages.filter((message, index, arr) => 
          arr.findIndex(m => m.id === message.id) === index
        );
        
        // Extract image attachments that need decryption
        const imageAttachments: AttachmentDto[] = [];
        
        uniqueMessages.forEach(message => {
          if (message.attachments && !message.isDeleted) {
            message.attachments.forEach(attachment => {
              // Only queue images that need decryption and aren't optimistic
              if (attachment.needsDecryption && 
                  attachment.fileType.startsWith('image/') &&
                  !attachment.isOptimistic) {
                imageAttachments.push(attachment);
              }
            });
          }
        });
        
        if (imageAttachments.length > 0) {
          console.log(`🖼️ Queueing ${imageAttachments.length} images from conversation ${conversation.id}`);
          
          // Add to background queue with low priority
          await backgroundDecryptionManager.addConversationAttachments(
            imageAttachments,
            conversation.id,
            'low', // Low priority so it doesn't interfere with user actions
            false  // Don't include videos
          );
          
          totalImagesQueued += imageAttachments.length;
        }
      }
      
      console.log(`🖼️ ✅ Queued ${totalImagesQueued} images for background decryption across ${unreadConversations.length} unread conversations`);
      
      return {
        success: true,
        totalImagesQueued,
        conversationsProcessed: unreadConversations.length
      };
      
    } catch (error) {
      console.error('🖼️ ❌ Failed to start background image decryption:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalImagesQueued: 0,
        conversationsProcessed: 0
      };
    }
  }, [conversations, unreadConversationIds, liveMessages, cachedMessages]);

  const startBackgroundDecryptionForConversation = useCallback(async (conversationId: number) => {
    console.log(`🖼️ Starting background decryption for conversation ${conversationId}`);
    
    try {
      const conversationMessages = [
        ...(liveMessages[conversationId] || []),
        ...(cachedMessages[conversationId] || [])
      ];
      
      const uniqueMessages = conversationMessages.filter((message, index, arr) => 
        arr.findIndex(m => m.id === message.id) === index
      );
      
      const imageAttachments: AttachmentDto[] = [];
      
      uniqueMessages.forEach(message => {
        if (message.attachments && !message.isDeleted) {
          message.attachments.forEach(attachment => {
            if (attachment.needsDecryption && 
                attachment.fileType.startsWith('image/') &&
                !attachment.isOptimistic) {
              imageAttachments.push(attachment);
            }
          });
        }
      });
      
      if (imageAttachments.length > 0) {
        await backgroundDecryptionManager.addConversationAttachments(
          imageAttachments,
          conversationId,
          'normal', // Normal priority for single conversation
          false
        );
        
        console.log(`🖼️ ✅ Queued ${imageAttachments.length} images for conversation ${conversationId}`);
      }
      
      return imageAttachments.length;
      
    } catch (error) {
      console.error(`🖼️ ❌ Failed to queue images for conversation ${conversationId}:`, error);
      return 0;
    }
  }, [liveMessages, cachedMessages]);

  return {
    startBackgroundDecryption,
    startBackgroundDecryptionForConversation
  };
};