// hooks/useReportAttachments.ts
import { useState, useCallback } from 'react';
import { uploadReportAttachment, uploadMultipleReportAttachments } from '@/services/files/fileService';


// React Native file type
interface RNFile {
  uri: string;
  type: string;
  name: string;
}

interface UploadedAttachment {
  attachmentId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
}

interface UseReportAttachmentsReturn {
  // State
  isUploading: boolean;
  uploadProgress: number;
  uploadedAttachments: UploadedAttachment[];
  error: string | null;
  
  // Actions
  uploadSingleAttachment: (reportId: string, file: RNFile) => Promise<UploadedAttachment | null>;
  uploadMultipleAttachments: (reportId: string, files: RNFile[]) => Promise<UploadedAttachment[] | null>;
  clearError: () => void;
  clearAttachments: () => void;
}

export function useReportAttachments(): UseReportAttachmentsReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearAttachments = useCallback(() => {
    setUploadedAttachments([]);
    setUploadProgress(0);
  }, []);

  const uploadSingleAttachment = useCallback(async (
    reportId: string, 
    file: RNFile
  ): Promise<UploadedAttachment | null> => {
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      console.log(`🔍 Uploading single attachment: ${file.name}`);
      
      const result = await uploadReportAttachment(reportId, file);
      
      setUploadedAttachments(prev => [...prev, result]);
      setUploadProgress(100);
      
      console.log(`✅ Single attachment uploaded successfully: ${file.name}`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload attachment';
      setError(errorMessage);
      console.error(`❌ Failed to upload single attachment: ${file.name}`, err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadMultipleAttachments = useCallback(async (
    reportId: string, 
    files: RNFile[]
  ): Promise<UploadedAttachment[] | null> => {
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      console.log(`🔍 Uploading ${files.length} attachments`);

      const results = await uploadMultipleReportAttachments(
        reportId,
        files,
        (uploaded, total) => {
          const progress = (uploaded / total) * 100;
          setUploadProgress(progress);
          console.log(`📤 Upload progress: ${uploaded}/${total} (${progress.toFixed(1)}%)`);
        }
      );

      setUploadedAttachments(prev => [...prev, ...results]);
      setUploadProgress(100);
      
      console.log(`✅ All ${files.length} attachments uploaded successfully`);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload attachments';
      setError(errorMessage);
      console.error(`❌ Failed to upload multiple attachments`, err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    uploadedAttachments,
    error,
    
    // Actions
    uploadSingleAttachment,
    uploadMultipleAttachments,
    clearError,
    clearAttachments,
  };
}