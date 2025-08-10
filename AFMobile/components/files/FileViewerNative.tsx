// components/common/FileViewerNative.tsx - Unified file viewer with video support
import React from 'react';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { canPreviewFile } from './FileHandlerNative';
import ImageViewerNative from './ImageViewerNative';
import VideoViewerNative from './VideoViewerNative';
import DocumentViewerNative from './DocumentViewerNative';
interface FileViewerNativeProps {
  visible: boolean;
  file: RNFile;
  files?: RNFile[]; // For gallery mode
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  canDownload?: boolean; // Ny parameter for å kontrollere nedlasting
}

export default function FileViewerNative({
  visible,
  file,
  files,
  initialIndex = 0,
  onClose,
  onDownload,
  canDownload = true // Default til true for bakoverkompatibilitet
}: FileViewerNativeProps) {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const isPreviewable = canPreviewFile(file);
 
  // For images - use ImageViewerNative
  if (isPreviewable && fileInfo.category === 'image') {
    // Filter only images for image viewer
    const imageFiles = (files || [file]).filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'image'
    );
   
    // Find the correct index in the filtered array
    const imageIndex = imageFiles.findIndex(f => f.uri === file.uri);
   
    return (
      <ImageViewerNative
        visible={visible}
        images={imageFiles}
        initialIndex={Math.max(0, imageIndex)}
        onClose={onClose}
        onDownload={canDownload ? onDownload : undefined}
      />
    );
  }
 
  // For videos - use VideoViewerNative
  if (isPreviewable && fileInfo.category === 'video') {
    // Filter only videos for video viewer
    const videoFiles = (files || [file]).filter(f =>
      getFileTypeInfo(f.type, f.name).category === 'video'
    );
   
    // Find the correct index in the filtered array
    const videoIndex = videoFiles.findIndex(f => f.uri === file.uri);
   
    return (
      <VideoViewerNative
        visible={visible}
        videos={videoFiles}
        initialIndex={Math.max(0, videoIndex)}
        onClose={onClose}
        onDownload={canDownload ? onDownload : undefined}
      />
    );
  }
 
  // For all other file types - use DocumentViewerNative
  return (
    <DocumentViewerNative
      visible={visible}
      file={file}
      onClose={onClose}
    />
  );
}