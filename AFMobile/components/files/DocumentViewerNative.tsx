// components/common/DocumentViewerNative.tsx - Enhanced versjon
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { RNFile, getFileIcon, getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';
import { openFileWithNativeApp, getFileTypeMessage, shareRNFile } from './FileHandlerNative';
import ViewerHeaderNative from './ViewerHeaderNative';
import * as FileSystem from 'expo-file-system';

interface DocumentViewerNativeProps {
  visible: boolean;
  file: RNFile;
  onClose: () => void;
  onShare?: (file: RNFile) => void;
}

// Filtyper som kan vises inline
const INLINE_VIEWABLE_TYPES = [
  'text/plain',
  'application/json',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
  'application/xml',
  'text/xml',
  'text/csv'
];

// File extensions som kan vises inline
const INLINE_VIEWABLE_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', 
  '.css', '.html', '.xml', '.csv', '.env', '.yaml', '.yml',
  '.log', '.sql', '.py', '.java', '.cpp', '.c', '.php',
  '.gitignore', '.dockerfile'
];

const canViewInline = (file: RNFile): boolean => {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const extension = '.' + file.name.toLowerCase().split('.').pop();
  
  return (
    INLINE_VIEWABLE_TYPES.includes(file.type) ||
    INLINE_VIEWABLE_EXTENSIONS.includes(extension) ||
    fileInfo.category === 'code' ||
    fileInfo.category === 'config' ||
    fileInfo.category === 'data' ||
    (fileInfo.category === 'document' && file.type === 'text/plain')
  );
};

export default function DocumentViewerNative({
  visible,
  file,
  onClose,
  onShare
}: DocumentViewerNativeProps) {
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const icon = getFileIcon(file.name, file.type);
  const message = getFileTypeMessage(file);
  const sizeText = file.size ? formatFileSize(file.size) : 'Ukjent størrelse';
  const canShow = canViewInline(file);

  // Last inn filinnhold hvis det kan vises inline
  useEffect(() => {
    const loadFileContent = async () => {
      if (!canShow || !visible) return;
      
      setLoading(true);
      setError('');
      
      try {
        let content = '';
        
        if (file.uri.startsWith('http')) {
          // Last ned fra URL
          const response = await fetch(file.uri);
          content = await response.text();
        } else {
          // Les lokal fil
          content = await FileSystem.readAsStringAsync(file.uri);
        }
        
        setFileContent(content);
      } catch (err) {
        console.error('Feil ved lasting av filinnhold:', err);
        setError('Kunne ikke laste filinnhold');
      } finally {
        setLoading(false);
      }
    };

    loadFileContent();
  }, [file.uri, visible, canShow]);

  const handleOpenFile = async () => {
    try {
      // Du må implementere confirmModal hook i din app
      const confirmModal = {
        confirm: async (options: { title?: string; message: string }) => {
          return new Promise<boolean>((resolve) => {
            Alert.alert(
              options.title || 'Bekreft',
              options.message,
              [
                { text: 'Avbryt', style: 'cancel', onPress: () => resolve(false) },
                { text: 'OK', onPress: () => resolve(true) }
              ]
            );
          });
        }
      };
      
      await openFileWithNativeApp(file.uri, file.name, confirmModal);
      onClose();
    } catch (error) {
      console.error('Feil ved åpning av fil:', error);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare(file);
    } else {
      try {
        await shareRNFile(file);
      } catch (error) {
        console.error('Deling feilet:', error);
        Alert.alert('Feil', 'Kunne ikke dele filen');
      }
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
      case 'config':
        return '#059669'; // Emerald
      case 'data':
        return '#db2777'; // Pink
      default:
        return '#6b7280'; // Gray
    }
  };

  const getSyntaxHighlighting = (content: string, fileName: string): React.ReactNode => {
    // Enkel syntax highlighting basert på filtype
    const extension = fileName.toLowerCase().split('.').pop();
    
    if (extension === 'json') {
      try {
        const formatted = JSON.stringify(JSON.parse(content), null, 2);
        return <Text style={styles.jsonContent}>{formatted}</Text>;
      } catch {
        return <Text style={styles.codeContent}>{content}</Text>;
      }
    }
    
    if (['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'py', 'java'].includes(extension || '')) {
      return <Text style={styles.codeContent}>{content}</Text>;
    }
    
    return <Text style={styles.textContent}>{content}</Text>;
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
            
            {!canShow && (
              <Text style={styles.message}>{message}</Text>
            )}
            
            {/* Category badge */}
            <View style={[styles.categoryBadge, { backgroundColor: getColorByCategory() }]}>
              <Text style={styles.categoryText}>
                {fileInfo.category.charAt(0).toUpperCase() + fileInfo.category.slice(1)}
              </Text>
            </View>
          </View>
          
          {/* File content hvis det kan vises inline */}
          {canShow && (
            <View style={styles.contentContainer}>
              <Text style={styles.contentHeader}>Innhold:</Text>
              
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={getColorByCategory()} />
                  <Text style={styles.loadingText}>Laster innhold...</Text>
                </View>
              )}
              
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}
              
              {!loading && !error && fileContent && (
                <ScrollView style={styles.fileContentScrollView} showsVerticalScrollIndicator={true}>
                  <View style={styles.fileContentContainer}>
                    {getSyntaxHighlighting(fileContent, file.name)}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
          
          {/* Actions */}
          <View style={styles.actions}>
            {canShow && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleShare}>
                <Text style={styles.primaryButtonText}>Del fil</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={canShow ? styles.secondaryButton : styles.primaryButton} 
              onPress={canShow ? handleOpenFile : handleOpenFile}
            >
              <Text style={canShow ? styles.secondaryButtonText : styles.primaryButtonText}>
                Åpne med app
              </Text>
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
    maxWidth: 380,
    width: '95%',
    maxHeight: '90%',
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
    marginBottom: 20,
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
  contentContainer: {
    marginBottom: 20,
    flex: 1,
  },
  contentHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6b7280',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    padding: 20,
  },
  fileContentScrollView: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  fileContentContainer: {
    padding: 12,
  },
  textContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeContent: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1f2937',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f8fafc',
  },
  jsonContent: {
    fontSize: 12,
    lineHeight: 18,
    color: '#059669',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f0fdf4',
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