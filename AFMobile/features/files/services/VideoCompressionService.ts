// services/video/VideoCompressionService.ts
import { Video } from 'react-native-compressor';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export interface CompressionOptions {
  compressionMethod?: 'auto' | 'manual';
  maxWidth?: number;
  maxHeight?: number;
  bitrate?: number;
  quality?: 'low' | 'medium' | 'high';
  minimumFileSizeForCompression?: number; // Don't compress files smaller than this (bytes)
}

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface VideoMetadata {
  duration: number; // in seconds
  dimensions: VideoDimensions;
  bitrate?: number;
  fps?: number;
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // 0-1, where 0.5 means 50% reduction
  duration: number; // compression time in ms
  originalDimensions: VideoDimensions;
  compressedDimensions: VideoDimensions;
  originalMetadata?: VideoMetadata;
}

export interface CompressionProgress {
  progress: number; // 0-100
  stage: 'analyzing' | 'loading_metadata' | 'compressing' | 'finalizing';
}

export class VideoCompressionService {
  private static instance: VideoCompressionService;
  private activeCancellationIds = new Set<string>();

  private constructor() {}

  public static getInstance(): VideoCompressionService {
    if (!VideoCompressionService.instance) {
      VideoCompressionService.instance = new VideoCompressionService();
    }
    return VideoCompressionService.instance;
  }

  /**
   * Get video metadata using expo-media-library for accurate information
   * Falls back to file-system estimation if media-library fails
   */
  private async getVideoMetadata(videoUri: string): Promise<VideoMetadata | null> {
    try {
      // First, try to get accurate metadata from media library
      if (videoUri.startsWith('ph://') || videoUri.includes('DCIM') || videoUri.includes('Camera')) {
        try {
          const asset = await MediaLibrary.getAssetInfoAsync(videoUri);
          if (asset && asset.mediaType === MediaLibrary.MediaType.video) {
            console.log(`📹 Got accurate metadata from media library`);
            return {
              duration: asset.duration || 0,
              dimensions: {
                width: asset.width || 0,
                height: asset.height || 0,
              },
              // Note: bitrate and fps not available from media library
              fps: 30, // Common default
            };
          }
        } catch (error) {
          console.warn('Media library access failed, falling back to estimation:', error);
        }
      }

      // Fallback to file-system with estimation
      const fileInfo = await FileSystem.getInfoAsync(videoUri, { size: true });
      
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      const fileSizeBytes = fileInfo.size || 0;
      const estimatedMetadata = this.estimateVideoMetadata(fileSizeBytes, videoUri);
      
      console.log(`📹 Using estimated metadata: ${Math.round(fileSizeBytes / 1024 / 1024)}MB`);
      return estimatedMetadata;

    } catch (error) {
      console.warn('Failed to get any video metadata:', error);
      return null;
    }
  }

  /**
   * Estimate video metadata based on file size and naming patterns
   * This is a fallback when actual metadata isn't available
   */
  private estimateVideoMetadata(fileSizeBytes: number, videoUri: string): VideoMetadata {
    // Estimate dimensions based on file size (rough heuristic)
    let estimatedWidth = 1280;
    let estimatedHeight = 720;
    
    // Check filename for resolution hints
    const filename = videoUri.toLowerCase();
    if (filename.includes('4k') || filename.includes('2160')) {
      estimatedWidth = 3840;
      estimatedHeight = 2160;
    } else if (filename.includes('1080') || filename.includes('fhd')) {
      estimatedWidth = 1920;
      estimatedHeight = 1080;
    } else if (filename.includes('720') || filename.includes('hd')) {
      estimatedWidth = 1280;
      estimatedHeight = 720;
    } else if (filename.includes('480') || filename.includes('sd')) {
      estimatedWidth = 854;
      estimatedHeight = 480;
    } else {
      // Estimate based on file size (very rough)
      const sizeMB = fileSizeBytes / (1024 * 1024);
      if (sizeMB > 100) {
        estimatedWidth = 1920;
        estimatedHeight = 1080;
      } else if (sizeMB > 50) {
        estimatedWidth = 1280;
        estimatedHeight = 720;
      } else if (sizeMB < 10) {
        estimatedWidth = 854;
        estimatedHeight = 480;
      }
    }
    
    // Estimate duration based on file size and assumed bitrate
    // Very rough estimation: assume 2Mbps average bitrate for mobile videos
    const assumedBitrateKbps = 2000;
    const estimatedDurationSeconds = (fileSizeBytes * 8) / (assumedBitrateKbps * 1024);
    
    return {
      duration: Math.max(estimatedDurationSeconds, 1), // At least 1 second
      dimensions: {
        width: estimatedWidth,
        height: estimatedHeight,
      },
      bitrate: assumedBitrateKbps * 1000, // Convert to bps
      fps: 30, // Common default
    };
  }

