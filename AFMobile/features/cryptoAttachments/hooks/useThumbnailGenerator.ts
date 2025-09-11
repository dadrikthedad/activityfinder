// features/cryptoAttachments/hooks/useThumbnailGenerator.ts - Fixed cache key for videos
import { useState } from 'react';
import { RNFile } from '@/utils/files/FileFunctions';
import { ThumbnailService } from '@/features/cryptoAttachments/services/ThumbnailService';
import { ThumbnailCacheService } from '@/features/cryptoAttachments/services/ThumbnailCacheService';

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
    const thumbnailCacheService = ThumbnailCacheService.getInstance();
    
    try {
      await Promise.all(
        files.map(async (file) => {
          // Only generate thumbnails for images and videos
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            return;
          }

          try {
            // Check cache first - FIX: Use file.uri directly, not a generated key
            const cachedThumbnail = thumbnailCacheService.getCachedThumbnail(file.uri, file.size);
            
            if (cachedThumbnail) {
              console.log(`🖼️📦 Using cached thumbnail for ${file.name}: ${cachedThumbnail.width}x${cachedThumbnail.height}`);
              
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
                // File URI - load from file
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
                
                // Create base64 for display
                const base64 = btoa(String.fromCharCode(...new Uint8Array(thumbnail.buffer)));
                const thumbnailUri = `data:image/jpeg;base64,${base64}`;
                
                // Store thumbnail info
                thumbnails.set(file.uri, {
                  uri: thumbnailUri,
                  width: thumbnail.width,
                  height: thumbnail.height,
                });
                
                // FIX: Cache with correct key - use file.uri directly
                thumbnailCacheService.cacheThumbnail(
                  file.uri,
                  file.size,
                  thumbnailUri,
                  thumbnail.width,
                  thumbnail.height
                );
                
                console.log(`🖼️ Generated and cached thumbnail for ${file.name}: ${thumbnail.width}x${thumbnail.height}`);
              }
            }
          } catch (error) {
            console.warn(`Failed to generate thumbnail for ${file.name}:`, error);
          }
        })
      );
      
      console.log(`🖼️ Generated ${thumbnailData.size} thumbnails (cache used where possible)`);
      
    } finally {
      setIsGenerating(false);
    }

    return { thumbnails, thumbnailData };
  };

  return {
    generateThumbnails,
    isGenerating
  };
}