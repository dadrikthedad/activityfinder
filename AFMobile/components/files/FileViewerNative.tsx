// components/common/FileViewerNative.tsx - Unified file viewer
import React from 'react';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { canPreviewFile } from './FileHandlerNative';
import ImageViewerNative from '../common/ImageViewerNative';
import DocumentViewerNative from './DocumentViewerNative';

interface FileViewerNativeProps {
  visible: boolean;
  file: RNFile;
  files?: RNFile[]; // For gallery mode
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
}

export default function FileViewerNative({
  visible,
  file,
  files,
  initialIndex = 0,
  onClose,
  onDownload
}: FileViewerNativeProps) {
  
  // Smart routing basert på filtype
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const isPreviewable = canPreviewFile(file);
  
  // For bilder og videoer - bruk ImageViewerNative med gallery support
  if (isPreviewable && (fileInfo.category === 'image' || fileInfo.category === 'video')) {
    return (
      <ImageViewerNative
        visible={visible}
        images={files || [file]}
        initialIndex={initialIndex}
        onClose={onClose}
        onDownload={onDownload}
      />
    );
  }
  
  // For alle andre filtyper - bruk DocumentViewerNative
  return (
    <DocumentViewerNative
      visible={visible}
      file={file}
      onClose={onClose}
    />
  );
}