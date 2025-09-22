// components/common/VideoViewerNative.tsx - Fikset versjon
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  onIndexChange?: (newIndex: number) => void;
  dimensions?: { width: number; height: number };
}

interface VideoViewerNativeProps extends Omit<VideoViewerContentProps, 'useModal' | 'onIndexChange'> {
  visible: boolean;
  onIndexChange?: (newIndex: number) => void;
}

// Core content component - riktig optimalisert
const VideoViewerContent: React.FC<VideoViewerContentProps> = React.memo(({
  videos,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
  useModal = true,
  onIndexChange,
  dimensions: propDimensions
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
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

  const dimensionsRef = useRef(propDimensions || Dimensions.get('window'));
  const [, forceUpdate] = useState({});
  
  if (videos.length === 0) return null;
  
  // Stable current video object to prevent useVideoPlayer recreation
  const stableCurrentVideo = useMemo(() => {
    return videos[currentIndex];
  }, [videos, currentIndex]);
  
  const hasMultiple = videos.length > 1;

  // Stable video URI for useVideoPlayer - memoize to prevent recreation
  const stableVideoUri = useMemo(() => stableCurrentVideo.uri as VideoSource, [stableCurrentVideo.uri]);

  // RIKTIG: Kall useVideoPlayer direkte med stable URI
  const player = useVideoPlayer(stableVideoUri, (player) => {
    player.loop = false;
    player.muted = false;
    player.timeUpdateEventInterval = 0.1;
  });

  // Stable dimensions - beregnes kun når nødvendig, ikke ved hver dimensjonsendring
  useEffect(() => {
if (propDimensions) {
  dimensionsRef.current = propDimensions;
  forceUpdate({}); // Trigger re-render kun for layout, ikke video player
}
}, [propDimensions?.width, propDimensions?.height]);

  const currentDimensions = dimensionsRef.current;

  // Replace video source when currentIndex changes (but not on initial load)
  useEffect(() => {
    if (currentIndex !== initialIndex) {
      const newVideo = videos[currentIndex];
      if (newVideo && player) {
        console.log('Switching to video:', newVideo.name);
        // Behold playback state når vi bytter video
        const wasPlaying = player.playing;
        
        player.replace(newVideo.uri as VideoSource);
        
        // Ikke auto-play hvis brukeren hadde pause
        if (!wasPlaying) {
          player.pause();
        }
      }
    }
  }, [currentIndex, player, initialIndex, videos]);

  // Helper function to update index and notify parent
  const updateIndex = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [onIndexChange]);

  // Player state
  const isPlaying = player.playing;
  const duration = player.duration > 0 ? player.duration * 1000 : 0;
  const position = dragState.isDragging ? dragState.position : currentPlaybackTime;
  const isNearEnd = duration > 0 && position >= duration * 0.95;
  const [isVideoEnded, setIsVideoEnded] = useState(false);

  // FJERNET: All orientasjonshåndtering - dette håndteres av parent

  // Auto-hide controls when playing
  useEffect(() => {
    if (isPlaying && showControls && !dragState.isDragging && !isNearEnd) {
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [isPlaying, showControls, dragState.isDragging, isNearEnd]);

  // Event listeners
  useEventListener(player, 'statusChange', ({ status, error }) => {
    console.log('Player status changed:', status);
    
    if (error) {
      console.error('Video playback error:', error);
      Alert.alert('Error', 'Could not load video');
      return;
    }
    
    if (status === 'readyToPlay') {
      setIsVideoReady(true);
      console.log('Video ready for playback:', stableCurrentVideo.name);
      
      if (!isVideoReady) {
        player.play();
      }
    }
    
    if (status === 'loading') {
      setIsVideoReady(false);
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (isVideoEnded) {
      return;
    }
    
    if (!dragState.isDragging) {
      const timeInMs = currentTime * 1000;
      
      if (lastSeekTime !== null && Math.abs(timeInMs - lastSeekTime) > 500) {
        return;
      }
      
      if (lastSeekTime !== null && Math.abs(timeInMs - lastSeekTime) < 200) {
        setLastSeekTime(null);
      }
      
      setCurrentPlaybackTime(timeInMs);
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    if (playing) {
      manageControlsTimeout(true);
    } else {
      manageControlsTimeout(true);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    console.log('Video reached end:', stableCurrentVideo.name);
    setIsVideoEnded(true);
    setIsVideoReady(true);
    manageControlsTimeout(true);
  });

  const manageControlsTimeout = useCallback((show: boolean) => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    setShowControls(show);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (dragState.isDragging) return;

    try {
      if (isPlaying) {
        player.pause();
        console.log('Pausing video');
      } else {
        if (isNearEnd || isVideoEnded) {
          console.log('Restarting video from beginning');
          player.currentTime = 0;
          setIsVideoEnded(false);
          setCurrentPlaybackTime(0);
        }
        player.play();
        console.log('Playing video');
      }
      manageControlsTimeout(true);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [dragState.isDragging, isPlaying, isNearEnd, isVideoEnded, player, manageControlsTimeout]);

  // Pan responder for seeking - stable
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => 
      Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
    
    onPanResponderGrant: (event) => {
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
      
      setCurrentPlaybackTime(finalPosition);
      setLastSeekTime(finalPosition);
      setIsVideoEnded(false);
      
      setDragState({
        isDragging: false,
        position: 0,
        wasPlaying: false,
        startPageX: 0,
        startPosition: 0,
      });
      
      try {
        console.log('Seeking to:', finalPosition / 1000, 'seconds');
        player.currentTime = finalPosition / 1000;
        
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
  }), [duration, progressBarWidth, position, isPlaying, dragState.isDragging, dragState.startPageX, dragState.startPosition, player, manageControlsTimeout]);

  const handleProgressBarTap = useCallback((event: any) => {
    if (dragState.isDragging || duration <= 0 || progressBarWidth <= 0) return;
    
    try {
      const { locationX } = event.nativeEvent;
      const clampedLocationX = Math.max(0, Math.min(progressBarWidth, locationX));
      const progress = clampedLocationX / progressBarWidth;
      const newPosition = Math.max(0, Math.min(duration, progress * duration));
      
      setCurrentPlaybackTime(newPosition);
      setLastSeekTime(newPosition);
      setIsVideoEnded(false);
      
      console.log('Seeking to:', newPosition / 1000, 'seconds');
      player.currentTime = newPosition / 1000;
      manageControlsTimeout(true);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, [dragState.isDragging, duration, progressBarWidth, player, manageControlsTimeout]);

  const navigateVideo = useCallback((direction: 'next' | 'prev') => {
    if (!hasMultiple) return;
    
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % videos.length
      : (currentIndex - 1 + videos.length) % videos.length;
    
    updateIndex(newIndex);
    setIsVideoReady(false);
    setIsVideoEnded(false);
    setDragState({
      isDragging: false,
      position: 0,
      wasPlaying: false,
      startPageX: 0,
      startPosition: 0,
    });
    manageControlsTimeout(true);
  }, [hasMultiple, currentIndex, videos.length, updateIndex, manageControlsTimeout]);

  const handleScreenTap = useCallback(() => {
    if (dragState.isDragging) return;
    console.log('Screen tapped, toggling controls. Current state:', showControls);
    manageControlsTimeout(!showControls);
  }, [dragState.isDragging, showControls, manageControlsTimeout]);

  const formatTime = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleClose = useCallback(async () => {
    if (useModal) {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (error) {
        console.warn('Failed to lock orientation:', error);
      }
    }
    onClose();
  }, [useModal, onClose]);

  // Reset state when video changes
  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoEnded(false);
    setCurrentPlaybackTime(0);
    setLastSeekTime(null);
    setDragState({
      isDragging: false,
      position: 0,
      wasPlaying: false,
      startPageX: 0,
      startPosition: 0,
    });
    manageControlsTimeout(true);
  }, [currentIndex, manageControlsTimeout]);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  const displayPosition = dragState.isDragging ? dragState.position : position;

  const content = (
    <View style={styles.container}>
      <View style={styles.background}>
        <View style={styles.videoContainer}>
          <View style={styles.videoTouchable}>
            <VideoView
              style={[styles.video, { 
                width: currentDimensions.width, 
                height: currentDimensions.height 
              }]}
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
        
        <TouchableOpacity 
          style={styles.touchOverlay}
          onPress={handleScreenTap}
          activeOpacity={1}
        />
      </View>

      {showControls && (
        <View style={styles.controlsContainer}>
          <ViewerHeaderNative
            title={stableCurrentVideo.name}
            subtitle={hasMultiple ? `${currentIndex + 1} of ${videos.length}` : undefined}
            onClose={handleClose}
            onDownload={onDownload}
            currentFile={stableCurrentVideo}
            onShare={onShare}
          />

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

      {isNearEnd && !isPlaying && duration > 0 && (
        <TouchableOpacity
          style={styles.centerRestartButton}
          onPress={togglePlayPause}
        >
          <RefreshCcw size={48} color="white" />
        </TouchableOpacity>
      )}

      {useModal && <Toast config={toastConfig} />}
    </View>
  );

  return content;
}, (prevProps, nextProps) => {
  // Custom comparison: re-render bare hvis video-relevante props endrer seg
  // Ignorerer dimensions for å forhindre video player restart
  return (
    prevProps.videos === nextProps.videos &&
    prevProps.initialIndex === nextProps.initialIndex &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.onDownload === nextProps.onDownload &&
    prevProps.onShare === nextProps.onShare &&
    prevProps.useModal === nextProps.useModal &&
    prevProps.onIndexChange === nextProps.onIndexChange
  );
});


// Modal wrapper for backwards compatibility
export default function VideoViewerNative({
  visible,
  videos,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
  onIndexChange 
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
        onIndexChange={onIndexChange}
      />
    </Modal>
  );
}

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
    zIndex: 10,
  },
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    pointerEvents: 'box-none',
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
    zIndex: 30,
    elevation: 30,
  },
});