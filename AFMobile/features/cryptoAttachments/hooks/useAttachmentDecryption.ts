import { useCallback } from 'react';
import { AttachmentDecryptionService } from '../services/AttachmentDecryptionService';
import { EncryptedAttachmentData, DecryptedAttachment } from '../types/cryptoAttachmentTypes';


export const useAttachmentDecryption = () => {
  const decryptAttachments = useCallback(async (
    encryptedAttachments: EncryptedAttachmentData[], 
    currentUserId: number
  ): Promise<DecryptedAttachment[]> => {
    const decryptionService = AttachmentDecryptionService.getInstance();
    return decryptionService.decryptAttachments(encryptedAttachments, currentUserId);
  }, []);

  const decryptSingleAttachment = useCallback(async (
    encryptedAttachment: EncryptedAttachmentData, 
    currentUserId: number
  ): Promise<DecryptedAttachment> => {
    const decryptionService = AttachmentDecryptionService.getInstance();
    return decryptionService.decryptAttachment(encryptedAttachment, currentUserId);
  }, []);

  return { 
    decryptAttachments,
    decryptSingleAttachment 
  };
};