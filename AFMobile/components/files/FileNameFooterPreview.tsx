import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDisplayFileName } from '@/utils/files/FileFunctions';
import { getDecodedFileName } from '@/utils/files/getDecodedFileName';

interface FileNameOverlayProps {
  fileName?: string;
  maxLength?: number;
  isBlurred?: boolean;
  style?: any; // For custom styling
  textStyle?: any; // For custom text styling
  numberOfLines?: number;
}

export const FileNameFooterPreview: React.FC<FileNameOverlayProps> = ({
  fileName,
  maxLength = 20,
  isBlurred = false,
  style,
  textStyle,
  numberOfLines = 1
}) => {
  if (!fileName || isBlurred) return null;

  return (
    <View style={[styles.fileNameOverlay, style]}>
      <Text style={[styles.fileNameText, textStyle]} numberOfLines={numberOfLines}>
        {getDisplayFileName(getDecodedFileName(fileName), maxLength)}
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
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fileNameText: {
    fontSize: 10,
    color: 'white',
  },
});