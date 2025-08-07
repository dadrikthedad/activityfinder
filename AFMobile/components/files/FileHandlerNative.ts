// utils/FileHandlerNative.ts - Optimalisert versjon
import { Linking, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getFileTypeInfo, RNFile } from '@/utils/files/FileFunctions';

// ===================================
// 🎯 MIME TYPE HANDLING
// ===================================

// Bruk existerende getFileTypeInfo for å få MIME type
const getMimeTypeFromFileInfo = (fileName: string): string => {
  const extension = fileName.toLowerCase().split('.').pop();
  
  const mimeTypes: { [key: string]: string } = {
    // Dokumenter
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Bilder
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Video
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    
    // Lyd
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    
    // Tekst
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    
    // Arkiv
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    
    // Andre
    'csv': 'text/csv',
    'rtf': 'application/rtf',
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
};

// ===================================
// 🚀 MAIN FUNCTIONS
// ===================================

/**
 * Åpne fil med native app - hovedfunksjon
 */
export const openFileWithNativeApp = async (fileUri: string, fileName: string) => {
  try {
    // Sjekk først om sharing er tilgjengelig
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (isAvailable) {
      // Bruk Sharing API (anbefalt for React Native/Expo)
      await Sharing.shareAsync(fileUri, {
        mimeType: getMimeTypeFromFileInfo(fileName),
        dialogTitle: `Åpne ${fileName}`,
      });
    } else {
      // Fallback til Linking API
      const supported = await Linking.canOpenURL(fileUri);
      if (supported) {
        await Linking.openURL(fileUri);
      } else {
        Alert.alert(
          'Kan ikke åpne fil',
          'Ingen kompatible apper funnet for denne filtypen'
        );
      }
    }
  } catch (error) {
    console.error('Feil ved åpning av fil:', error);
    Alert.alert('Feil', 'Kunne ikke åpne filen');
  }
};

/**
 * Last ned fil fra URL
 */
export const downloadFile = async (url: string, fileName: string) => {
  try {
    const downloadPath = `${FileSystem.documentDirectory}${fileName}`;
    
    const { uri } = await FileSystem.downloadAsync(url, downloadPath);
    
    Alert.alert(
      'Nedlasting fullført',
      `Filen ble lagret som: ${fileName}`,
      [
        { text: 'OK' },
        {
          text: 'Åpne',
          onPress: () => openFileWithNativeApp(uri, fileName)
        }
      ]
    );
    
    return uri;
  } catch (error) {
    console.error('Feil ved nedlasting:', error);
    Alert.alert('Feil', 'Kunne ikke laste ned filen');
    throw error;
  }
};

// ===================================
// 🔍 ENHANCED PREVIEW FUNCTIONS
// ===================================

/**
 * Sjekk om en fil kan forhåndsvises i ImageViewerNative
 * (Bruker existing FileFunctions for konsistens)
 */
export const canPreviewFile = (file: RNFile): boolean => {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  
  // Kun bilder og videoer kan forhåndsvises i ImageViewerNative
  return fileInfo.category === 'image' || fileInfo.category === 'video';
};

/**
 * Sjekk om fil trenger native app (ikke kan forhåndsvises)
 */
export const needsNativeApp = (file: RNFile): boolean => {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  
  // Dokumenter, presentasjoner, regneark trenger native apper
  return ['document', 'spreadsheet', 'presentation', 'pdf', 'other'].includes(fileInfo.category);
};

/**
 * Get user-friendly message for file type
 */
export const getFileTypeMessage = (file: RNFile): string => {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  
  switch (fileInfo.category) {
    case 'pdf':
      return 'PDF-filer åpnes best i Adobe Reader eller lignende apper';
    case 'document':
      return 'Dokumenter åpnes i Microsoft Office eller Google Docs';
    case 'spreadsheet':
      return 'Regneark åpnes i Excel eller Google Sheets';
    case 'presentation':
      return 'Presentasjoner åpnes i PowerPoint eller Google Slides';
    case 'code':
      return 'Kodefiler kan åpnes i teksteditorer eller IDE-er';
    case 'image':
      return 'Bildene kan forhåndsvises eller åpnes i galleri-apper';
    case 'video':
      return 'Videoer kan spilles av i media-apper';
    default:
      return 'Filen åpnes i en kompatibel app';
  }
};

// ===================================
// 🎯 SMART FILE HANDLER
// ===================================

/**
 * Smart fil-håndterer som bestemmer beste handling basert på filtype
 */
export const handleFileInteraction = async (file: RNFile) => {
  if (canPreviewFile(file)) {
    // Returner false for å indikere at preview skal håndteres av parent component
    return false;
  } else {
    // Åpne direkte med native app
    await openFileWithNativeApp(file.uri, file.name);
    return true;
  }
};