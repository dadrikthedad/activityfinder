import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatFileSize, getDisplayFileName } from '@/utils/files/FileFunctions';
import { getDecodedFileName } from '@/utils/files/getDecodedFileName';

interface FileNameOverlayProps {
  fileName?: string;
  fileSize?: number;
  maxLength?: number; // 🔧 CHANGED: Now used as fallback only
  isBlurred?: boolean;
  style?: any;
  textStyle?: any;
  numberOfLines?: number;
  showSize?: boolean;
  layout?: 'stacked' | 'inline';
}

// 🆕 NEW: Much more generous calculation to maximize filename space
const calculateMaxCharsFromWidth = (containerWidth: number, sizeText: string = '', fontSize: number = 10): number => {
  // More accurate character width estimation - be less conservative
  const charWidth = fontSize * 0.55; // Even smaller per char estimate
  const sizeCharWidth = fontSize * 0.55; // Size text character width (8px font)
  const sizeWidth = sizeText.length * sizeCharWidth;
  
  // Minimal reserved space: just padding (8px) + a tiny buffer (2px)
  const reservedWidth = 8 + 2 + sizeWidth;
  const availableWidth = containerWidth - reservedWidth;
  
  // Be very generous with character estimation
  return Math.max(15, Math.floor(availableWidth / charWidth) + 5); // +5 for extra generosity
};

export const FileNameFooterPreview: React.FC<FileNameOverlayProps> = ({
  fileName,
  fileSize,
  maxLength = 20, // Fallback value
  isBlurred = false,
  style,
  textStyle,
  numberOfLines = 1,
  showSize = true,
  layout = 'inline'
}) => {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  if (!fileName || isBlurred) return null;

  const displaySize = fileSize ? formatFileSize(fileSize) : null;
  
  // 🆕 NEW: Use container width to calculate optimal maxLength  
  let availableForFileName = maxLength; // Fallback
  if (containerWidth && layout === 'inline') {
    const fontSize = StyleSheet.flatten([styles.fileNameText, textStyle])?.fontSize || 10;
    // For inline layout, calculate based on actual container width
    availableForFileName = calculateMaxCharsFromWidth(containerWidth, displaySize || '', fontSize);
  } else if (layout !== 'inline' && showSize && displaySize) {
    // For stacked layout, still reserve space traditionally
    const sizeReservedSpace = 3 + displaySize.length;
    availableForFileName = Math.max(8, maxLength - sizeReservedSpace);
  }

  const displayName = getDisplayFileName(getDecodedFileName(fileName), availableForFileName);

  // 🆕 NEW: Handle container layout measurement
  const handleLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  // 🎯 Inline layout as default: filename on left, size on right
  if (layout === 'inline' && displaySize && showSize) {
    return (
      <View 
        style={[styles.fileNameOverlay, style]} 
        onLayout={handleLayout}
      >
        <View style={styles.inlineContainer}>
          <Text 
            style={[styles.fileNameText, textStyle]} 
            numberOfLines={numberOfLines}
            ellipsizeMode="middle"
          >
            {displayName}
          </Text>
          <Text style={[styles.fileSizeText, styles.fileSizeRight, textStyle]}>
            {displaySize}
          </Text>
        </View>
      </View>
    );
  }

  // Stacked layout for when explicitly requested
  if (layout === 'stacked') {
    return (
      <View 
        style={[styles.fileNameOverlay, style]} 
        onLayout={handleLayout}
      >
        <Text style={[styles.fileNameText, textStyle]} numberOfLines={numberOfLines}>
          {displayName}
        </Text>
        {showSize && displaySize && (
          <Text style={[styles.fileSizeText, textStyle]} numberOfLines={1}>
            {displaySize}
          </Text>
        )}
      </View>
    );
  }

  // Fallback: just filename if no size or showSize is false
  return (
    <View 
      style={[styles.fileNameOverlay, style]} 
      onLayout={handleLayout}
    >
      <Text style={[styles.fileNameText, textStyle]} numberOfLines={numberOfLines}>
        {displayName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fileNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28, 107, 28, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  // 🆕 NEW: Container for inline layout with space-between
  inlineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  fileNameText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
    // 🔧 REMOVED: flex: 1 so filename takes only needed space
  },
  fileSizeText: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  // 🆕 NEW: Right-aligned size text
  fileSizeRight: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 0,
    flexShrink: 0, // Don't shrink the size text
  },
});