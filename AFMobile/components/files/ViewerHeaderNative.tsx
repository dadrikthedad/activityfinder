// components/common/ViewerHeaderNative.tsx - Enhanced med theme support
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Download, Share } from 'lucide-react-native';
import { RNFile } from '@/utils/files/FileFunctions';
import CloseButtonNative from '../common/buttons/CloseButtonNative';

interface ViewerHeaderNativeProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  onShare?: (file: RNFile) => void;
  currentFile?: RNFile;
  showDownload?: boolean;
  showShare?: boolean;
  isDownloading?: boolean;
  theme?: 'light' | 'dark'; // NEW: Theme prop
}

export default function ViewerHeaderNative({
  title,
  subtitle,
  onClose,
  onDownload,
  onShare,
  currentFile,
  showDownload = true,
  showShare = true,
  isDownloading = false,
  theme = 'dark' // DEFAULT: Dark theme for backwards compatibility
}: ViewerHeaderNativeProps) {
 
  const isDark = theme === 'dark';
  const isLight = theme === 'light';
 
  // Dynamic colors based on theme
  const iconColor = isDark ? 'white' : '#ffffffff';
  const textColor = isDark ? 'white' : '#374151';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#6b7280';
  const buttonBackgroundColor = isDark ? '#1C6B1C' : '#1C6B1C';
  const headerBackgroundColor = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)';
  
  const handleDownload = async () => {
    if (!currentFile || !onDownload) return;
   
    try {
      await onDownload(currentFile);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };
  
  const handleShare = () => {
    if (onShare && currentFile) {
      onShare(currentFile);
    }
  };
  
  return (
    <View style={[
      styles.header,
      { backgroundColor: headerBackgroundColor },
    ]}>
      <View style={styles.headerLeft}>
        <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.counter, { color: subtitleColor }]}>
            {subtitle}
          </Text>
        )}
      </View>
     
      <View style={styles.headerRight}>
        {/* Del-knapp */}
        {showShare && onShare && currentFile && (
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: buttonBackgroundColor }]}
            onPress={handleShare}
          >
            <Share size={20} color={iconColor} />
          </TouchableOpacity>
        )}
       
        {/* Nedlastingsknapp */}
        {showDownload && onDownload && currentFile && (
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: buttonBackgroundColor }]}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <Download size={20} color={iconColor} />
            )}
          </TouchableOpacity>
        )}
       
        {/* Lukk-knapp - Nå bruker CloseButtonNative */}
        <CloseButtonNative
          onPress={onClose}
          theme={theme}
          size={44}
          iconSize={20}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingTop: 0,
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  counter: {
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});