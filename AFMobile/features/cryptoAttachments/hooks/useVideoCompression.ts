import { useState, useCallback } from 'react';
import { VideoCompressionService, CompressionOptions, CompressionResult, CompressionProgress } from '@/features/files/services/VideoCompressionService';
import { RNFile } from '@/utils/files/FileFunctions';

interface CompressionProgressDetails {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  progress: CompressionProgress;
  overallProgress: number;
}

interface UseVideoCompressionReturn {
  compressFiles: (files: RNFile[], options?: CompressionOptions) => Promise<RNFile[]>;
  isCompressing: boolean;
  compressionProgress: CompressionProgressDetails | null;
  error: string | null;
  clearError: () => void;
}

export const useVideoCompression = (): UseVideoCompressionReturn => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgressDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const compressFiles = useCallback(async (
    files: RNFile[], 
    options: CompressionOptions = {}
  ): Promise<RNFile[]> => {
    if (!files || files.length === 0) {
      return files;
    }

    // Filter only video files for compression
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    const nonVideoFiles = files.filter(file => !file.type.startsWith('video/'));

    // If no videos, return original files
    if (videoFiles.length === 0) {
      console.log('No video files to compress');
      return files;
    }

    setIsCompressing(true);
    setError(null);
    setCompressionProgress(null);

    try {
      const compressionService = VideoCompressionService.getInstance();
      
      // Default compression options for chat app use case
      const defaultOptions: CompressionOptions = {
        quality: 'medium',
        minimumFileSizeForCompression: 3 * 1024 * 1024, // 3MB threshold
        compressionMethod: 'auto',
        ...options // User options override defaults
      };

      console.log(`Starting parallel compression for ${videoFiles.length} video files`);

      // Track progress for each file
      const progressTracker = new Map<number, CompressionProgress>();
      
      const updateOverallProgress = (fileIndex: number, progress: CompressionProgress) => {
        progressTracker.set(fileIndex, progress);
        
        // Calculate overall progress from all files
        const totalProgress = Array.from(progressTracker.values())
          .reduce((sum, p) => sum + p.progress, 0);
        const averageProgress = progressTracker.size > 0 ? totalProgress / videoFiles.length : 0;
        
        // Find currently processing file (highest progress that's not 100%)
        const currentFileIndex = Array.from(progressTracker.entries())
          .find(([_, p]) => p.progress < 100 && p.progress > 0)?.[0] ?? fileIndex;
        
        setCompressionProgress({
          fileIndex: currentFileIndex,
          totalFiles: videoFiles.length,
          fileName: videoFiles[currentFileIndex]?.name || 'Processing...',
          progress,
          overallProgress: averageProgress
        });
      };

      // Compress all videos in parallel
      const compressionPromises = videoFiles.map(async (videoFile, index) => {
        try {
          const result = await compressionService.compressVideo(
            videoFile.uri,
            defaultOptions,
            (progress: CompressionProgress) => {
              updateOverallProgress(index, progress);
            }
          );

          console.log(`Compressed ${videoFile.name}: ${Math.round(result.originalSize / 1024)}KB → ${Math.round(result.compressedSize / 1024)}KB (${Math.round(result.compressionRatio * 100)}% reduction)`);

          return {
            ...videoFile,
            uri: result.uri,
            size: result.compressedSize
          };
        } catch (compressionError) {
          console.error(`Failed to compress ${videoFile.name}:`, compressionError);
          // Return original file on compression failure
          return videoFile;
        }
      });

      // Wait for all compressions to complete
      const compressedVideos = await Promise.all(compressionPromises);

      // Combine compressed videos with non-video files, maintaining original order
      const resultFiles: RNFile[] = [];
      let videoIndex = 0;
      let nonVideoIndex = 0;

      for (const originalFile of files) {
        if (originalFile.type.startsWith('video/')) {
          resultFiles.push(compressedVideos[videoIndex]);
          videoIndex++;
        } else {
          resultFiles.push(nonVideoFiles[nonVideoIndex]);
          nonVideoIndex++;
        }
      }

      console.log(`Compression complete: ${videoFiles.length} videos processed`);
      return resultFiles;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Video compression failed';
      console.error('Video compression error:', errorMessage);
      setError(errorMessage);
      
      // Return original files on error (graceful fallback)
      return files;
      
    } finally {
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  }, []);

  return {
    compressFiles,
    isCompressing,
    compressionProgress,
    error,
    clearError
  };
};