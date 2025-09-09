// hooks/messages/useEncryptedAttachments.ts
import { useState } from 'react';
import { useE2EE } from '@/components/ende-til-ende/useE2EE';
import { uploadEncryptedAttachmentsJSON } from '@/services/crypto/encryptedMessageService';
import { ProcessedFile } from '../types/cryptoAttachmentTypes';
import { AttachmentEncryptionService } from '../services/AttachmentEncryptionService';

export const useEncryptedAttachments = () => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  
  const e2eeService = useE2EE();
  
  /**
   * Upload encrypted attachments using the new AttachmentEncryptionService
   */
  const uploadEncryptedAttachments = async (
    processedFiles: ProcessedFile[],
    conversationId: number,
    messageText?: string,
    receiverId?: number,
    parentMessageId?: number
  ) => {
    try {
      setIsEncrypting(true);
      setEncryptionProgress(0);
     
      console.log(`🔐 Starting hybrid encryption for ${processedFiles.length} files`);
      
      // Encrypt files using AttachmentEncryptionService directly (no e2eeService parameter)
      const encryptionService = AttachmentEncryptionService.getInstance();
      const encryptedResults = await encryptionService.encryptFiles(
        processedFiles,
        conversationId,
        {
          onProgress: (progress) => {
            // Reserve 50% of progress bar for encryption
            setEncryptionProgress(Math.round(progress * 0.5));
          },
          onFileProgress: (fileIndex, totalFiles, fileName) => {
            console.log(`🔐 Encrypting file ${fileIndex}/${totalFiles}: ${fileName}`);
          }
        }
      );
      
      // Encrypt message text if provided
      let encryptedText = null;
      if (messageText) {
        encryptedText = await e2eeService.encryptMessage(messageText, conversationId);
        if (!encryptedText) {
          throw new Error('Failed to encrypt message text');
        }
      }
      
      setEncryptionProgress(60);
      setIsEncrypting(false);
      setIsUploading(true);
      
      console.log(`🔐 Uploading ${encryptedResults.length} encrypted files to backend`);
      
      // Upload using JSON API
      const result = await uploadEncryptedAttachmentsJSON({
        encryptedFilesData: encryptedResults,
        text: encryptedText?.encryptedText ?? undefined,
        textKeyInfo: encryptedText ? JSON.stringify(encryptedText.keyInfo) : undefined,
        textIV: encryptedText?.iv ?? undefined,
        conversationId,
        receiverId,
        parentMessageId
      });
      
      setEncryptionProgress(100);
      console.log('🔐 ✅ Hybrid encrypted attachments uploaded successfully');
     
      return result;
    } catch (error) {
      console.error('🔐 ❌ Hybrid encrypted attachment upload failed:', error);
      throw error;
    } finally {
      setIsEncrypting(false);
      setIsUploading(false);
      setEncryptionProgress(0);
    }
  };
  
  return {
    uploadEncryptedAttachments,
    isEncrypting,
    isUploading,
    encryptionProgress,
  };
};