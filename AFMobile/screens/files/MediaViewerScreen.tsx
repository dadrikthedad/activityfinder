// screens/MediaViewerScreen.tsx - Updated with global store
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MediaViewerScreenRouteProp, MediaViewerScreenNavigationProp } from '@/types/navigation';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { canPreviewFile, shareRNFile } from '@/components/files/FileHandlerNative';
import { useDownload } from '@/hooks/files/useDownload';
import { VideoViewerContent } from '@/components/files/VideoViewerNative';
import DownloadProgressModal from '@/components/files/DownloadProgressModal';
import { StatusBar } from 'react-native';
import { ImageViewerContent } from '@/components/files/ImageViewerNative';
import { DocumentViewerContent } from '@/components/files/DocumentViewerNative';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';
import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';


export default function MediaViewerScreen() {
  const navigation = useNavigation<MediaViewerScreenNavigationProp>();
  const route = useRoute<MediaViewerScreenRouteProp>();
  
  const { files, initialIndex, viewerOptions } = route.params;
  
  // Use global store instead of useLazyFileDecryption
  const decryptedUrl = useDecryptionStore(state => {
  if (!viewerOptions?.decryptingFileUrl) return null;
  
  const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
  return state.getDecryptedUrl(cacheKey);
});

const isDecrypting = useDecryptionStore(state => {
  if (!viewerOptions?.decryptingFileUrl) return false;
  
  const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
  return state.isDecrypting(cacheKey);
});

const decryptionError = useDecryptionStore(state => {
  if (!viewerOptions?.decryptingFileUrl) return null;
  
  const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
  return state.getError(cacheKey);
});

const decryptionProgress = useDecryptionStore(state => {
  if (!viewerOptions?.decryptingFileUrl) return 0;
  
  const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
  return state.getProgress(cacheKey);
});

const decryptionStatus = useDecryptionStore(state => {
  if (!viewerOptions?.decryptingFileUrl) return 'Preparing...';
  
  const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
  return state.getStatus(cacheKey);
});
  
  // State for tracking resolved files
  const [resolvedFiles, setResolvedFiles] = useState<RNFile[]>(files);
  const [hasResolvedFile, setHasResolvedFile] = useState(false);
  
  // Download hook
  const { 
    showProgress, 
    progress, 
    fileName, 
    downloadFile, 
    cancelDownload 
  } = useDownload();

  // Monitor decryption state changes from store
  useEffect(() => {
  if (viewerOptions?.isDecrypting && viewerOptions?.decryptingFileUrl) {
    console.log(`🔐 MediaViewer DEBUG:`, {
      decryptingFileUrl: viewerOptions.decryptingFileUrl,
      isDecrypting,
      decryptedUrl,
      hasDecryptedUrl: !!decryptedUrl,
      storeState: useDecryptionStore.getState().decryptionStates.get(viewerOptions.decryptingFileUrl)
    });

      if (decryptedUrl && !hasResolvedFile) {
        console.log('🔐 MediaViewer: Updating resolved files with decrypted URL');
        setResolvedFiles(prevFiles => 
          prevFiles.map((file, index) => {
            if (index === initialIndex) {
              console.log(`🔐 Updating file ${index}:`, {
                from: file.uri.substring(0, 50) + '...',
                to: decryptedUrl.substring(0, 50) + '...'
              });
              return { ...file, uri: decryptedUrl };
            }
            return file;
          })
        );
        setHasResolvedFile(true);
      } else if (decryptionError && !hasResolvedFile) {
        Alert.alert(
          'Decryption Failed',
          `Could not decrypt ${viewerOptions.decryptingFileName || 'file'}: ${decryptionError}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setHasResolvedFile(true); // Prevent multiple alerts
      }
    }
  }, [
    viewerOptions?.isDecrypting,
    viewerOptions?.decryptingFileUrl,
    viewerOptions?.decryptingFileName,
    decryptedUrl,
    decryptionError,
    isDecrypting,
    decryptionProgress,
    hasResolvedFile,
    initialIndex,
    navigation
  ]);

  // Handle close - navigate back
  const handleClose = async () => {
    navigation.goBack();
  };

  // Handle download
  const handleDownload = async (file: RNFile) => {
    const result = await downloadFile(file.uri, file.name);
    if (result) {
      console.log('Downloaded to:', result);
    }
  };

  // Handle share
  const handleShare = async (file: RNFile) => {
    try {
      await shareRNFile(file);
    } catch (error) {
      console.error('Deling feilet:', error);
      Alert.alert('Feil', 'Kunne ikke dele filen');
    }
  };

  // Show loading screen while decryption is in progress
  if (viewerOptions?.isDecrypting && isDecrypting && !decryptedUrl) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor="black" barStyle="light-content" />
        <ActivityIndicator size="large" color="#1C6B1C" />
        <Text style={styles.loadingText}>
          {viewerOptions?.decryptingFileName 
            ? `${decryptionStatus} ${viewerOptions.decryptingFileName}...` 
            : decryptionStatus
          }
        </Text>
        <Text style={styles.progressText}>{decryptionProgress}%</Text>
        
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${decryptionProgress}%` }
              ]}
            />
          </View>
        </View>
        
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  // Get current file based on initialIndex (now using resolved files)
  const currentFile = resolvedFiles[initialIndex];
  
  if (!currentFile) {
    handleClose();
    return null;
  }

  const fileInfo = getFileTypeInfo(currentFile.type, currentFile.name);
  const isPreviewable = canPreviewFile(currentFile);

  // For images - use ImageViewerNative
  if (isPreviewable && fileInfo.category === 'image') {
    const imageFiles = resolvedFiles.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'image'
    );
    
    const imageIndex = imageFiles.findIndex(f => f.uri === currentFile.uri);
    
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="black" barStyle="dark-content" translucent={true} />
        <ImageViewerContent
          images={imageFiles}
          initialIndex={Math.max(0, imageIndex)}
          onClose={handleClose}
          onDownload={viewerOptions?.showDownload !== false ? handleDownload : undefined}
          onShare={viewerOptions?.showShare !== false ? handleShare : undefined}
          useModal={false}
        />
        
        <DownloadProgressModal
          visible={showProgress}                       
          fileName={fileName || ''}                           
          progress={progress?.progress || 0}                    
          totalBytes={progress?.totalBytesExpectedToWrite}       
          downloadedBytes={progress?.totalBytesWritten} 
          onCancel={cancelDownload}
        />
      </View>
    );
  }

  // For videos - use VideoViewerNative
  if (isPreviewable && fileInfo.category === 'video') {
    const videoFiles = resolvedFiles.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'video'
    );
    
    const videoIndex = videoFiles.findIndex(f => f.uri === currentFile.uri);
    
    console.log(`🎬 Rendering VideoViewerContent with decrypted URI:`, {
      fileName: currentFile.name,
      originalUri: files[initialIndex].uri,
      decryptedUri: currentFile.uri,
      hasDecryptedUrl: !!decryptedUrl
    });
    
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="black" barStyle="light-content" translucent={true}/>
        <VideoViewerContent
          videos={videoFiles}
          initialIndex={Math.max(0, videoIndex)}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
          useModal={false}
        />
        
        <DownloadProgressModal
          visible={showProgress}                       
          fileName={fileName || ''}                           
          progress={progress?.progress || 0}                    
          totalBytes={progress?.totalBytesExpectedToWrite}       
          downloadedBytes={progress?.totalBytesWritten} 
          onCancel={cancelDownload}
        />
      </View>
    );
  }

  // For all other file types - use DocumentViewerNative
  return (
    <>
      <StatusBar backgroundColor="white" barStyle="dark-content"/>
      <DocumentViewerContent
        file={currentFile}
        onClose={handleClose}
        onShare={handleShare}
        onDownload={handleDownload}
        useModal={false}
      />
      
      <DownloadProgressModal
        visible={showProgress}                       
        fileName={fileName || ''}                           
        progress={progress?.progress || 0}                    
        totalBytes={progress?.totalBytesExpectedToWrite}       
        downloadedBytes={progress?.totalBytesWritten} 
        onCancel={cancelDownload}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  progressText: {
    color: '#1C6B1C',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '80%',
    marginTop: 16,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1C6B1C',
    borderRadius: 2,
  },
  loadingSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});