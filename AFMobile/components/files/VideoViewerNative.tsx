// components/common/VideoViewerNative.tsx - Modal-agnostic
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  StatusBar,
  PanResponder,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Play, Pause, RefreshCcw } from 'lucide-react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { RNFile } from '@/utils/files/FileFunctions';
import ViewerHeaderNative from './ViewerHeaderNative';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/toast/NotificationToastNative';

interface VideoViewerContentProps {
  videos: RNFile[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  onShare?: (file: RNFile) => void;
  useModal?: boolean; // NEW: Control whether to use Modal behavior
}

interface VideoViewerNativeProps extends VideoViewerContentProps {
  visible: boolean;
}

// Core content component - can be used in Modal or Screen
const VideoViewerContent: React.FC<VideoViewerContentProps> = ({
  videos,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
  useModal = true // Default to Modal behavior for backwards compatibility
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  
  // Drag state - consolidated into single object
  const [dragState, setDragState] = useState({
    isDragging: false,
    position: 0,
    wasPlaying: false,
    startPageX: 0,
    startPosition: 0,
  });
  
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  if (videos.length === 0) return null;
  
  const currentVideo = videos[currentIndex];
  const hasMultiple = videos.length > 1;
  const displayPosition = dragState.isDragging ? dragState.position : position;
  const isNearEnd = displayPosition >= duration * 0.95 && duration > 0;

  // Orientation handling - only for Modal usage
  useEffect(() => {
    if (useModal) {
      // Unlock rotation when viewer opens (Modal behavior)
      ScreenOrientation.unlockAsync();
      
      // Listen to orientation changes
      const subscription = ScreenOrientation.addOrientationChangeListener(() => {
        const { width, height } = Dimensions.get('window');
        setDimensions({ width, height });
      });

      return () => subscription?.remove();
    } else {
      // For Screen usage, just listen to dimension changes
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setDimensions({ width: window.width, height: window.height });
      });

      return () => subscription?.remove();
    }
  }, [useModal]);

