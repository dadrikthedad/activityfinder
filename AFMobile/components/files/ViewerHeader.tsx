// components/common/ViewerHeaderNative.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Download, X } from 'lucide-react-native';
import { RNFile } from '@/utils/files/FileFunctions';

interface ViewerHeaderNativeProps {
  title: string;
  subtitle?: string; // For "X of Y" counter
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  currentFile?: RNFile;
  showDownload?: boolean; // Ekstra kontroll
}

export default function ViewerHeaderNative({
  title,
  subtitle,
  onClose,
  onDownload,
  currentFile,
  showDownload = true
}: ViewerHeaderNativeProps) {
  const handleDownload = () => {
    if (onDownload && currentFile) {
      onDownload(currentFile);
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.fileName} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.counter}>
            {subtitle}
          </Text>
        )}
      </View>
      
      <View style={styles.headerRight}>
        {/* Nedlastingsknapp */}
        {showDownload && onDownload && currentFile && (
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleDownload}
          >
            <Download size={20} color="white" />
          </TouchableOpacity>
        )}
        
        {/* Lukk-knapp */}
        <TouchableOpacity style={styles.headerButton} onPress={onClose}>
          <X size={20} color="white" />
        </TouchableOpacity>
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
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  fileName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    backgroundColor: '#1C6B1C',
    borderRadius: 22,
  },
});