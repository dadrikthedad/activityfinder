import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { showNotificationToastNative } from '@/components/toast/NotificationToastNative';
import { LocalToastType } from '@/components/toast/NotificationToastNative';

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-1
}

interface UseDownloadReturn {
  // State
  isDownloading: boolean;
  showProgress: boolean;
  progress: DownloadProgress | null;
  fileName: string | null;
  
  // Actions
  downloadFile: (url: string, fileName: string, showProgressModal?: boolean) => Promise<string | null>;
  cancelDownload: () => void;
}

export const useDownload = (): UseDownloadReturn => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  
  // Refs for immediate access
  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);
  const isCancelledRef = useRef(false);

  const cancelDownload = useCallback(async () => {
    console.log('🔴 Cancel download requested');
    
    // Set cancelled flags immediately
    isCancelledRef.current = true;
    setIsCancelled(true);
    
    // Hide progress immediately
    setShowProgress(false);
    setProgress(null);
    setFileName(null);
    setIsDownloading(false);
    
    // Pause the actual download
    if (downloadResumableRef.current) {
      try {
        console.log('🔴 Attempting to cancel download...');
        await downloadResumableRef.current.cancelAsync();
        console.log('🔴 Download cancelled successfully');
      } catch (error) {
        console.log('🔴 Download cancel error (expected):', error);
        // Try pause as fallback
        try {
          await downloadResumableRef.current.pauseAsync();
          console.log('🔴 Download paused as fallback');
        } catch (pauseError) {
          console.log('🔴 Download pause also failed:', pauseError);
        }
      }
    }
    
    // Clean up refs
    downloadResumableRef.current = null;
    
    console.log('🔴 Download cancelled and UI cleaned up');
  }, []);

  const downloadFile = useCallback(async (
    url: string, 
    fileName: string, 
    showProgressModal?: boolean
  ): Promise<string | null> => {
    try {
      console.log(`📥 Starting download: ${fileName}`);
      
      // Reset state for new download
      isCancelledRef.current = false;
      setIsCancelled(false);
      setIsDownloading(true);
      setFileName(fileName);
      
      const downloadPath = `${FileSystem.documentDirectory}${fileName}`;
      
      // Determine if we should show progress
      const shouldShowProgressModal = showProgressModal !== undefined 
        ? showProgressModal 
        : await shouldShowProgress(url, fileName);

      if (shouldShowProgressModal) {
        // Show progress for larger files
        setShowProgress(true);
        setProgress({ totalBytesWritten: 0, totalBytesExpectedToWrite: 0, progress: 0 });
        
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          downloadPath,
          {},
          (downloadProgress) => {
            // Only update if not cancelled
            if (!isCancelledRef.current && !isCancelled) {
              const progressValue = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
              
              console.log(`📊 Progress: ${Math.round(progressValue * 100)}%`);
              
              setProgress({
                totalBytesWritten: downloadProgress.totalBytesWritten,
                totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
                progress: progressValue
              });
            }
          }
        );

        // Store reference for cancellation
        downloadResumableRef.current = downloadResumable;

        const result = await downloadResumable.downloadAsync();
        
        // Check if cancelled during download
        if (isCancelledRef.current) {
          console.log('📋 Download was cancelled during process');
          return null;
        }
        
        if (!result) {
          console.log('📋 Download returned null - likely cancelled');
          return null;
        }

        const { uri } = result;
        console.log(`✅ Download completed: ${uri}`);
        
        // Show success state briefly
        setTimeout(() => {
          setShowProgress(false);
          setProgress(null);
          setFileName(null);
          setIsDownloading(false);
        }, 1500);
        
        return uri;
      } else {
        // Quick download for smaller files
        const { uri } = await FileSystem.downloadAsync(url, downloadPath);
        console.log(`✅ Quick download completed: ${uri}`);
        
        setIsDownloading(false);
        setFileName(null);
        
        // Show toast notification
        showNotificationToastNative({
          type: LocalToastType.FileDownloaded,
          messagePreview: fileName,
          senderProfileImage: undefined,
          position: 'bottom',
          offset: 300,
        });
        
        return uri;
      }

    } catch (error: any) {
      console.log('Download error:', error?.message);
      
      // Clean up state
      setShowProgress(false);
      setProgress(null);
      setFileName(null);
      setIsDownloading(false);
      downloadResumableRef.current = null;
      
      // Check if this was a cancellation
      if (isCancelledRef.current) {
        console.log('📋 Download cancelled by user');
        isCancelledRef.current = false;
        return null;
      }
      
      // Check error message for cancellation indicators
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('cancel') || errorMessage.includes('abort') || errorMessage.includes('pause')) {
        console.log('📋 Download cancelled via error message');
        isCancelledRef.current = false;
        return null;
      }
      
      // Show error for actual failures
      console.error('❌ Download failed:', error);
      Alert.alert('Feil', 'Kunne ikke laste ned filen');
      
      return null; // Return null instead of throwing for better error handling
    }
  }, []);

  return {
    isDownloading,
    showProgress,
    progress,
    fileName,
    downloadFile,
    cancelDownload
  };
};

// Helper functions (keep your existing ones)
const shouldShowProgress = async (url: string, fileName?: string): Promise<boolean> => {
  const largeFileExtensions = ['.zip', '.rar', '.tar', '.gz', '.7z', '.mov', '.avi', '.mkv', '.mp4', '.mp3', '.wav', '.flac', '.iso', '.dmg', '.exe', '.msi'];
  const fileExtension = fileName ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
  
  if (largeFileExtensions.includes(fileExtension)) {
    return true;
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    const estimatedSize = contentLength ? parseInt(contentLength, 10) : 0;
    return estimatedSize > 5 * 1024 * 1024; // 5MB
  } catch {
    return false;
  }
};