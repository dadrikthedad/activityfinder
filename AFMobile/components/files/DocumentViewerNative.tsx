// components/common/DocumentViewerNative.tsx - Oppdatert versjon
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RNFile, getFileIcon, getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';
import { openFileWithNativeApp, getFileTypeMessage } from './FileHandlerNative';
import ViewerHeaderNative from './ViewerHeaderNative';

interface DocumentViewerNativeProps {
  visible: boolean;
  file: RNFile;
  onClose: () => void;
}

export default function DocumentViewerNative({
  visible,
  file,
  onClose
}: DocumentViewerNativeProps) {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const icon = getFileIcon(file.name, file.type);
  const message = getFileTypeMessage(file);
  const sizeText = file.size ? formatFileSize(file.size) : 'Ukjent størrelse';
  
  const handleOpenFile = async () => {
    try {
      await openFileWithNativeApp(file.uri, file.name);
      // Lukk modal etter vellykket åpning
      onClose();
    } catch (error) {
      // Error er allerede håndtert i openFileWithNativeApp
      console.error('Feil ved åpning av fil:', error);
    }
  };

  const getColorByCategory = () => {
    switch (fileInfo.category) {
      case 'pdf':
        return '#dc2626'; // Red
      case 'document':
        return '#2563eb'; // Blue
      case 'spreadsheet':
        return '#16a34a'; // Green
      case 'presentation':
        return '#ea580c'; // Orange
      case 'code':
        return '#7c3aed'; // Purple
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {file.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* File info */}
          <View style={styles.fileInfo}>
            <Text style={[styles.fileIcon, { color: getColorByCategory() }]}>
              {icon}
            </Text>
            
            <Text style={styles.fileName} numberOfLines={2}>
              {file.name}
            </Text>
            
            <View style={styles.fileDetails}>
              <Text style={styles.fileType}>{file.type || 'Ukjent type'}</Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.fileSize}>{sizeText}</Text>
            </View>
            
            <Text style={styles.message}>{message}</Text>
            
            {/* Category badge */}
            <View style={[styles.categoryBadge, { backgroundColor: getColorByCategory() }]}>
              <Text style={styles.categoryText}>
                {fileInfo.category.charAt(0).toUpperCase() + fileInfo.category.slice(1)}
              </Text>
            </View>
          </View>
          
          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleOpenFile}>
              <Text style={styles.primaryButtonText}>Åpne med app</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Lukk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxWidth: 320,
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    color: '#1f2937',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 15,
  },
  closeText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  fileInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  fileIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#374151',
  },
  fileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  fileType: {
    fontSize: 12,
    color: '#6b7280',
  },
  separator: {
    fontSize: 12,
    color: '#d1d5db',
    marginHorizontal: 8,
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1C6B1C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
   primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
  },
});