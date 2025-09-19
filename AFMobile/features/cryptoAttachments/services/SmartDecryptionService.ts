// features/crypto/services/SmartDecryptionService.ts
import { AttachmentDto } from '@shared/types/MessageDTO';


interface DecryptionStrategy {
  immediate: 'lazy' | 'background';
  shouldQueue: boolean;
  reason: string;
}

interface DecryptionThresholds {
  imageSizeLimit: number;    // 2MB - images larger than this use background
  videoSizeLimit: number;    // 1MB - videos larger than this use background  
  documentSizeLimit: number; // 10MB - documents larger than this use background
  alwaysBackgroundTypes: string[]; // File types that always use background
}

export class SmartDecryptionService {
  private static instance: SmartDecryptionService;
  
  // Configuration thresholds
  private thresholds: DecryptionThresholds = {
    imageSizeLimit: 2 * 1024 * 1024,      // 2MB
    videoSizeLimit: 1 * 1024 * 1024,      // 1MB  
    documentSizeLimit: 10 * 1024 * 1024,  // 10MB
    alwaysBackgroundTypes: [
      'video/mp4',
      'video/mov', 
      'video/avi',
      'video/mkv',
      'application/zip',
      'application/rar'
    ]
  };

  private constructor() {
    console.log('🧠 SmartDecryptionService initialized with thresholds:', this.thresholds);
  }

  public static getInstance(): SmartDecryptionService {
    if (!SmartDecryptionService.instance) {
      SmartDecryptionService.instance = new SmartDecryptionService();
    }
    return SmartDecryptionService.instance;
  }

  /**
   * Determine the best decryption strategy for a file
   */
  public getDecryptionStrategy(attachment: AttachmentDto): DecryptionStrategy {
    const fileSize = attachment.fileSize || 0;
    const fileType = attachment.fileType || '';
    const fileName = attachment.fileName || '';
    
    // Always use background for specific file types
    if (this.thresholds.alwaysBackgroundTypes.includes(fileType)) {
      return {
        immediate: 'background',
        shouldQueue: true,
        reason: `File type ${fileType} always uses background decryption`
      };
    }

    // Categorize by file type and size
    if (this.isImageFile(fileType)) {
      if (fileSize > this.thresholds.imageSizeLimit) {
        return {
          immediate: 'background',
          shouldQueue: true,
          reason: `Large image (${this.formatFileSize(fileSize)}) uses background decryption`
        };
      } else {
        return {
          immediate: 'lazy',
          shouldQueue: false,
          reason: `Small image (${this.formatFileSize(fileSize)}) uses immediate lazy decryption`
        };
      }
    }

    if (this.isVideoFile(fileType)) {
      if (fileSize > this.thresholds.videoSizeLimit) {
        return {
          immediate: 'background',
          shouldQueue: true,
          reason: `Video file (${this.formatFileSize(fileSize)}) uses background decryption`
        };
      } else {
        return {
          immediate: 'background', // Even small videos use background for better UX
          shouldQueue: true,
          reason: `Video file uses background decryption for smooth playback`
        };
      }
    }

    // Documents and other files
    if (fileSize > this.thresholds.documentSizeLimit) {
      return {
        immediate: 'background',
        shouldQueue: true,
        reason: `Large document (${this.formatFileSize(fileSize)}) uses background decryption`
      };
    }

    // Default: small files use immediate lazy decryption
    return {
      immediate: 'lazy',
      shouldQueue: false,
      reason: `Small file (${this.formatFileSize(fileSize)}) uses immediate lazy decryption`
    };
  }



  /**
   * Update configuration thresholds
   */
  public updateThresholds(newThresholds: Partial<DecryptionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🧠 Updated decryption thresholds:', this.thresholds);
  }

  /**
   * Get current configuration
   */
  public getConfig(): DecryptionThresholds {
    return { ...this.thresholds };
  }

  // Utility methods
  private isImageFile(fileType: string): boolean {
    return fileType.startsWith('image/');
  }

  private isVideoFile(fileType: string): boolean {
    return fileType.startsWith('video/');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Test method to validate strategy for different file types
   */
  public testStrategy(attachments: AttachmentDto[]): void {
    console.log('🧪 Testing decryption strategies:');
    attachments.forEach(attachment => {
      const strategy = this.getDecryptionStrategy(attachment);
      console.log(`📄 ${attachment.fileName} (${this.formatFileSize(attachment.fileSize || 0)}) -> ${strategy.immediate} (${strategy.reason})`);
    });
  }
}