// utils/files/NativeFileOpener.ts
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as IntentLauncher from 'expo-intent-launcher';

export interface FileOpenResult {
  success: boolean;
  method?: 'native_app' | 'system_viewer' | 'share_sheet' | 'media_library';
  error?: string;
}

export class NativeFileOpener {
  
  /**
   * Hovedfunksjon for å åpne en fil med beste tilgjengelige metode
   */
  static async openFile(
    fileUri: string, 
    fileName: string, 
    mimeType: string,
    preferredMethod?: 'auto' | 'share' | 'intent' | 'media_library'
  ): Promise<FileOpenResult> {
    
    try {
      // Sjekk at filen eksisterer
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist locally');
      }

      console.log(`📱 Opening file: ${fileName} (${mimeType}) via ${preferredMethod || 'auto'}`);

      // Auto-detect beste metode hvis ikke spesifisert
      if (!preferredMethod || preferredMethod === 'auto') {
        preferredMethod = this.getBestOpenMethod(mimeType);
      }

      switch (preferredMethod) {
        case 'media_library':
          return await this.openViaMediaLibrary(fileUri, fileName, mimeType);
        
        case 'intent':
          if (Platform.OS === 'android') {
            return await this.openViaIntent(fileUri, mimeType);
          }
          // Fallback til share på iOS
          return await this.openViaShareSheet(fileUri, fileName);
        
        case 'share':
        default:
          return await this.openViaShareSheet(fileUri, fileName);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to open file:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Bestem beste åpningsmetode basert på filtype
   */
  private static getBestOpenMethod(mimeType: string): 'share' | 'intent' | 'media_library' {
    // For media-filer, prøv media library først
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      return 'media_library';
    }
    
    // For dokumenter på Android, bruk intent
    if (Platform.OS === 'android') {
      return 'intent';
    }
    
    // Default til share sheet
    return 'share';
  }

  /**
   * Åpne via system share sheet (fungerer på begge plattformer)
   */
  private static async openViaShareSheet(fileUri: string, fileName: string): Promise<FileOpenResult> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available on this device');
      }

      await Sharing.shareAsync(fileUri, {
        dialogTitle: `Open ${fileName}`,
        mimeType: undefined, // La systemet bestemme
        UTI: undefined // iOS
      });

      return {
        success: true,
        method: 'share_sheet'
      };

    } catch (error) {
      throw new Error(`Share sheet failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Åpne via Android Intent (kun Android) - KORRIGERT VERSJON
   */
  private static async openViaIntent(fileUri: string, mimeType: string): Promise<FileOpenResult> {
    if (Platform.OS !== 'android') {
      throw new Error('Intent launcher only available on Android');
    }

    try {
      // For private file:// URIer, bruk Sharing API direkte
      if (fileUri.startsWith('file://')) {
        console.log(`📱 Using Sharing API for secure file opening`);
        
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: 'Open with...',
          UTI: undefined
        });

        return {
          success: true,
          method: 'native_app'
        };
      }

      // For ikke-private filer (content:// URIer), prøv direkte intent
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: fileUri,
        type: mimeType,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });

      return {
        success: true,
        method: 'native_app'
      };

    } catch (error) {
      console.warn('Intent failed:', error);
      throw new Error(`Intent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Åpne media-filer via Media Library (bilder/videoer) - KORRIGERT VERSJON
   */
  private static async openViaMediaLibrary(fileUri: string, fileName: string, mimeType: string): Promise<FileOpenResult> {
    // Kun for media-filer
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      throw new Error('Media library only supports images and videos');
    }

    try {
      // For Android, bruk Sharing API direkte for media-filer
      // Dette unngår alle FileUriExposedException problemer
      if (Platform.OS === 'android') {
        console.log(`📱 Opening media via Sharing API: ${fileName}`);
        
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: 'Open with...',
          UTI: undefined
        });

        return {
          success: true,
          method: 'media_library'
        };
      } else {
        // iOS: Bruk share sheet som backup (kan ikke åpne direkte i Photos app)
        return await this.openViaShareSheet(fileUri, fileName);
      }

    } catch (error) {
      // Fallback til share sheet
      console.warn('Media library failed, falling back to share:', error);
      return await this.openViaShareSheet(fileUri, fileName);
    }
  }

  /**
   * Utility: Sjekk om fil kan åpnes nativt
   */
  static async canOpenNatively(mimeType: string): Promise<boolean> {
    // Media-filer kan alltid åpnes (via gallery/photos)
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      return true;
    }

    // PDF og vanlige dokumenter kan vanligvis åpnes
    const commonTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    return commonTypes.includes(mimeType);
  }

  /**
   * Enkel funksjon for automatisk åpning uten brukervalg
   */
  static async openFileDirectly(
    fileUri: string, 
    fileName: string, 
    mimeType: string
  ): Promise<FileOpenResult> {
    console.log(`📱 Opening file directly: ${fileName}`);
    return await this.openFile(fileUri, fileName, mimeType, 'auto');
  }
}