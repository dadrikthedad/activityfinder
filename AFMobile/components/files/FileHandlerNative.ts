// utils/FileHandlerNative.ts - Optimalisert versjon
import { Alert, Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getFileTypeInfo, RNFile } from '@/utils/files/FileFunctions';
import * as IntentLauncher from 'expo-intent-launcher';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// ===================================
// 🎯 MIME TYPE HANDLING
// ===================================

// Bruk existerende getFileTypeInfo for å få MIME type
export const getMimeTypeFromFileInfo = (fileName: string): string => {
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
 * Åpne fil med native app - forbedret versjon
 * Prøver først native åpning, faller tilbake på deling hvis nødvendig
 */
export const openFileWithNativeApp = async (
  fileUri: string, 
  fileName: string,
  confirmModal: { confirm: (options: { title?: string; message: string }) => Promise<boolean> }
) => {
  try {
    console.log(`🔄 Prøver å åpne fil: ${fileName} (${fileUri})`);
    
    // Sjekk om filen eksisterer lokalt
    let localUri = fileUri;
    if (fileUri.startsWith('http')) {
      // Last ned filen midlertidig hvis det er en URL
      console.log('📥 Laster ned fil for åpning...');
      const tempPath = `${FileSystem.cacheDirectory}temp_open_${Date.now()}_${fileName}`;
      const downloadResult = await FileSystem.downloadAsync(fileUri, tempPath);
      localUri = downloadResult.uri;
    }

    const mimeType = getMimeTypeFromFileInfo(fileName);
    
    if (Platform.OS === 'android') {
      // Android: Bruk IntentLauncher for å åpne filen direkte
      try {
        console.log(`🤖 Android: Åpner med Intent (${mimeType})`);
        
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: localUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
        
        console.log('✅ Fil åpnet med Android Intent');
        return;
        
      } catch (intentError) {
        console.log('⚠️ Intent feilet, prøver alternative metoder:', intentError);
        
        // Fallback: Prøv med content URI hvis det er en lokal fil
        if (!localUri.startsWith('content://') && !localUri.startsWith('http')) {
          try {
            // Konverter til content URI for bedre kompatibilitet
            const contentUri = await FileSystem.getContentUriAsync(localUri);
            
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1,
              type: mimeType,
            });
            
            console.log('✅ Fil åpnet med content URI');
            return;
            
          } catch (contentError) {
            console.log('⚠️ Content URI feilet også:', contentError);
          }
        }
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Prøv først med dokumentinteraksjon
      try {
        console.log('🍎 iOS: Prøver å åpne fil...');
        
        // For iOS, bruk Linking for å åpne filer
        const canOpen = await Linking.canOpenURL(localUri);
        
        if (canOpen) {
          await Linking.openURL(localUri);
          console.log('✅ Fil åpnet med iOS Linking');
          return;
        }
      } catch (iosError) {
        console.log('⚠️ iOS Linking feilet:', iosError);
      }
    }

    // Hvis vi kommer hit, kunne vi ikke åpne filen
    throw new Error('Ingen metode for å åpne filen er tilgjengelig');

  } catch (error) {
    console.error('❌ Feil ved åpning av fil:', error);
    
    // Vis brukervennlig feilmelding med forslag
    const fileInfo = getFileTypeInfo('', fileName);
    const suggestions = getSuggestionsForFileType(fileInfo.category);
    
    await confirmModal.confirm({
      title: 'Kan ikke åpne fil',
      message: `Kunne ikke åpne ${fileName}.\n\n${suggestions}`
    });
  }
};

/**
 * Gi forslag basert på filtype
 */
const getSuggestionsForFileType = (category: string): string => {
  switch (category) {
    case 'pdf':
      return 'Prøv å installere Adobe Reader, Google PDF Viewer eller en annen PDF-leser.';
    case 'document':
      return 'Prøv å installere Microsoft Word, Google Docs eller WPS Office.';
    case 'spreadsheet':
      return 'Prøv å installere Microsoft Excel, Google Sheets eller WPS Office.';
    case 'presentation':
      return 'Prøv å installere Microsoft PowerPoint, Google Slides eller WPS Office.';
    case 'image':
      return 'Bildet burde åpnes i galleri-appen. Sjekk om filen er skadet.';
    case 'video':
      return 'Prøv å installere VLC, Google Photos eller en annen video-spiller.';
    case 'audio':
      return 'Prøv å installere en musikk-app som støtter dette formatet.';
    default:
      return 'Sjekk om du har en app installert som støtter denne filtypen.';
  }
};

/**
 * Forbedret downloadFile som bruker den nye openFileWithNativeApp
 * @param url URL til filen som skal lastes ned
 * @param fileName Navn på filen
 * @param confirmModal useConfirmModalNative hook for å vise confirm dialog
 */
// File size threshold for showing progress modal (5MB)
const PROGRESS_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5MB

// Function to estimate file size from URL (if possible)
const estimateFileSize = async (url: string): Promise<number> => {
  try {
    // Try to get file info without downloading
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch {
    // If we can't get size, assume it's small
    return 0;
  }
};

// Helper function to determine if we should show progress
export const shouldShowProgress = async (url: string, fileName?: string): Promise<boolean> => {
  // Check file extension for known large file types
  const largeFileExtensions = ['.zip', '.rar', '.tar', '.gz', '.7z', '.mov', '.avi', '.mkv', '.mp4', '.mp3', '.wav', '.flac', '.iso', '.dmg', '.exe', '.msi'];
  const fileExtension = fileName ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
  
  if (largeFileExtensions.includes(fileExtension)) {
    return true;
  }

  // Try to estimate file size
  const estimatedSize = await estimateFileSize(url);
  return estimatedSize > PROGRESS_THRESHOLD_BYTES;
};



/**
 * Del fil - laster ned midlertidig hvis nødvendig
 */
export const shareFile = async (fileUri: string, fileName: string) => {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (!isAvailable) {
      Alert.alert('Deling ikke tilgjengelig', 'Deling er ikke støttet på denne enheten');
      return;
    }

    let localUri = fileUri;
    
    // Hvis det er en URL, last ned midlertidig
    if (fileUri.startsWith('http')) {
      console.log('📥 Laster ned fil midlertidig for deling...');
      
      // Bruk en temp-mappe for delinger
      const tempPath = `${FileSystem.cacheDirectory}temp_share_${Date.now()}_${fileName}`;
      
      const downloadResult = await FileSystem.downloadAsync(fileUri, tempPath);
      localUri = downloadResult.uri;
      
      console.log('✅ Midlertidig nedlasting fullført:', localUri);
    }
    
    // Del den lokale filen
    await Sharing.shareAsync(localUri, {
      mimeType: getMimeTypeFromFileInfo(fileName),
      dialogTitle: `Del ${fileName}`
    });
    
    console.log('✅ Deling fullført');
    
  } catch (error) {
    console.error('Deling feilet:', error);
    Alert.alert('Feil', 'Kunne ikke dele filen');
  }
};

/**
 * Wrapper funksjon for å dele RNFile
 */
export const shareRNFile = async (file: RNFile) => {
  return shareFile(file.uri, file.name);
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
