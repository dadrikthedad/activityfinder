// screens/MediaViewerScreen.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Alert, SafeAreaView  } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, MediaViewerScreenNavigationProp } from '@/types/navigation';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { canPreviewFile, shareRNFile } from '@/components/files/FileHandlerNative';
import { useDownload } from '@/hooks/files/useDownload';
import { VideoViewerContent } from '@/components/files/VideoViewerNative';
import DocumentViewerNative from '@/components/files/DocumentViewerNative';
import DownloadProgressModal from '@/components/files/DownloadProgressModal';
import { StatusBar } from 'react-native';
import { ImageViewerContent } from '@/components/files/ImageViewerNative';

type MediaViewerScreenRouteProp = RouteProp<RootStackParamList, 'MediaViewer'>;

export default function MediaViewerScreen() {
  const navigation = useNavigation<MediaViewerScreenNavigationProp>();
  const route = useRoute<MediaViewerScreenRouteProp>();
  
  const { files, initialIndex, conversationId } = route.params;
  
  // Download hook fra MessageAttachmentsNative
  const { 
    showProgress, 
    progress, 
    fileName, 
    downloadFile, 
    cancelDownload 
  } = useDownload();

  // Handle close - navigate back
  const handleClose = async () => {
    navigation.goBack();
  };

  // Handle download - samme som MessageAttachmentsNative
  const handleDownload = async (file: RNFile) => {
    const result = await downloadFile(file.uri, file.name);
    if (result) {
      // Success - fil er lastet ned
      console.log('Downloaded to:', result);
    }
    // Cancellation og errors håndteres automatisk av hooken
  };

  // Handle share - samme som MessageAttachmentsNative
  const handleShare = async (file: RNFile) => {
    try {
      await shareRNFile(file);
    } catch (error) {
      console.error('Deling feilet:', error);
      Alert.alert('Feil', 'Kunne ikke dele filen');
    }
  };

  // Get current file based on initialIndex
  const currentFile = files[initialIndex];
  
  if (!currentFile) {
    // Handle edge case where file doesn't exist
    handleClose();
    return null;
  }

  const fileInfo = getFileTypeInfo(currentFile.type, currentFile.name);
  const isPreviewable = canPreviewFile(currentFile);

  // For images - use ImageViewerNative (but remove Modal wrapper)
  if (isPreviewable && fileInfo.category === 'image') {
    // Filter only images for image viewer
    const imageFiles = files.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'image'
    );
    
    // Find the correct index in the filtered array
    const imageIndex = imageFiles.findIndex(f => f.uri === currentFile.uri);
    
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="black" barStyle="dark-content" translucent={true} />
        <ImageViewerContent
          images={imageFiles}
          initialIndex={Math.max(0, imageIndex)}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
          useModal={false} // Important: use screen mode, not modal mode
        />
        
        {/* Download Progress Modal - render at screen level */}
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

  // For videos - use VideoViewerNative (but remove Modal wrapper)
  if (isPreviewable && fileInfo.category === 'video') {
    // Filter only videos for video viewer
    const videoFiles = files.filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'video'
    );
    
    // Find the correct index in the filtered array
    const videoIndex = videoFiles.findIndex(f => f.uri === currentFile.uri);
    
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="black" barStyle="light-content" translucent={true}/>
        <VideoViewerContent
          videos={videoFiles}
          initialIndex={Math.max(0, videoIndex)}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
          useModal={false} // Important: use screen mode, not modal mode
        />
        
        {/* Download Progress Modal - render at screen level */}
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
    <View style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="default" translucent={true}/>
      <DocumentViewerNative
        visible={true} // Always visible since we're in a screen
        file={currentFile}
        onClose={handleClose}
        onShare={handleShare}
      />
      
      {/* Download Progress Modal - samme som MessageAttachmentsNative */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    // Remove absolute positioning - let flex handle the layout
  },
});