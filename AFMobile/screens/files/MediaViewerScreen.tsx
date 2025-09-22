// screens/MediaViewerScreen.tsx - Optimalisert versjon som forhindrer re-renders
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, SafeAreaView, ActivityIndicator, Text, Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
  
  const { files, attachments, initialIndex, viewerOptions } = route.params;
  
  // STABIL dimensjonshåndtering - bruk useRef for å unngå re-renders
  const initialDimensions = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  }, []);
  
  const dimensionsRef = useRef(initialDimensions);
  const [dimensions, setDimensions] = useState(initialDimensions);
  
  // Stable threshold calculation
  const SWIPE_THRESHOLD = useMemo(() => dimensions.width * 0.25, [dimensions.width]);
  
  // Get decryption store methods
  const getDecryptedUrl = useDecryptionStore(state => state.getDecryptedUrl);
  const isDecrypting = useDecryptionStore(state => state.isDecrypting);
  const getError = useDecryptionStore(state => state.getError);
  const getProgress = useDecryptionStore(state => state.getProgress);
  const getStatus = useDecryptionStore(state => state.getStatus);
  
  // State for tracking resolved files and current index
  const [resolvedFiles, setResolvedFiles] = useState<RNFile[]>(files);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isResolving, setIsResolving] = useState(true);
  
  // Download hook
  const { 
    showProgress, 
    progress, 
    fileName, 
    downloadFile, 
    cancelDownload 
  } = useDownload();

  // Stable navigation handler
  const handleNavigateToFile = useCallback((direction: 'next' | 'prev') => {
    if (resolvedFiles.length <= 1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % resolvedFiles.length;
    } else {
      newIndex = (currentIndex - 1 + resolvedFiles.length) % resolvedFiles.length;
    }
    
    console.log(`🔄 SWIPE: Navigating from ${currentIndex} to ${newIndex}`);
    setCurrentIndex(newIndex);
  }, [currentIndex, resolvedFiles.length]);

  // OPTIMALISERT orientasjonshåndtering
  useEffect(() => {
    // Unlock orientation when screen opens
    ScreenOrientation.unlockAsync();

    // Stable dimension change handler
    const handleDimensionChange = ({ window }: { window: { width: number; height: number } }) => {
      const newDimensions = { width: window.width, height: window.height };
      
      // Bare oppdater hvis det faktisk er en endring
      setDimensions(prevDimensions => {
        if (prevDimensions.width !== newDimensions.width || 
            prevDimensions.height !== newDimensions.height) {
          console.log('📱 DIMENSION CHANGE:', newDimensions);
          dimensionsRef.current = newDimensions;
          return newDimensions;
        }
        return prevDimensions;
      });
    };

    const subscription = Dimensions.addEventListener('change', handleDimensionChange);

    // Lock orientation back to portrait when screen closes
    return () => {
      subscription?.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch(error => console.warn('Failed to lock orientation on cleanup:', error));
    };
  }, []);

  // OPTIMALISERT swipe gesture - oppdateres bare når nødvendig
  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(20)
      .activeOffsetX([-20, 20])
      .failOffsetY([-50, 50])
      .onEnd((event) => {
        'worklet';
        
        const hasMultipleFiles = resolvedFiles.length > 1;
        if (!hasMultipleFiles) return;
        
        const { translationX, velocityX } = event;
        const isSignificantSwipe = Math.abs(translationX) > SWIPE_THRESHOLD || Math.abs(velocityX) > 500;
        
        if (isSignificantSwipe) {
          if (translationX > 0) {
            runOnJS(handleNavigateToFile)('prev');
          } else {
            runOnJS(handleNavigateToFile)('next');
          }
        }
      });
  }, [handleNavigateToFile, resolvedFiles.length, SWIPE_THRESHOLD]);

  const resolveAllFilesAsync = useCallback(async () => {
    setIsResolving(true);
    
    const resolved = await Promise.all(
      files.map(async (file, index) => {
        const attachment = attachments?.[index];
        
        if (attachment?.needsDecryption && attachment?.fileUrl) {
          const cacheKey = generateCacheKey(attachment.fileUrl);
          
          const decryptedUrl = getDecryptedUrl(cacheKey);
          if (decryptedUrl) {
            try {
              const { default: FileSystem } = await import('expo-file-system');
              const fileInfo = await FileSystem.getInfoAsync(decryptedUrl);
              if (fileInfo.exists) {
                console.log(`✅ RESOLVE: Using decryption store for ${attachment.fileName}`);
                return { ...file, uri: decryptedUrl };
              }
            } catch (error) {
              console.log(`⚠️ RESOLVE: Decryption store file missing for ${attachment.fileName}`);
            }
          }
          
          try {
            const { unifiedCacheManager } = await import('@/features/crypto/storage/UnifiedCacheManager');
            const unifiedCachedPath = await unifiedCacheManager.getFile(cacheKey, attachment.fileType, false);
            
            if (unifiedCachedPath) {
              console.log(`📦 RESOLVE: Using UnifiedCacheManager for ${attachment.fileName}`);
              return { ...file, uri: unifiedCachedPath };
            }
          } catch (error) {
            console.error(`❌ RESOLVE: Error checking UnifiedCacheManager for ${attachment.fileName}:`, error);
          }
          
          console.log(`⏳ RESOLVE: No cached version found for ${attachment.fileName}`);
        }
        
        return file;
      })
    );
    
    console.log('🔄 GALLERY DEBUG: Async resolution complete');
    setResolvedFiles(resolved);
    setIsResolving(false);
  }, [files, attachments, getDecryptedUrl]);

  // All useEffect hooks
  useEffect(() => {
    resolveAllFilesAsync();
  }, [resolveAllFilesAsync]);

  useEffect(() => {
    console.log('🔄 GALLERY DEBUG: Resolved files updated');
    resolvedFiles.forEach((file, index) => {
      const attachment = attachments?.[index];
      console.log(`  File ${index}: ${file.name}`);
      console.log(`    - URI: ${file.uri.substring(0, 50)}...`);
      console.log(`    - Needs decryption: ${attachment?.needsDecryption}`);
      console.log(`    - Is decrypted: ${file.uri.startsWith('file://')}`);
    });
  }, [resolvedFiles]);

  // Handle specific file decryption (for the active decryption case)
  useEffect(() => {
    if (viewerOptions?.isDecrypting && viewerOptions?.decryptingFileUrl) {
      const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
      const decryptedUrl = getDecryptedUrl(cacheKey);
      const decryptionError = getError(cacheKey);

      if (decryptedUrl) {
        setResolvedFiles(prevFiles => 
          prevFiles.map((file, index) => {
            if (index === initialIndex && file.uri === viewerOptions.decryptingFileUrl) {
              return { ...file, uri: decryptedUrl };
            }
            return file;
          })
        );
      } else if (decryptionError) {
        Alert.alert(
          'Decryption Failed',
          `Could not decrypt ${viewerOptions.decryptingFileName || 'file'}: ${decryptionError}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    }
  }, [
    viewerOptions?.isDecrypting,
    viewerOptions?.decryptingFileUrl,
    viewerOptions?.decryptingFileName,
    getDecryptedUrl,
    getError,
    initialIndex,
    navigation
  ]);

  useEffect(() => {
    const needsPolling = resolvedFiles.some((file, index) => {
      const attachment = attachments?.[index];
      if (!attachment?.needsDecryption) return false;
     
      const isResolved = file.uri.startsWith('file://') ||
                        file.uri.startsWith('/data/') ||
                        file.uri.includes('/cache/');
     
      return !isResolved;
    });

    if (!needsPolling) {
      console.log('🔄 GALLERY DEBUG: All files resolved, stopping polling');
      return;
    }

    const interval = setInterval(() => {
      if (!isResolving) {
        resolveAllFilesAsync();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [resolveAllFilesAsync, isResolving, resolvedFiles, attachments]);

  // All useMemo hooks - STABLE values that don't cause re-renders
  const anyFileDecrypting = useMemo(() => {
    return files.some((file, index) => {
      const attachment = attachments?.[index];
      if (attachment?.needsDecryption && attachment?.fileUrl) {
        const cacheKey = generateCacheKey(attachment.fileUrl);
        return isDecrypting(cacheKey);
      }
      return false;
    });
  }, [files, attachments, isDecrypting]); 

  const activeDecryptionStatus = useMemo(() => {
    if (!viewerOptions?.isDecrypting || !viewerOptions?.decryptingFileUrl) {
      return null;
    }
    
    const cacheKey = generateCacheKey(viewerOptions.decryptingFileUrl);
    return {
      isDecrypting: isDecrypting(cacheKey),
      progress: getProgress(cacheKey),
      status: getStatus(cacheKey),
      error: getError(cacheKey)
    };
  }, [
    viewerOptions?.isDecrypting,
    viewerOptions?.decryptingFileUrl,
    isDecrypting,
    getProgress,
    getStatus,
    getError
  ]);

  // STABLE handler functions
  const handleClose = useCallback(async () => {
    navigation.goBack();
  }, [navigation]);

  const handleDownload = useCallback(async (file: RNFile) => {
    const result = await downloadFile(file.uri, file.name);
    if (result) {
      console.log('Downloaded to:', result);
    }
  }, [downloadFile]);

  const handleShare = useCallback(async (file: RNFile) => {
    try {
      await shareRNFile(file);
    } catch (error) {
      console.error('Deling feilet:', error);
      Alert.alert('Feil', 'Kunne ikke dele filen');
    }
  }, []);

  // Show loading screen while the initial file is being decrypted
  if (viewerOptions?.isDecrypting && activeDecryptionStatus?.isDecrypting && !activeDecryptionStatus?.error) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor="black" barStyle="light-content" />
        <ActivityIndicator size="large" color="#1C6B1C" />
        <Text style={styles.loadingText}>
          {viewerOptions?.decryptingFileName 
            ? `${activeDecryptionStatus.status} ${viewerOptions.decryptingFileName}...` 
            : activeDecryptionStatus.status
          }
        </Text>
        <Text style={styles.progressText}>{activeDecryptionStatus.progress}%</Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${activeDecryptionStatus.progress}%` }
              ]}
            />
          </View>
        </View>
        
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  // Get current file based on currentIndex (using resolved files)
  const currentFile = resolvedFiles[currentIndex];
  
  if (!currentFile) {
    handleClose();
    return null;
  }

  const fileInfo = getFileTypeInfo(currentFile.type, currentFile.name);
  const isPreviewable = canPreviewFile(currentFile);

  // OPTIMALISERT SwipeContainer - memo for å unngå re-renders
  const SwipeContainer = React.memo(({ children }: { children: React.ReactNode }) => (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.container}>
          {children}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  ));

  // For images - use ImageViewerNative with ALL resolved files
  if (isPreviewable && fileInfo.category === 'image') {
    const imageFiles = resolvedFiles.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'image'
    );
    
    const currentImageIndex = imageFiles.findIndex(f => f.uri === currentFile.uri);
    const validImageIndex = Math.max(0, currentImageIndex);
    
    return (
      <SwipeContainer>
        <StatusBar backgroundColor="black" barStyle="dark-content" translucent={true} />
        <ImageViewerContent
          images={imageFiles}
          initialIndex={validImageIndex}
          onClose={handleClose}
          onDownload={viewerOptions?.showDownload !== false ? handleDownload : undefined}
          onShare={viewerOptions?.showShare !== false ? handleShare : undefined}
          useModal={false}
          simultaneousGesture={swipeGesture}
          dimensions={dimensions} // Send stable dimensions
          onIndexChange={(newImageIndex) => {
            const globalIndex = resolvedFiles.findIndex(f => f.uri === imageFiles[newImageIndex].uri);
            if (globalIndex !== -1) {
              setCurrentIndex(globalIndex);
            }
          }}
        />
        
        <DownloadProgressModal
          visible={showProgress}                       
          fileName={fileName || ''}                           
          progress={progress?.progress || 0}                    
          totalBytes={progress?.totalBytesExpectedToWrite}       
          downloadedBytes={progress?.totalBytesWritten} 
          onCancel={cancelDownload}
        />
      </SwipeContainer>
    );
  }

  // For videos - use VideoViewerNative with ALL resolved files
  if (isPreviewable && fileInfo.category === 'video') {
    const videoFiles = resolvedFiles.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'video'
    );
    
    const currentVideoIndex = videoFiles.findIndex(f => f.uri === currentFile.uri);
    const validVideoIndex = Math.max(0, currentVideoIndex);
    
    return (
      <SwipeContainer>
        <StatusBar backgroundColor="black" barStyle="light-content" translucent={true}/>
        <VideoViewerContent
          videos={videoFiles}
          initialIndex={validVideoIndex}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
          useModal={false}
          dimensions={dimensions} // Send stable dimensions
          onIndexChange={(newVideoIndex) => {
            const globalIndex = resolvedFiles.findIndex(f => f.uri === videoFiles[newVideoIndex].uri);
            if (globalIndex !== -1) {
              setCurrentIndex(globalIndex);
            }
          }}
        />
        
        <DownloadProgressModal
          visible={showProgress}                       
          fileName={fileName || ''}                           
          progress={progress?.progress || 0}                    
          totalBytes={progress?.totalBytesExpectedToWrite}       
          downloadedBytes={progress?.totalBytesWritten} 
          onCancel={cancelDownload}
        />
      </SwipeContainer>
    );
  }

  // For all other file types (documents)
  return (
    <SwipeContainer>
      <StatusBar backgroundColor="white" barStyle="dark-content"/>
      <DocumentViewerContent
        file={currentFile}
        onClose={handleClose}
        onShare={handleShare}
        onDownload={handleDownload}
        useModal={false}
        showNavigation={resolvedFiles.length > 1}
        currentIndex={currentIndex}
        totalFiles={resolvedFiles.length}
        onNavigate={handleNavigateToFile}
      />
      
      <DownloadProgressModal
        visible={showProgress}                       
        fileName={fileName || ''}                           
        progress={progress?.progress || 0}                    
        totalBytes={progress?.totalBytesExpectedToWrite}       
        downloadedBytes={progress?.totalBytesWritten} 
        onCancel={cancelDownload}
      />
    </SwipeContainer>
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