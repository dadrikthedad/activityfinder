// services/attachments/ThumbnailService.ts
import { Image } from 'react-native';
import { ThumbnailOptions, ProcessedFileWithThumbnail, ThumbnailResult } from '../types/cryptoThumbnailTypes';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';

export class ThumbnailService {
  private static instance: ThumbnailService;

  private constructor() {}

  public static getInstance(): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService();
    }
    return ThumbnailService.instance;
  }

  /**
   * Check if file type supports thumbnail generation
   */
  supportsThumbnail(fileType: string): boolean {
    const supportedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'image/webp', 'image/gif',
      // Video support
      'video/mp4', 'video/mov', 'video/avi', 
      'video/quicktime', 'video/webm'
    ];
    
    return supportedTypes.includes(fileType.toLowerCase());
  }

  /**
   * Generate thumbnail from image or video file
   */
  async generateThumbnail(
    fileUri: string,
    fileType: string,
    options: ThumbnailOptions = {}
  ): Promise<ThumbnailResult | null> {
    try {
      if (!this.supportsThumbnail(fileType)) {
        return null;
      }

      // Handle video files with expo-video-thumbnails
      if (fileType.startsWith('video/')) {
        return await this.generateVideoThumbnail(fileUri, {
          maxWidth: 320,
          maxHeight: 320,
          quality: 0.8,
          ...options
        });
      }

      // Handle image files
      const {
        maxWidth = 320,
        maxHeight = 320,
        quality = 0.8,
        format = 'jpeg'
      } = options;

      // Get original image dimensions
      const { width: originalWidth, height: originalHeight } = await this.getImageDimensions(fileUri);
      
      // Calculate new dimensions while maintaining aspect ratio
      const { width: newWidth, height: newHeight } = this.calculateThumbnailDimensions(
        originalWidth, 
        originalHeight, 
        maxWidth, 
        maxHeight
      );

      console.log(`Generating image thumbnail: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`);

      // Create thumbnail using expo-image-manipulator
      const thumbnailUri = await this.resizeImage(fileUri, newWidth, newHeight, quality, format);
      
      // Convert to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
        encoding: FileSystem.EncodingType.Base64,
        });
        const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;

      const result: ThumbnailResult = {
        buffer,
        width: newWidth,
        height: newHeight,
        size: buffer.byteLength,
        format: `image/${format}`
      };

      console.log(`Image thumbnail generated: ${newWidth}x${newHeight}, ${Math.round(buffer.byteLength / 1024)}KB`);
      
      return result;

    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * Generate thumbnail from video file using expo-video-thumbnails
   */
  private async generateVideoThumbnail(
  videoUri: string, 
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult | null> {
  try {
    const maxWidth = options.maxWidth || 320;
    const maxHeight = options.maxHeight || 320;
    
    // Array of different time positions to try (in milliseconds)
    const timePositions = [1000, 2000, 5000, 3000, 500];
    
    let thumbnailUri: string | null = null;
    let lastError: Error | null = null;

    // Try different time positions until one works
    for (const timePosition of timePositions) {
      try {
        console.log(`🎥 Trying thumbnail at ${timePosition}ms for ${videoUri}`);
        
        const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: timePosition,
          quality: options.quality || 0.8,
        });
        
        thumbnailUri = result.uri;
        const isValid = await this.isValidThumbnail(thumbnailUri);
          if (!isValid) {
            console.warn(`🎥 Invalid thumbnail detected at ${timePosition}ms, trying next position`);
            continue; // Try next time position
          }
        console.log(`🎥 Success! Generated thumbnail at ${timePosition}ms: ${thumbnailUri}`);
        const thumbnailFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
        console.log(`🎥 Generated thumbnail: exists=${thumbnailFileInfo.exists}, size=${thumbnailFileInfo.exists && 'size' in thumbnailFileInfo ? thumbnailFileInfo.size : 'unknown'}`);
        break;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`🎥 Failed at ${timePosition}ms:`, error);
        continue; // Try next time position
      }
    }

    // If all time positions failed, throw the last error
    if (!thumbnailUri) {
      throw lastError || new Error('Failed to generate thumbnail at any time position');
    }
    
    // Get original thumbnail dimensions
    const { width: originalWidth, height: originalHeight } = await this.getImageDimensions(thumbnailUri);
    
    // Check if thumbnail is valid (not gray/empty)
    // A completely gray thumbnail often has very small file size
    const thumbnailFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
    const thumbnailSizeKB = (thumbnailFileInfo.exists && 'size' in thumbnailFileInfo && thumbnailFileInfo.size) 
      ? thumbnailFileInfo.size / 1024 : 0;
    
    if (thumbnailSizeKB < 1) {
      console.warn(`🎥 Thumbnail seems invalid (${thumbnailSizeKB}KB), might be gray`);
      // Could return null or try alternative approach
    }
    
    // ALWAYS resize video thumbnails to reasonable size
    const { width: newWidth, height: newHeight } = this.calculateThumbnailDimensions(
      originalWidth, 
      originalHeight, 
      maxWidth,
      maxHeight
    );
    
    
    console.log(`🎥 Video thumbnail resize: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`);
    
    // Resize the thumbnail
    const resizedUri = await this.resizeImage(thumbnailUri, newWidth, newHeight, options.quality || 0.8, 'jpeg');

    const resizedFileInfo = await FileSystem.getInfoAsync(resizedUri);
    console.log(`🎥 Resized thumbnail: exists=${resizedFileInfo.exists}, size=${resizedFileInfo.exists && 'size' in resizedFileInfo ? resizedFileInfo.size : 'unknown'}`);  
    
    // Convert to ArrayBuffer using FileSystem
    const base64 = await FileSystem.readAsStringAsync(resizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const testBase64 = base64.substring(0, 100);
    console.log(`🎥 Thumbnail base64 start: ${testBase64}`);
    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
    
    const result: ThumbnailResult = {
      buffer,
      width: newWidth,
      height: newHeight,
      size: buffer.byteLength,
      format: 'image/jpeg'
    };

    console.log(`🎥 Video thumbnail completed: ${newWidth}x${newHeight}, ${Math.round(buffer.byteLength / 1024)}KB`);
    
    return result;
  } catch (error) {
    console.error('Video thumbnail generation failed completely:', error);
    return null;
  }
}

  /**
   * Process file and generate thumbnail if supported
   */
  async processFileWithThumbnail(
    buffer: ArrayBuffer,
    metadata: { name: string; type: string; size: number; uri: string },
    thumbnailOptions?: ThumbnailOptions
  ): Promise<ProcessedFileWithThumbnail> {
    const processedFile: ProcessedFileWithThumbnail = {
      original: { buffer, metadata }
    };

    // Generate thumbnail if file type is supported
    if (this.supportsThumbnail(metadata.type)) {
      try {
        const thumbnail = await this.generateThumbnail(
          metadata.uri, 
          metadata.type, 
          thumbnailOptions
        );
        
        if (thumbnail) {
          processedFile.thumbnail = thumbnail;
          const fileTypeIcon = metadata.type.startsWith('video/') ? '🎥' : '🖼️';
          console.log(`${fileTypeIcon} Thumbnail added to ${metadata.name}: ${thumbnail.width}x${thumbnail.height}`);
        }
      } catch (error) {
        console.warn(`Failed to generate thumbnail for ${metadata.name}:`, error);
        // Continue without thumbnail - not critical
      }
    }

    return processedFile;
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  /**
   * Calculate thumbnail dimensions while maintaining aspect ratio
   */
  private calculateThumbnailDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  /**
   * Resize image using expo-image-manipulator (modern API)
   */
  private async resizeImage(
    uri: string,
    width: number,
    height: number,
    quality: number,
    format: 'jpeg' | 'png'
  ): Promise<string> {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width, height });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: quality,
      format: format === 'jpeg' ? SaveFormat.JPEG : SaveFormat.PNG
    });
    return saved.uri;
  }

  /**
   * Get thumbnail statistics for multiple files
   */
  getThumbnailStats(processedFiles: ProcessedFileWithThumbnail[]): {
    totalFiles: number;
    filesWithThumbnails: number;
    totalOriginalSize: number;
    totalThumbnailSize: number;
    compressionRatio: number;
    imageCount: number;
    videoCount: number;
  } {
    const totalFiles = processedFiles.length;
    const filesWithThumbnails = processedFiles.filter(f => f.thumbnail).length;
    
    const imageCount = processedFiles.filter(f => f.original.metadata.type.startsWith('image/')).length;
    const videoCount = processedFiles.filter(f => f.original.metadata.type.startsWith('video/')).length;
    
    const totalOriginalSize = processedFiles.reduce((sum, file) => {
      return sum + (file.original.metadata.size || 0);
    }, 0);
    
    const totalThumbnailSize = processedFiles.reduce((sum, file) => {
      return sum + (file.thumbnail?.size || 0);
    }, 0);
    
    const compressionRatio = totalOriginalSize > 0 ? totalThumbnailSize / totalOriginalSize : 0;

    return {
      totalFiles,
      filesWithThumbnails,
      totalOriginalSize,
      totalThumbnailSize,
      compressionRatio,
      imageCount,
      videoCount
    };
  }

  /**
   * Check if thumbnail appears to be gray/invalid by analyzing pixel data
   */
  public async isValidThumbnail(thumbnailUri: string): Promise<boolean> {
    try {
      // Read the thumbnail as base64
      const base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Check file size - gray thumbnails are usually very small
      const sizeKB = (base64.length * 3/4) / 1024;
      if (sizeKB < 2) {
        console.warn(`🎥 Thumbnail suspiciously small: ${sizeKB}KB`);
        return false;
      }
      
      // Convert to Uint8Array to analyze pixel data
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Basic check: if most bytes are similar values, it might be gray
      // This is a simple heuristic - gray images have low variance
      const sampleSize = Math.min(1000, bytes.length);
      let sum = 0;
      let sumSquares = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const value = bytes[i];
        sum += value;
        sumSquares += value * value;
      }
      
      const mean = sum / sampleSize;
      const variance = (sumSquares / sampleSize) - (mean * mean);
      
      // Low variance indicates a gray/uniform image
      const isValid = variance > 100; // Threshold may need adjustment
      
      console.log(`🎥 Thumbnail analysis: size=${sizeKB}KB, variance=${variance.toFixed(2)}, valid=${isValid}`);
      
      return isValid;
      
    } catch (error) {
      console.warn('Failed to analyze thumbnail validity:', error);
      return true; // Assume valid if we can't analyze
    }
  }
}