  // Auto-hide controls when playing
  useEffect(() => {
    if (isPlaying && showControls && !dragState.isDragging && !isNearEnd) {
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [isPlaying, showControls, dragState.isDragging, isNearEnd]);

  // Consolidated timeout management - simplified since useEffect handles auto-hide
  const manageControlsTimeout = (show: boolean) => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    setShowControls(show);
  };

  // Handle video status updates - simplified
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status) {
        console.error('Video playback error:', status.error);
        Alert.alert('Error', 'Could not load video');
      }
      return;
    }

    // Always update duration, even during dragging
    if (status.durationMillis) {
      setDuration(status.durationMillis);
    }

    // Skip position updates during dragging to prevent bouncing
    if (dragState.isDragging) return;

    const wasPlaying = isPlaying;
    const nowPlaying = status.isPlaying || false;
    
    setIsPlaying(nowPlaying);
    setPosition(status.positionMillis || 0);
    
    // Handle play state changes
    if (status.didJustFinish) {
      manageControlsTimeout(true);
    } else if (!wasPlaying && nowPlaying) {
      manageControlsTimeout(true);
    } else if (wasPlaying && !nowPlaying) {
      manageControlsTimeout(true);
    }
  };

  // Toggle play/pause with restart functionality
  const togglePlayPause = async () => {
    if (!videoRef.current || dragState.isDragging) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
      manageControlsTimeout(true);
    } else {
      if (isNearEnd) {
        await videoRef.current.setPositionAsync(0);
        setPosition(0);
      }
      await videoRef.current.playAsync();
      manageControlsTimeout(true);
    }
  };

  // Pan responder for seeking
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => 
      Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
    
    onPanResponderGrant: async (event) => {
      if (duration <= 0 || progressBarWidth <= 0) return;
      
      const { pageX } = event.nativeEvent;
      
      setDragState({
        isDragging: true,
        position: position,
        wasPlaying: isPlaying,
        startPageX: pageX,
        startPosition: position,
      });
      
      manageControlsTimeout(true);
      
      if (isPlaying && videoRef.current) {
        await videoRef.current.pauseAsync();
      }
    },
    
    onPanResponderMove: (event) => {
      if (!dragState.isDragging || duration <= 0 || progressBarWidth <= 0) return;
      
      const deltaX = event.nativeEvent.pageX - dragState.startPageX;
      const deltaProgress = deltaX / progressBarWidth;
      const deltaTime = deltaProgress * duration;
      const newPosition = Math.max(0, Math.min(duration, dragState.startPosition + deltaTime));
      
      setDragState(prev => ({ ...prev, position: newPosition }));
    },
    
    onPanResponderRelease: async () => {
      if (!dragState.isDragging) return;
      
      const finalPosition = dragState.position;
      const shouldResume = dragState.wasPlaying;
      
      // Update position immediately to prevent bouncing
      setPosition(finalPosition);
      
      // Clear drag state
      setDragState({
        isDragging: false,
        position: 0,
        wasPlaying: false,
        startPageX: 0,
        startPosition: 0,
      });
      
      // Update video position
      if (videoRef.current && finalPosition >= 0) {
        await videoRef.current.setPositionAsync(finalPosition);
        
        if (shouldResume) {
          await videoRef.current.playAsync();
          manageControlsTimeout(true);
        } else {
          manageControlsTimeout(true);
        }
      }
    },
    
    onPanResponderTerminate: () => {
      setDragState({
        isDragging: false,
        position: 0,
        wasPlaying: false,
        startPageX: 0,
        startPosition: 0,
      });
    },
  });

  // Handle progress bar tap
  const handleProgressBarTap = async (event: any) => {
    if (dragState.isDragging || duration <= 0 || progressBarWidth <= 0) return;
    
    const { locationX } = event.nativeEvent;
    const clampedLocationX = Math.max(0, Math.min(progressBarWidth, locationX));
    const progress = clampedLocationX / progressBarWidth;
    const newPosition = Math.max(0, Math.min(duration, progress * duration));
    
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(newPosition);
      setPosition(newPosition);
    }
    
    manageControlsTimeout(true);
  };

  // Navigation functions
  const navigateVideo = (direction: 'next' | 'prev') => {
    if (!hasMultiple) return;
    
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % videos.length
      : (currentIndex - 1 + videos.length) % videos.length;
    
    // Reset all state for new video
    setCurrentIndex(newIndex);
    setIsPlaying(false);
    setPosition(0);
    setDragState({
      isDragging: false,
      position: 0,
      wasPlaying: false,
      startPageX: 0,
      startPosition: 0,
    });
    manageControlsTimeout(true);
  };

  // Smart screen tap for UI toggle
  const handleScreenTap = () => {
    if (dragState.isDragging) return;
    
    // Simply toggle controls visibility
    manageControlsTimeout(!showControls);
  };

  // Format time helper
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle close with orientation locking for Modal
  const handleClose = async () => {
    if (useModal) {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (error) {
        console.warn('Failed to lock orientation:', error);
      }
    }
    onClose();
  };

  // Reset state when video changes
  useEffect(() => {
    setPosition(0);
    setIsPlaying(false);
    setDragState({
      isDragging: false,
      position: 0,
      wasPlaying: false,
      startPageX: 0,
      startPosition: 0,
    });
    manageControlsTimeout(true);
  }, [currentIndex]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  const content = (
    <View style={styles.container}>
      {/* Background - clickable for UI toggle */}
      <TouchableOpacity 
        style={styles.background}
        onPress={handleScreenTap}
        activeOpacity={1}
      >
        <View style={styles.videoContainer}>
          <TouchableOpacity 
            style={styles.videoTouchable}
            onPress={handleScreenTap}
            activeOpacity={1}
          >
            <Video
              ref={videoRef}
              source={{ uri: currentVideo.uri }}
              style={[styles.video, { width: dimensions.width, height: dimensions.height }]}
              resizeMode={ResizeMode.CONTAIN}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              progressUpdateIntervalMillis={100}
              positionMillis={0}
              shouldPlay={false}
              isLooping={false}
              useNativeControls={false}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Controls Overlay */}
      {showControls && (
        <>
          <ViewerHeaderNative
            title={currentVideo.name}
            subtitle={hasMultiple ? `${currentIndex + 1} of ${videos.length}` : undefined}
            onClose={handleClose}
            onDownload={onDownload}
            currentFile={currentVideo}
            onShare={onShare}
          />

          {/* Progress Bar with Play/Pause Button */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>
              {formatTime(displayPosition)}
            </Text>
            
            <View 
              style={styles.progressBarTouchable}
              {...panResponder.panHandlers}
              onLayout={(event) => setProgressBarWidth(event.nativeEvent.layout.width)}
            >
              <TouchableOpacity 
                style={styles.progressBarTap}
                onPress={handleProgressBarTap}
                activeOpacity={1}
                disabled={dragState.isDragging}
              >
                <View style={styles.progressBar}>
                  <View style={styles.progressTrack} />
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${duration > 0 ? (displayPosition / duration) * 100 : 0}%` }
                    ]} 
                  />
                  <View
                    style={[
                      styles.progressThumb,
                      dragState.isDragging && styles.progressThumbActive,
                      { left: `${duration > 0 ? (displayPosition / duration) * 100 : 0}%` }
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.timeText}>{formatTime(duration)}</Text>

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              {duration === 0 ? (
                <Text style={styles.loadingText}>⏳</Text>
              ) : isPlaying ? (
                <Pause size={24} color="white" />
              ) : isNearEnd ? (
                <RefreshCcw size={24} color="white" />
              ) : (
                <Play size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {/* Navigation */}
          {hasMultiple && (
            <>
              <TouchableOpacity
                style={[styles.navButton, styles.navLeft]}
                onPress={() => navigateVideo('prev')}
              >
                <Text style={styles.navText}>‹</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.navButton, styles.navRight]}
                onPress={() => navigateVideo('next')}
              >
                <Text style={styles.navText}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Center Restart Button - shown when video is finished */}
      {isNearEnd && !isPlaying && (
        <TouchableOpacity
          style={styles.centerRestartButton}
          onPress={togglePlayPause}
        >
          <RefreshCcw size={48} color="white" />
        </TouchableOpacity>
      )}

      {/* Toast - only for Modal usage */}
      {useModal && <Toast config={toastConfig} />}
    </View>
  );

  return content;
};

// Modal wrapper for backwards compatibility
export default function VideoViewerNative({
  visible,
  videos,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare
}: VideoViewerNativeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <VideoViewerContent
        videos={videos}
        initialIndex={initialIndex}
        onClose={onClose}
        onDownload={onDownload}
        onShare={onShare}
        useModal={true}
      />
    </Modal>
  );
}

// Export content component for use in screens
export { VideoViewerContent };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    backgroundColor: 'black',
  },
  playPauseButton: {
    width: 36,
    height: 36,
    backgroundColor: '#1C6B1C',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  loadingText: {
    fontSize: 16,
    color: 'white',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 20,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 64,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    minWidth: 35,
    textAlign: 'center',
    lineHeight: 16,
    height: 16,
  },
  progressBarTouchable: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  progressBarTap: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  progressBar: {
    height: 4,
    justifyContent: 'center',
    position: 'relative',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#1C6B1C',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    backgroundColor: '#1C6B1C',
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: 'white',
  },
  progressThumbActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    top: -8,
    borderWidth: 3,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
  },
  navLeft: {
    left: 16,
  },
  navRight: {
    right: 16,
  },
  navText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  centerRestartButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    backgroundColor: '#1C6B1C',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
    marginLeft: -40,
  },
});