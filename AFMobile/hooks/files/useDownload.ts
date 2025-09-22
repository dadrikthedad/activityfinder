import { useState, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
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

// Helper function to determine if file is media
const isMediaFile = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'mkv', '3gp', 'm4v'];
  return mediaExtensions.includes(extension);
};

// Helper function to get MIME type
const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: { [key: string]: string } = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg', 
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    
    // Videos
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    
    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    
    // Default
    '': 'application/octet-stream'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

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

  // Save media file using MediaLibrary
  const saveMediaFile = useCallback(async (fileUri: string, fileName: string): Promise<boolean> => {
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Cannot save file without media library permission');
        return false;
      }

      // Create asset from the file
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      
      // Try to add to Downloads album, create if it doesn't exist
      try {
        let album = await MediaLibrary.getAlbumAsync('Downloads');
        if (album === null) {
          album = await MediaLibrary.createAlbumAsync('Downloads', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch (albumError) {
        console.log('Album operation failed, but asset was created:', albumError);
        // Asset is still saved to library even if album operations fail
      }

      return true;
    } catch (error) {
      console.error('Error saving media file:', error);
      return false;
    }
  }, []);

  // Save document file using StorageAccessFramework
  const saveDocumentFile = useCallback(async (fileUri: string, fileName: string): Promise<boolean> => {
    try {
      // Request directory permissions - user chooses where to save
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (!permissions.granted) {
        // User cancelled the dialog
        return false;
      }

      // Read the file data
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Get MIME type for the file
      const mimeType = getMimeType(fileName);

      // Create the file in user's chosen directory
      const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        mimeType
      );

      // Write the data to the new file
      await FileSystem.writeAsStringAsync(newFileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64
      });

      return true;
    } catch (error) {
      console.error('Error saving document file:', error);
      return false;
    }
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
      
      let tempFileUri: string;

      // Check if file is already local (decrypted)
      if (url.startsWith('/') || url.startsWith('file://')) {
        console.log('File is already local, checking storage locations...');
        console.log('Original file path:', url);
        
        let sourceFile = url;
        let fileExists = false;
        
        // Check if the original path exists
        try {
          const fileInfo = await FileSystem.getInfoAsync(url);
          if (fileInfo.exists) {
            console.log('Found file at original path');
            fileExists = true;
          }
        } catch (error) {
          console.log('File not found at original path, checking alternatives...');
        }
        
        // If not found, try to find it in alternative locations
        if (!fileExists) {
          try {
            const actualFileName = url.split('/').pop() || fileName;
            
            const possiblePaths = [
              `${FileSystem.cacheDirectory}decrypted_attachments/${actualFileName}`,
              `${FileSystem.cacheDirectory}temp_attachments/${actualFileName}`,
              url.replace('/cache/', '/temp/'),
              url.replace('/temp/', '/cache/')
            ];
            
            for (const path of possiblePaths) {
              try {
                const pathInfo = await FileSystem.getInfoAsync(path);
                if (pathInfo.exists) {
                  console.log('Found file at alternative path:', path);
                  sourceFile = path;
                  fileExists = true;
                  break;
                }
              } catch {
                // Continue searching
              }
            }
            
          } catch (error) {
            console.log('Error searching alternative paths:', error);
          }
        }
        
        if (!fileExists) {
          throw new Error(`Cannot find source file. Original path: ${url}`);
        }
        
        tempFileUri = sourceFile;
      } else {
        // Download from URL to temporary location first
        const downloadPath = `${FileSystem.cacheDirectory}${Date.now()}_${fileName}`;
        
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

          downloadResumableRef.current = downloadResumable;

          const result = await downloadResumable.downloadAsync();
          
          if (isCancelledRef.current) {
            console.log('📋 Download was cancelled during process');
            return null;
          }
          
          if (!result) {
            console.log('📋 Download returned null - likely cancelled');
            return null;
          }

          tempFileUri = result.uri;
        } else {
          // Quick download for smaller files
          const { uri } = await FileSystem.downloadAsync(url, downloadPath);
          tempFileUri = uri;
        }

        console.log(`✅ Download completed to temp location: ${tempFileUri}`);
      }

      // Now save the file to the appropriate location based on type
      let saveSuccess = false;
      const isMedia = isMediaFile(fileName);

      if (Platform.OS === 'android') {
        if (isMedia) {
          console.log('Saving media file to gallery...');
          saveSuccess = await saveMediaFile(tempFileUri, fileName);
        } else {
          console.log('Saving document file with user selection...');
          saveSuccess = await saveDocumentFile(tempFileUri, fileName);
        }
      } else {
        // iOS - use MediaLibrary for media files, sharing for documents
        if (isMedia) {
          console.log('Saving media file to iOS Photos...');
          saveSuccess = await saveMediaFile(tempFileUri, fileName);
        } else {
          console.log('iOS document - using sharing instead of direct save');
          // For iOS documents, we could use expo-sharing here
          // For now, just notify that file is ready for sharing
          saveSuccess = true;
        }
      }

      // Clean up state
      setShowProgress(false);
      setProgress(null);
      setIsDownloading(false);
      setFileName(null);

      if (saveSuccess) {
        // Show success notification
        const messageText = isMedia 
          ? `${fileName} saved to gallery`
          : `${fileName} saved to downloads`;
          
        showNotificationToastNative({
          type: LocalToastType.FileDownloaded,
          messagePreview: messageText,
          senderProfileImage: undefined,
          position: 'bottom',
          offset: 300,
        });

        console.log(`✅ File saved successfully: ${fileName}`);
        return tempFileUri;
      } else {
        throw new Error('Failed to save file to device storage');
      }

    } catch (error: any) {
      console.log('Download/save error:', error?.message);
      
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
      console.error('❌ Download/save failed:', error);
      Alert.alert('Error', `Could not save file: ${error?.message || 'Unknown error'}`);
      
      return null;
    }
  }, [saveMediaFile, saveDocumentFile]);

  return {
    isDownloading,
    showProgress,
    progress,
    fileName,
    downloadFile,
    cancelDownload
  };
};

// Helper functions
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