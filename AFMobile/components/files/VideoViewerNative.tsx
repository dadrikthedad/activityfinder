// components/common/VideoViewerNative.tsx - Migrated to expo-video
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
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { useEventListener } from 'expo';
import { Play, Pause, RefreshCcw, Hourglass } from 'lucide-react-native';
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
  useModal?: boolean;
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
  useModal = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  
  // State for tracking current position from timeUpdate
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [lastSeekTime, setLastSeekTime] = useState<number | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    position: 0,
    wasPlaying: false,
    startPageX: 0,
    startPosition: 0,
  });
  
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  if (videos.length === 0) return null;
  
  const currentVideo = videos[currentIndex];
  const hasMultiple = videos.length > 1;

  // Create video player - use replace() to change videos
  const player = useVideoPlayer(currentVideo.uri as VideoSource, (player) => {
    // Configure player
    player.loop = false;
    player.muted = false;
    player.timeUpdateEventInterval = 0.1; // Update every 100ms for smooth progress
  });

  // Replace video source when currentIndex changes (but not on initial load)
  useEffect(() => {
    // Skip initial load since player is already created with currentVideo.uri
    if (currentIndex !== initialIndex) {
      const newVideo = videos[currentIndex];
      if (newVideo && player) {
        console.log('Switching to video:', newVideo.name);
        player.replace(newVideo.uri as VideoSource);
      }
    }
  }, [currentIndex, player, initialIndex]);

  // Player state - use state for position instead of direct player access
  const isPlaying = player.playing;
  const duration = player.duration > 0 ? player.duration * 1000 : 0; // Convert to milliseconds, handle NaN
  const position = dragState.isDragging ? dragState.position : currentPlaybackTime;
  const isNearEnd = duration > 0 && position >= duration * 0.95;

  // Orientation handling
  useEffect(() => {
    if (useModal) {
      ScreenOrientation.unlockAsync();
      
      const subscription = ScreenOrientation.addOrientationChangeListener(() => {
        const { width, height } = Dimensions.get('window');
        setDimensions({ width, height });
      });

      return () => subscription?.remove();
    } else {
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

  // Listen to player events using useEventListener
  useEventListener(player, 'statusChange', ({ status, error }) => {
    console.log('Player status changed:', status);
    
    if (error) {
      console.error('Video playback error:', error);
      Alert.alert('Error', 'Could not load video');
      return;
    }
    
    // Mark video as ready when loaded AND reset isNearEnd
    if (status === 'readyToPlay') {
      setIsVideoReady(true);
      console.log('Video ready for playback:', currentVideo.name);
      
      // Reset near end state for new video
      if (!isVideoReady) {
        // Auto-play when ready (only on first load)
        player.play();
      }
    }
    
    // Reset isVideoReady when loading new video
    if (status === 'loading') {
      setIsVideoReady(false);
    }
  });

  // Listen to time updates for progress - FIXED with seek protection
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    // Only update position if not dragging to prevent bouncing
    if (!dragState.isDragging) {
      const timeInMs = currentTime * 1000; // Convert to milliseconds
      
      // Ignore timeUpdate events shortly after manual seeking to prevent bouncing
      if (lastSeekTime !== null && Math.abs(timeInMs - lastSeekTime) > 500) {
        console.log('Ignoring timeUpdate bounce - Expected:', lastSeekTime/1000, 'Got:', currentTime);
        return;
      }
      
      // Clear seek protection after a short delay
      if (lastSeekTime !== null && Math.abs(timeInMs - lastSeekTime) < 200) {
        setLastSeekTime(null);
      }
      
      setCurrentPlaybackTime(timeInMs);
      console.log('Time update:', currentTime, 'seconds, duration:', player.duration);
    }
  });

  // Listen to playing state changes
  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    // Handle play state changes for controls visibility
    if (playing) {
      manageControlsTimeout(true);
    } else {
      manageControlsTimeout(true);
    }
  });

  // Listen for when video reaches end
  useEventListener(player, 'playToEnd', () => {
    console.log('Video reached end:', currentVideo.name);
    // Force UI update for end state
    setIsVideoReady(true);
    manageControlsTimeout(true);
  });

  // Consolidated timeout management
  const manageControlsTimeout = (show: boolean) => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    setShowControls(show);
  };

  // Toggle play/pause with restart functionality - fixed for expo-video
  const togglePlayPause = () => {
    if (dragState.isDragging) return;

    try {
      if (isPlaying) {
        player.pause();
        console.log('Pausing video');
      } else {
        if (isNearEnd) {
          console.log('Restarting video from beginning');
          player.currentTime = 0;
        }
        player.play();
        console.log('Playing video');
      }
      manageControlsTimeout(true);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
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
      
      if (isPlaying) {
        player.pause();
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
    
    onPanResponderRelease: () => {
      if (!dragState.isDragging) return;
      
      const finalPosition = dragState.position;
      const shouldResume = dragState.wasPlaying;
      
      // Update position immediately to prevent bouncing
      setCurrentPlaybackTime(finalPosition);
      setLastSeekTime(finalPosition); // Mark this as our seek target
      
      // Clear drag state
      setDragState({
        isDragging: false,
        position: 0,
        wasPlaying: false,
        startPageX: 0,
        startPosition: 0,
      });
      
      try {
        // Update video position
        console.log('Seeking to:', finalPosition / 1000, 'seconds');
        player.currentTime = finalPosition / 1000; // Convert back to seconds
        
        if (shouldResume) {
          player.play();
          manageControlsTimeout(true);
        } else {
          manageControlsTimeout(true);
        }
      } catch (error) {
        console.error('Error during seek release:', error);
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

  // Handle progress bar tap - also update state immediately with seek protection
  const handleProgressBarTap = (event: any) => {
    if (dragState.isDragging || duration <= 0 || progressBarWidth <= 0) return;
    
    try {
      const { locationX } = event.nativeEvent;
      const clampedLocationX = Math.max(0, Math.min(progressBarWidth, locationX));
      const progress = clampedLocationX / progressBarWidth;
      const newPosition = Math.max(0, Math.min(duration, progress * duration));
      
      // Update position immediately to prevent bouncing
      setCurrentPlaybackTime(newPosition);
      setLastSeekTime(newPosition); // Mark this as our seek target
      
      console.log('Seeking to:', newPosition / 1000, 'seconds');
      player.currentTime = newPosition / 1000; // Convert to seconds
      manageControlsTimeout(true);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  // Navigation functions
  const navigateVideo = (direction: 'next' | 'prev') => {
    if (!hasMultiple) return;
    
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % videos.length
      : (currentIndex - 1 + videos.length) % videos.length;
    
    // Reset state for new video
    setCurrentIndex(newIndex);
    setIsVideoReady(false);
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
    console.log('Screen tapped, toggling controls. Current state:', showControls);
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

  // Reset state when video changes - also reset seek protection
  useEffect(() => {
    setIsVideoReady(false);
    setCurrentPlaybackTime(0); // Reset playback time
    setLastSeekTime(null); // Reset seek protection
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
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      // Note: player cleanup is handled automatically by useVideoPlayer hook
    };
  }, []);

  const displayPosition = dragState.isDragging ? dragState.position : position;

  const content = (
    <View style={styles.container}>
      {/* Background - clickable for UI toggle */}
      <View style={styles.background}>
        <View style={styles.videoContainer}>
          <View style={styles.videoTouchable}>
            <VideoView
              style={[styles.video, { width: dimensions.width, height: dimensions.height }]}
              player={player}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
              showsTimecodes={false}
              requiresLinearPlayback={false}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        </View>
        
        {/* Transparent overlay for touch handling */}
        <TouchableOpacity 
          style={styles.touchOverlay}
          onPress={handleScreenTap}
          activeOpacity={1}
        />
      </View>

      {/* Controls Overlay */}
      {showControls && (
        <View style={styles.controlsContainer}>
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
              {!isVideoReady ? (
                <Hourglass size={24} color="white" />
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
        </View>
      )}

      {/* Center Restart Button - shown when video is finished */}
      {isNearEnd && !isPlaying && duration > 0 && (
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
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10, // Above video but below controls
  },
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20, // Above touch overlay
    pointerEvents: 'box-none', // Allow touches to pass through to children
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