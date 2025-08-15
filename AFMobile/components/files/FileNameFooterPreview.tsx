import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDisplayFileName, formatFileSize } from '@/utils/files/FileFunctions';
import { getDecodedFileName } from '@/utils/files/getDecodedFileName';

interface FileNameOverlayProps {
  fileName?: string;
  fileSize?: number; // 🆕 NEW: Add file size prop
  maxLength?: number;
  isBlurred?: boolean;
  style?: any; // For custom styling
  textStyle?: any; // For custom text styling
  numberOfLines?: number;
  showSize?: boolean; // 🆕 NEW: Option to show/hide size
  layout?: 'stacked' | 'inline'; // 🆕 NEW: Layout options
}

export const FileNameFooterPreview: React.FC<FileNameOverlayProps> = ({
  fileName,
  fileSize,
  maxLength = 20,
  isBlurred = false,
  style,
  textStyle,
  numberOfLines = 1,
  showSize = true,
  layout = 'inline' // 🔧 CHANGED: Default to inline layout
}) => {
  if (!fileName || isBlurred) return null;

  const displayName = getDisplayFileName(getDecodedFileName(fileName), maxLength);
  const displaySize = fileSize ? formatFileSize(fileSize) : null;

  // 🎯 Inline layout as default: "filename.jpg • 2.3 MB"
  if (layout === 'inline' && displaySize && showSize) {
    return (
      <View style={[styles.fileNameOverlay, style]}>
        <Text style={[styles.fileNameText, textStyle]} numberOfLines={numberOfLines}>
          {displayName} • {displaySize}
        </Text>
      </View>
    );
  }

  // Stacked layout for when explicitly requested
  if (layout === 'stacked') {
    return (
      <View style={[styles.fileNameOverlay, style]}>
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
    <View style={[styles.fileNameOverlay, style]}>
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
    backgroundColor: 'rgba(28, 107, 28, 0.9)', // 🎨 Slightly transparent for better readability
    paddingHorizontal: 4,
    paddingVertical: 3, // 🎨 Slightly more padding for size text
  },
  fileNameText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500', // 🎨 Slightly bolder for better readability
  },
  fileSizeText: {
    fontSize: 8, // 🎨 Smaller size for file size
    color: 'rgba(255, 255, 255, 0.8)', // 🎨 Slightly muted
    marginTop: 1, // 🎨 Small spacing between name and size
  },
});