  /**
   * Check and request media library permissions
   */
  async requestMediaPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.warn('Failed to request media permissions:', error);
      return false;
    }
  }

  /**
   * Check if video needs compression based on file size
   */
  shouldCompress(fileSizeBytes: number, options: CompressionOptions = {}): boolean {
    const minSize = options.minimumFileSizeForCompression || 5 * 1024 * 1024; // 5MB default
    return fileSizeBytes >= minSize;
  }

  /**
   * Get optimal compression settings based on file size, metadata, and device capabilities
   */
  private getOptimalSettings(
    fileSizeBytes: number, 
    metadata: VideoMetadata | null, 
    options: CompressionOptions
  ): CompressionOptions {
    const size = fileSizeBytes;
    
    // Determine quality based on file size if not specified
    let quality = options.quality;
    if (!quality) {
      if (size > 50 * 1024 * 1024) { // > 50MB
        quality = 'low';
      } else if (size > 20 * 1024 * 1024) { // > 20MB  
        quality = 'medium';
      } else {
        quality = 'high';
      }
    }

    // Set dimensions based on quality, but respect original dimensions
    const baseDimensionSettings = {
      low: { maxWidth: 854, maxHeight: 480 }, // 480p
      medium: { maxWidth: 1280, maxHeight: 720 }, // 720p
      high: { maxWidth: 1920, maxHeight: 1080 }, // 1080p
    };

    let finalSettings = baseDimensionSettings[quality];

    // If we have metadata, don't upscale
    if (metadata?.dimensions) {
      finalSettings = {
        maxWidth: Math.min(finalSettings.maxWidth, metadata.dimensions.width),
        maxHeight: Math.min(finalSettings.maxHeight, metadata.dimensions.height),
      };
    }

    return {
      compressionMethod: 'auto', // Let react-native-compressor optimize
      ...finalSettings,
      ...options, // User options override defaults
      quality,
    };
  }

  /**
   * Compress video with progress tracking and metadata extraction
   */
  async compressVideo(
    videoUri: string,
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    let originalMetadata: VideoMetadata | null = null;
    
    try {
      onProgress?.({ progress: 0, stage: 'analyzing' });

      // Get original file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri, { size: true });
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      const originalSize = 'size' in fileInfo ? fileInfo.size || 0 : 0;
      
      // Check if compression is needed
      if (!this.shouldCompress(originalSize, options)) {
        console.log(`📹 Video too small for compression (${Math.round(originalSize / 1024)}KB), skipping`);
        
        // Still try to get metadata for small videos
        try {
          originalMetadata = await this.getVideoMetadata(videoUri);
        } catch (error) {
          console.warn('Failed to get metadata for small video:', error);
        }
        
        // Return original file as "compressed" result
        return {
          uri: videoUri,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          duration: Date.now() - startTime,
          originalDimensions: originalMetadata?.dimensions || { width: 0, height: 0 },
          compressedDimensions: originalMetadata?.dimensions || { width: 0, height: 0 },
          originalMetadata: originalMetadata || undefined,
        };
      }

      onProgress?.({ progress: 5, stage: 'loading_metadata' });

      // Get video metadata with media-library priority
      try {
        originalMetadata = await this.getVideoMetadata(videoUri);
        if (originalMetadata) {
          const metadataType = originalMetadata.bitrate ? 'accurate' : 'estimated';
          console.log(`📹 ${metadataType} metadata: ${originalMetadata.dimensions.width}x${originalMetadata.dimensions.height}, ${Math.round(originalMetadata.duration)}s`);
        }
      } catch (error) {
        console.warn('Failed to get video metadata:', error);
        originalMetadata = null;
      }

      // Get optimal settings with metadata
      const finalOptions = this.getOptimalSettings(originalSize, originalMetadata, options);
      
      console.log(`📹 Compressing video: ${Math.round(originalSize / 1024 / 1024)}MB with ${finalOptions.quality} quality`);
      console.log(`📹 Target dimensions: ${finalOptions.maxWidth}x${finalOptions.maxHeight}`);

      onProgress?.({ progress: 15, stage: 'compressing' });

      let cancellationId = '';
      
      // Compress with react-native-compressor
      const compressedUri = await Video.compress(
        videoUri,
        {
          compressionMethod: finalOptions.compressionMethod,
          // Note: react-native-compressor uses different parameter names
          ...(finalOptions.compressionMethod === 'manual' && {
            maxWidth: finalOptions.maxWidth,
            maxHeight: finalOptions.maxHeight,
            bitrate: finalOptions.bitrate,
          }),
          minimumFileSizeForCompress: finalOptions.minimumFileSizeForCompression,
          getCancellationId: (id) => {
            cancellationId = id;
            this.activeCancellationIds.add(id);
          },
        },
        (progress) => {
          // Map 0-1 progress to 15-90 range (reserve 0-15 for setup, 90-100 for finalizing)
          const mappedProgress = 15 + (progress * 75);
          onProgress?.({ progress: mappedProgress, stage: 'compressing' });
        }
      );

      // Clean up cancellation ID
      this.activeCancellationIds.delete(cancellationId);

      onProgress?.({ progress: 90, stage: 'finalizing' });

      // Get compressed file info
      const compressedFileInfo = await FileSystem.getInfoAsync(compressedUri, { size: true });
      const compressedSize = compressedFileInfo.exists && 'size' in compressedFileInfo 
        ? compressedFileInfo.size || 0 
        : 0;
      
      const compressionRatio = originalSize > 0 ? 1 - (compressedSize / originalSize) : 0;
      const duration = Date.now() - startTime;

      onProgress?.({ progress: 100, stage: 'finalizing' });

      const result: CompressionResult = {
        uri: compressedUri,
        originalSize,
        compressedSize,
        compressionRatio,
        duration,
        originalDimensions: originalMetadata?.dimensions || { width: 0, height: 0 },
        compressedDimensions: { 
          width: finalOptions.maxWidth || 0, 
          height: finalOptions.maxHeight || 0 
        },
        originalMetadata: originalMetadata || undefined,
      };

      console.log(`📹 Compression complete: ${Math.round(originalSize / 1024)}KB → ${Math.round(compressedSize / 1024)}KB (${Math.round(compressionRatio * 100)}% reduction) in ${duration}ms`);
      if (originalMetadata) {
        console.log(`📹 Dimensions: ${result.originalDimensions.width}x${result.originalDimensions.height} → ${result.compressedDimensions.width}x${result.compressedDimensions.height}`);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('📹 Video compression failed:', error);
      
      // Return original video if compression fails (graceful fallback)
      const fileInfo = await FileSystem.getInfoAsync(videoUri, { size: true });
      const originalSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;
      
      return {
        uri: videoUri, // Fallback to original
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        duration,
        originalDimensions: originalMetadata?.dimensions || { width: 0, height: 0 },
        compressedDimensions: originalMetadata?.dimensions || { width: 0, height: 0 },
        originalMetadata: originalMetadata || undefined,
      };
    }
  }

  /**
   * Cancel ongoing compression
   */
  cancelCompression(cancellationId?: string): boolean {
    try {
      if (cancellationId && this.activeCancellationIds.has(cancellationId)) {
        Video.cancelCompression(cancellationId);
        this.activeCancellationIds.delete(cancellationId);
        console.log(`📹 Cancelled compression: ${cancellationId}`);
        return true;
      }
      
      // Cancel all active compressions if no specific ID provided
      if (!cancellationId && this.activeCancellationIds.size > 0) {
        this.activeCancellationIds.forEach(id => {
          Video.cancelCompression(id);
        });
        this.activeCancellationIds.clear();
        console.log(`📹 Cancelled all active compressions`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to cancel compression:', error);
      return false;
    }
  }

  /**
   * Get compression stats and recommendations
   */
  getCompressionRecommendation(fileSizeBytes: number, metadata?: VideoMetadata): {
    shouldCompress: boolean;
    recommendedQuality: 'low' | 'medium' | 'high';
    estimatedOutputSize: number;
    estimatedSavings: number;
    reasoning: string;
  } {
    const shouldCompress = this.shouldCompress(fileSizeBytes);
    
    if (!shouldCompress) {
      return {
        shouldCompress: false,
        recommendedQuality: 'high',
        estimatedOutputSize: fileSizeBytes,
        estimatedSavings: 0,
        reasoning: 'File is too small to benefit from compression',
      };
    }

    // Estimate compression ratios based on quality
    const compressionRatios = {
      low: 0.7, // 70% size reduction
      medium: 0.5, // 50% size reduction  
      high: 0.3, // 30% size reduction
    };

    let recommendedQuality: 'low' | 'medium' | 'high' = 'medium';
    let reasoning = '';
    
    if (fileSizeBytes > 50 * 1024 * 1024) {
      recommendedQuality = 'low';
      reasoning = 'Large file size requires aggressive compression';
    } else if (fileSizeBytes > 20 * 1024 * 1024) {
      recommendedQuality = 'medium';
      reasoning = 'Medium file size allows balanced compression';
    } else {
      recommendedQuality = 'high';
      reasoning = 'Smaller file can maintain higher quality';
    }

    // Adjust based on video dimensions if available
    if (metadata?.dimensions) {
      const { width, height } = metadata.dimensions;
      const totalPixels = width * height;
      
      if (totalPixels > 2073600) { // > 1080p
        recommendedQuality = 'low';
        reasoning += ' (high resolution detected)';
      } else if (totalPixels < 921600) { // < 720p
        recommendedQuality = 'high';
        reasoning += ' (lower resolution allows higher quality)';
      }
    }

    const compressionRatio = compressionRatios[recommendedQuality];
    const estimatedOutputSize = Math.round(fileSizeBytes * (1 - compressionRatio));
    const estimatedSavings = fileSizeBytes - estimatedOutputSize;

    return {
      shouldCompress: true,
      recommendedQuality,
      estimatedOutputSize,
      estimatedSavings,
      reasoning,
    };
  }

  /**
   * Batch compress multiple videos
   */
  async compressMultipleVideos(
    videoUris: string[],
    options: CompressionOptions = {},
    onProgress?: (overallProgress: number, currentVideoIndex: number, videoProgress: CompressionProgress) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (let i = 0; i < videoUris.length; i++) {
      const videoUri = videoUris[i];
      
      try {
        const result = await this.compressVideo(
          videoUri,
          options,
          (videoProgress) => {
            const overallProgress = ((i / videoUris.length) * 100) + ((videoProgress.progress / videoUris.length));
            onProgress?.(overallProgress, i, videoProgress);
          }
        );
        
        results.push(result);
      } catch (error) {
        console.error(`Failed to compress video ${i + 1}/${videoUris.length}:`, error);
        
        // Add fallback result for failed compression
        const fileInfo = await FileSystem.getInfoAsync(videoUri, { size: true });
        const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;
        
        results.push({
          uri: videoUri,
          originalSize: size,
          compressedSize: size,
          compressionRatio: 0,
          duration: 0,
          originalDimensions: { width: 0, height: 0 },
          compressedDimensions: { width: 0, height: 0 },
        });
      }
    }
    
    return results;
  }

  /**
   * Clean up temporary compressed files
   */
  async cleanupTempFiles(compressedUris: string[]): Promise<void> {
    for (const uri of compressedUris) {
      try {
        // Only delete files in temp directories to avoid deleting original files
        if (uri.includes('tmp') || uri.includes('cache') || uri.includes('compressed')) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          console.log(`📹 Cleaned up temp file: ${uri}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${uri}:`, error);
      }
    }
  }
}