// features/cryptoAttachments/hooks/useThumbnailGenerator.ts - Updated with UnifiedCacheManager
import { useState } from 'react';
import { RNFile } from '@/utils/files/FileFunctions';
import { ThumbnailService } from '@/features/cryptoAttachments/services/ThumbnailService';
import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';

export interface ThumbnailData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  mimeType: string;
}

export interface GeneratedThumbnail {
  uri: string; // Base64 data URI or file URI
  width: number;
  height: number;
}

export interface ThumbnailGenerationResult {
  thumbnails: Map<string, GeneratedThumbnail>; // fileUri -> thumbnail info
  thumbnailData: Map<string, ThumbnailData>; // fileUri -> thumbnail buffer for encryption
}

export function useThumbnailGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateThumbnails = async (files: RNFile[]): Promise<ThumbnailGenerationResult> => {
    const thumbnails = new Map<string, GeneratedThumbnail>();
    const thumbnailData = new Map<string, ThumbnailData>();
    
    if (!files || files.length === 0) {
      return { thumbnails, thumbnailData };
    }

    setIsGenerating(true);
    
    const thumbnailService = ThumbnailService.getInstance();
    
    try {
      await Promise.all(
        files.map(async (file) => {
          // Only generate thumbnails for images and videos
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            return;
          }

          try {
            // Check UnifiedCacheManager for cached thumbnail metadata
            const cachedThumbnail = unifiedCacheManager.getCachedThumbnail(file.uri, file.size);
            
            if (cachedThumbnail) {
              console.log(`🖼️📦 Using cached thumbnail from UnifiedCacheManager for ${file.name}: ${cachedThumbnail.width}x${cachedThumbnail.height}`);
              
              // Store thumbnail info
              thumbnails.set(file.uri, {
                uri: cachedThumbnail.uri,
                width: cachedThumbnail.width,
                height: cachedThumbnail.height,
              });
              
              // Load thumbnail data for encryption
              let buffer: ArrayBuffer;
              if (cachedThumbnail.uri.startsWith('data:')) {
                // Base64 data URI - convert to ArrayBuffer
                const base64Data = cachedThumbnail.uri.split(',')[1];
                const binaryString = atob(base64Data);
                buffer = new ArrayBuffer(binaryString.length);
                const view = new Uint8Array(buffer);
                for (let i = 0; i < binaryString.length; i++) {
                  view[i] = binaryString.charCodeAt(i);
                }
              } else {
                // File URI - load from file (thumbnail stored in temp storage)
                const response = await fetch(cachedThumbnail.uri);
                buffer = await response.arrayBuffer();
              }
              
              thumbnailData.set(file.uri, {
                buffer,
                width: cachedThumbnail.width,
                height: cachedThumbnail.height,
                mimeType: 'image/jpeg'
              });
              
            } else {
              // Generate new thumbnail
              console.log(`🖼️ Generating new thumbnail for ${file.name}`);
              const thumbnail = await thumbnailService.generateThumbnail(file.uri, file.type);
              
              if (thumbnail) {
                // Store thumbnail data for encryption
                thumbnailData.set(file.uri, {
                  buffer: thumbnail.buffer,
                  width: thumbnail.width,
                  height: thumbnail.height,
                  mimeType: 'image/jpeg'
                });
                
                // Store thumbnail file via UnifiedCacheManager
                const thumbnailIdentifier = `${file.uri}_thumbnail`;
                const storedThumbnailPath = await unifiedCacheManager.storeFile(
                  thumbnailIdentifier,
                  thumbnail.buffer,
                  `thumbnail_${file.name}.jpg`,
                  'image/jpeg',
                  true // isThumbnail = true
                );
                
                let thumbnailUri: string;
                if (storedThumbnailPath) {
                  // Use file URI from stored thumbnail
                  thumbnailUri = `file://${storedThumbnailPath}`;
                } else {
                  // Fallback to base64 if storage fails
                  const base64 = btoa(String.fromCharCode(...new Uint8Array(thumbnail.buffer)));
                  thumbnailUri = `data:image/jpeg;base64,${base64}`;
                }
                
                // Store thumbnail info
                thumbnails.set(file.uri, {
                  uri: thumbnailUri,
                  width: thumbnail.width,
                  height: thumbnail.height,
                });
                
                // Cache thumbnail metadata via UnifiedCacheManager
                unifiedCacheManager.cacheThumbnail(
                  file.uri,
                  file.size,
                  thumbnailUri,
                  thumbnail.width,
                  thumbnail.height
                );
                
                console.log(`🖼️ Generated and cached thumbnail via UnifiedCacheManager for ${file.name}: ${thumbnail.width}x${thumbnail.height}`);
              }
            }
          } catch (error) {
            console.warn(`Failed to generate thumbnail for ${file.name}:`, error);
          }
        })
      );
      
      console.log(`🖼️ Generated ${thumbnailData.size} thumbnails via UnifiedCacheManager (cache used where possible)`);
      
    } finally {
      setIsGenerating(false);
    }

    return { thumbnails, thumbnailData };
  };

  // Clear thumbnail cache
  const clearThumbnailCache = async (): Promise<void> => {
    try {
      await unifiedCacheManager.clearCache('thumbnails');
      console.log('🖼️🧹 Thumbnail cache cleared via UnifiedCacheManager');
    } catch (error) {
      console.warn('Failed to clear thumbnail cache:', error);
    }
  };

  // Get thumbnail cache statistics
  const getThumbnailCacheStats = async () => {
    try {
      const stats = await unifiedCacheManager.getStorageStats();
      return {
        thumbnailMetadata: stats.cache.thumbnails,
        thumbnailFiles: {
          // Thumbnails are stored in temp storage
          totalFiles: stats.temp.totalFiles,
          totalSize: stats.temp.totalSize
        },
        cacheHealth: stats.health.overall
      };
    } catch (error) {
      console.warn('Failed to get thumbnail cache stats:', error);
      return null;
    }
  };

  return {
    generateThumbnails,
    isGenerating,
    clearThumbnailCache,
    getThumbnailCacheStats
  };
}