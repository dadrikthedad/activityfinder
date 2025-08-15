// components/common/DocumentViewerNative.tsx - Modal-agnostic, følger ImageViewer mønster
import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  ActivityIndicator, 
  Platform, 
  SafeAreaView,
  StatusBar 
} from 'react-native';
import { RNFile, getFileIcon, getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';
import { openFileWithNativeApp, getFileTypeMessage, shareRNFile } from './FileHandlerNative';
import ViewerHeaderNative from './ViewerHeaderNative';
import * as FileSystem from 'expo-file-system';

interface DocumentViewerContentProps {
  file: RNFile;
  onClose: () => void;
  onShare?: (file: RNFile) => void;
  onDownload?: (file: RNFile) => void;
  useModal?: boolean; // Control behavior differences between Modal and Screen
}

interface DocumentViewerNativeProps extends DocumentViewerContentProps {
  visible: boolean;
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
  // Decode URL-encoded filename (in case it wasn't decoded earlier)
  const decodedFileName = decodeURIComponent(file.name);
  const fileInfo = getFileTypeInfo(file.type, decodedFileName);
  const extension = '.' + decodedFileName.toLowerCase().split('.').pop();
  
  return (
    INLINE_VIEWABLE_TYPES.includes(file.type) ||
    INLINE_VIEWABLE_EXTENSIONS.includes(extension) ||
    fileInfo.category === 'code' ||
    fileInfo.category === 'config' ||
    fileInfo.category === 'data' ||
    (fileInfo.category === 'document' && file.type === 'text/plain')
  );
};

// Core content component - can be used in Modal or Screen
const DocumentViewerContent: React.FC<DocumentViewerContentProps> = ({
  file,
  onClose,
  onShare,
  onDownload,
  useModal = true // Default to Modal behavior for backwards compatibility
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const icon = getFileIcon(file.name, file.type);
  const message = getFileTypeMessage(file);
  const sizeText = file.size ? formatFileSize(file.size) : 'Ukjent størrelse';
  const canShow = canViewInline(file);
  
  // 🐛 DEBUG - sjekk canShow verdien
  console.log('📄 DocumentViewer canShow:', {
    fileName: file.name,
    canShow,
    hasFileContent: Boolean(fileContent),
    loading,
    error,
    useModal
  });

  // Last inn filinnhold hvis det kan vises inline
  useEffect(() => {
    const loadFileContent = async () => {
      if (!canShow) return;
      
      setLoading(true);
      setError('');
      
      try {
        let content = '';
        
        if (file.uri.startsWith('http')) {
          // Last ned fra URL
          console.log('🌐 Loading content from URL:', file.uri.substring(0, 100) + '...');
          const response = await fetch(file.uri);
          content = await response.text();
          console.log('✅ Content loaded, length:', content.length);
        } else {
          // Les lokal fil
          console.log('📱 Loading content from local file:', file.uri);
          content = await FileSystem.readAsStringAsync(file.uri);
          console.log('✅ Local content loaded, length:', content.length);
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
  }, [file.uri, canShow]);

  const handleDownload = async (file: RNFile) => {
    if (!onDownload) return;
    
    setIsDownloading(true);
    try {
      await onDownload(file);
    } catch (error) {
      console.error('Nedlasting feilet:', error);
      Alert.alert('Feil', 'Kunne ikke laste ned filen');
    } finally {
      setIsDownloading(false);
    }
  };

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

  const handleShare = async (file: RNFile) => {
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
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.background} />

      {/* Header */}
      <ViewerHeaderNative
        title={file.name}
        onClose={onClose}
        onDownload={onDownload ? handleDownload : undefined}
        onShare={onShare ? handleShare : undefined}
        currentFile={file}
        showDownload={!!onDownload}
        showShare={!!onShare}
        isDownloading={isDownloading}
        theme="light" // 🎨 Light theme for DocumentViewer
      />

      {/* Content Container */}
      <View style={useModal ? styles.modalContent : styles.screenContent}>
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
            
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={getColorByCategory()} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            
            {!loading && !error && fileContent && (
              <ScrollView 
                style={styles.fileContentScrollView} 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.fileContentContainer}
              >
                {getSyntaxHighlighting(fileContent, file.name)}
              </ScrollView>
            )}
          </View>
        )}
        
        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleOpenFile}>
            <Text style={styles.primaryButtonText}>
              Open
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Modal wrapper for backwards compatibility
export default function DocumentViewerNative({
  visible,
  file,
  onClose,
  onShare,
  onDownload
}: DocumentViewerNativeProps) {
  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" translucent />
      <DocumentViewerContent
        file={file}
        onClose={onClose}
        onShare={onShare}
        onDownload={onDownload}
        useModal={true}
      />
    </Modal>
  );
}

// Export content component for use in screens
export { DocumentViewerContent };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
  
  // Modal content styles
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 80, // Space for header
    borderRadius: 12,
    padding: 20,
    maxWidth: 380,
    width: '95%',
    maxHeight: '85%',
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  
  // Screen content styles
  screenContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 80, // Space for header
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    flex: 1, // 🚀 Ta all tilgjengelig plass
    minHeight: 200, // Minimum høyde for innhold
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    flex: 1, // 🚀 Bruk all tilgjengelig plass
    minHeight: 200, // Minimum høyde
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
    marginTop: 'auto', // Push to bottom
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
});