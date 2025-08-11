// utils/video/VideoThumbnailUtils.ts Avansert videothumbnail system. Må implimenteres i VidoeViewer
import { VideoThumbnails } from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { Video } from 'expo-av';

export interface VideoThumbnailOptions {
  time?: number; // Time in milliseconds to extract thumbnail from
  quality?: number; // 0.0 to 1.0
}

export interface VideoThumbnailResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Generate thumbnail from video file
 */
export const generateVideoThumbnail = async (
  videoUri: string,
  options: VideoThumbnailOptions = {}
): Promise<VideoThumbnailResult | null> => {
  try {
    const { time = 1000, quality = 0.7 } = options;
    
    const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(
      videoUri,
      {
        time,
        quality,
      }
    );

    return { uri, width, height };
  } catch (error) {
    console.warn('Failed to generate video thumbnail:', error);
    return null;
  }
};

/**
 * Cache video thumbnail with persistent storage
 */
export const getCachedVideoThumbnail = async (
  videoUri: string,
  options: VideoThumbnailOptions = {}
): Promise<string | null> => {
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = `${FileSystem.cacheDirectory}video_thumbnails/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    // Generate cache key from video URI and options
    const cacheKey = generateCacheKey(videoUri, options);
    const cachedPath = `${cacheDir}${cacheKey}.jpg`;
    
    // Check if thumbnail already exists
    const cachedInfo = await FileSystem.getInfoAsync(cachedPath);
    if (cachedInfo.exists) {
      return cachedPath;
    }

    // Generate new thumbnail
    const thumbnail = await generateVideoThumbnail(videoUri, options);
    if (!thumbnail) return null;

    // Copy to cache
    await FileSystem.copyAsync({
      from: thumbnail.uri,
      to: cachedPath,
    });

    // Clean up temporary file
    await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true });

    return cachedPath;
  } catch (error) {
    console.warn('Failed to cache video thumbnail:', error);
    return null;
  }
};

/**
 * Generate cache key for video thumbnail
 */
const generateCacheKey = (videoUri: string, options: VideoThumbnailOptions): string => {
  const { time = 1000, quality = 0.7 } = options;
  const uriHash = videoUri.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'unknown';
  return `${uriHash}_${time}_${Math.round(quality * 100)}`;
};

/**
 * Clear thumbnail cache
 */
export const clearThumbnailCache = async (): Promise<void> => {
  try {
    const cacheDir = `${FileSystem.cacheDirectory}video_thumbnails/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to clear thumbnail cache:', error);
  }
};

/**
 * Hook for managing video thumbnails
 */
import { useState, useEffect } from 'react';

export const useVideoThumbnail = (videoUri: string, options: VideoThumbnailOptions = {}) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadThumbnail = async () => {
      if (!videoUri) return;

      setIsLoading(true);
      setError(null);

      try {
        const cachedThumbnail = await getCachedVideoThumbnail(videoUri, options);
        
        if (isMounted) {
          setThumbnailUri(cachedThumbnail);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load thumbnail');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      isMounted = false;
    };
  }, [videoUri, options.time, options.quality]);

  return { thumbnailUri, isLoading, error };
};