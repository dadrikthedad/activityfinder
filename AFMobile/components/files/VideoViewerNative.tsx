// components/common/VideoViewerNative.tsx
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
import { RNFile } from '@/utils/files/FileFunctions';

interface VideoViewerNativeProps {
  visible: boolean;
  videos: RNFile[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
}

export default function VideoViewerNative({
  visible,
  videos,
  initialIndex = 0,
  onClose,
  onDownload,
}: VideoViewerNativeProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  // Simplified seeking state - only one source of truth
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);
  
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Tracking refs for delta-based dragging
  const dragStartPageX = useRef<number>(0);
  const dragStartPosition = useRef<number>(0);

  const { width, height } = Dimensions.get('window');
  
  if (videos.length === 0) return null;
  
  const currentVideo = videos[currentIndex];
  const hasMultiple = videos.length > 1;

  // Get the current display position (either drag position or actual position)
  const displayPosition = isDragging ? dragPosition : position;

  // Centralized function for starting auto-hide countdown
  const startAutoHideCountdown = () => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Reset controls timeout
  const resetControlsTimeout = () => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    setShowControls(true);
    
    // Skjul kontroller automatisk kun under avspilling og ikke under dragging
    if (isPlaying && position < duration * 0.95 && !isDragging) {
      startAutoHideCountdown();
    }
  };

  // Handle video status updates
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && !isDragging) {
      setIsLoading(false);
      const previousIsPlaying = isPlaying;
      
      const newPosition = status.positionMillis || 0;
      setIsPlaying(status.isPlaying || false);
      setPosition(newPosition);
      
      if (status.durationMillis) {
        setDuration(status.durationMillis);
      }
      
      if (status.didJustFinish) {
        setShowControls(true);
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
      }
      // UI-logikk: Håndter play/pause endringer
      else if (!previousIsPlaying && (status.isPlaying || false)) {
        // Videoen begynte å spille - skjul kontroller etter 3 sekunder (men ikke hvis vi drar)
        if (!isDragging) {
          startAutoHideCountdown();
        }
      }
      else if (previousIsPlaying && !(status.isPlaying || false)) {
        // Videoen ble pauset - vis kontroller
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
        setShowControls(true);
      }
    } else if (!status.isLoaded && 'error' in status) {
      console.error('Video playback error:', status.error);
      Alert.alert('Error', 'Could not load video');
    }
  };

  // Toggle play/pause med restart funksjonalitet
  const togglePlayPause = async () => {
    if (videoRef.current && !isDragging) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        // Vis kontroller når vi pauser
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
        setShowControls(true);
      } else {
        // Sjekk om videoen er ferdig (nær slutten)
        const isNearEnd = position >= duration * 0.95;
        
        if (isNearEnd && duration > 0) {
          // Restart fra begynnelsen hvis videoen er ferdig
          await videoRef.current.setPositionAsync(0);
          setPosition(0);
          await videoRef.current.playAsync();
        } else {
          // Normal play fra nåværende posisjon
          await videoRef.current.playAsync();
        }
        
        // Skjul kontroller når vi starter avspilling
        if (!isDragging) {
          startAutoHideCountdown();
        }
      }
    }
  };

  // Handle progress bar layout
  const onProgressBarLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setProgressBarWidth(width);
  };

  // Pan responder med absolutte coordinates for å unngå multi-layer problemer
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
    },
    
    onPanResponderGrant: async (event) => {
      event.persist();
      
      if (duration <= 0 || progressBarWidth <= 0) return;
      
      const { pageX } = event.nativeEvent;
      
      setIsDragging(true);
      setWasPlayingBeforeDrag(isPlaying);
      
      // Vis kontroller under dragging og stop auto-hide timeout
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      setShowControls(true);
      
      if (isPlaying && videoRef.current) {
        await videoRef.current.pauseAsync();
      }
      
      // Lagre initial pageX og position for relative beregninger
      dragStartPageX.current = pageX;
      dragStartPosition.current = position;
      
      setDragPosition(position);
    },
    
    onPanResponderMove: (event) => {
      event.persist();
      
      if (!isDragging || duration <= 0 || progressBarWidth <= 0) return;
      
      const { pageX } = event.nativeEvent;
      const deltaX = pageX - dragStartPageX.current;
      const deltaProgress = deltaX / progressBarWidth;
      const deltaTime = deltaProgress * duration;
      
      // Ny posisjon basert på start posisjon + delta
      const newPosition = Math.max(0, Math.min(duration, dragStartPosition.current + deltaTime));
      
      setDragPosition(newPosition);
    },
    
    onPanResponderRelease: async () => {
      if (!isDragging) return;
      
      // Sett isDragging til false FØRST for å re-enable TouchableOpacity
      setIsDragging(false);
      
      // Cleanup tracking variables
      dragStartPageX.current = 0;
      dragStartPosition.current = 0;
      
      if (videoRef.current && dragPosition >= 0) {
        await videoRef.current.setPositionAsync(dragPosition);
        setPosition(dragPosition);
        
        if (wasPlayingBeforeDrag) {
          await videoRef.current.playAsync();
          startAutoHideCountdown();
        }
      }
      
      setDragPosition(0);
    },
    
    onPanResponderTerminate: () => {
      setIsDragging(false);
      setDragPosition(0);
      // Cleanup tracking variables
      dragStartPageX.current = 0;
      dragStartPosition.current = 0;
    },
  });

  // Handle tap to seek - disable when dragging
  const handleProgressBarTap = async (event: any) => {
    // Blokkér alle tap events under dragging
    if (isDragging || duration <= 0 || progressBarWidth <= 0) return;
    
    event.persist();
    const { locationX } = event.nativeEvent;
    
    if (videoRef.current) {
      const clampedLocationX = Math.max(0, Math.min(progressBarWidth, locationX));
      const progress = clampedLocationX / progressBarWidth;
      const newPosition = Math.max(0, Math.min(duration, progress * duration));
      
      await videoRef.current.setPositionAsync(newPosition);
      setPosition(newPosition);
    }
    resetControlsTimeout();
  };

  // Navigation
  const goToNext = () => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
      setIsPlaying(false);
      setPosition(0);
      setIsLoading(true);
      setIsDragging(false);
      setDragPosition(0);
      setShowControls(true);
    }
  };

  const goToPrevious = () => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
      setIsPlaying(false);
      setPosition(0);
      setIsLoading(true);
      setIsDragging(false);
      setDragPosition(0);
      setShowControls(true);
    }
  };

  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle download
  const handleDownload = () => {
    if (onDownload && currentVideo) {
      onDownload(currentVideo);
    } else {
      Alert.alert('Download', 'Download functionality not implemented');
    }
  };

  // Show options - forenklet uten always show controls
  const showOptions = () => {
    const options: Array<{
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'default' | 'destructive';
    }> = [];
    
    if (onDownload) {
      options.push({ text: 'Download', onPress: handleDownload });
    }
    
    options.push({ text: 'Close', onPress: onClose, style: 'cancel' });
    
    Alert.alert(currentVideo.name, 'Choose an action', options);
  };

  // Smart screen tap for UI toggle
  const handleScreenTap = () => {
    // Ikke tillat screen tap å skjule kontroller hvis vi drar
    if (isDragging) return;
    
    if (showControls && isPlaying) {
      // Hvis kontroller vises og videoen spiller, skjul dem umiddelbart
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      setShowControls(false);
    } else if (!showControls) {
      // Hvis kontroller er skjult, vis dem og start nedtelling
      setShowControls(true);
      if (isPlaying) {
        startAutoHideCountdown();
      }
    } else {
      // Hvis kontroller vises men videoen er pauset, bare reset timeout
      resetControlsTimeout();
    }
  };

  // Reset when video changes
  useEffect(() => {
    setPosition(0);
    setIsPlaying(false);
    setIsLoading(true);
    setIsDragging(false);
    setDragPosition(0);
    setWasPlayingBeforeDrag(false);
    setShowControls(true);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
  }, [currentIndex]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Background - clickable for UI toggle */}
        <TouchableOpacity 
          style={styles.background}
          onPress={handleScreenTap}
          activeOpacity={1}
        >
          {/* Video Container */}
          <View style={styles.videoContainer}>
            <TouchableOpacity 
              style={styles.videoTouchable}
              onPress={handleScreenTap}
              activeOpacity={1}
            >
              <Video
                ref={videoRef}
                source={{ uri: currentVideo.uri }}
                style={[styles.video, { width, height: height * 0.8 }]}
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
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {currentVideo.name}
                </Text>
                {hasMultiple && (
                  <Text style={styles.counter}>
                    {currentIndex + 1} of {videos.length}
                  </Text>
                )}
              </View>
              
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.headerButton} onPress={showOptions}>
                  <Text style={styles.headerButtonText}>⋯</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                  <Text style={styles.headerButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Play/Pause Button - med restart funksjonalitet */}
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              <Text style={styles.playPauseText}>
                {isLoading ? '⏳' : 
                 isPlaying ? '⏸️' : 
                 (position >= duration * 0.95 && duration > 0) ? '🔄' : '▶️'}
              </Text>
            </TouchableOpacity>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>
                {formatTime(displayPosition)}
              </Text>
              
              {/* Progress Bar - med bedre event separation */}
              <View 
                style={styles.progressBarTouchable}
                {...panResponder.panHandlers}
                onLayout={onProgressBarLayout}
              >
                <TouchableOpacity 
                  style={styles.progressBarTap}
                  onPress={handleProgressBarTap}
                  activeOpacity={1}
                  disabled={isDragging} // Deaktiver TouchableOpacity under dragging
                >
                  <View style={styles.progressBar}>
                    <View style={styles.progressTrack} />
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${duration > 0 ? (displayPosition / duration) * 100 : 0}%` 
                        }
                      ]} 
                    />
                    <View
                      style={[
                        styles.progressThumb,
                        isDragging && styles.progressThumbActive,
                        { 
                          left: `${duration > 0 ? (displayPosition / duration) * 100 : 0}%` 
                        }
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Navigation */}
            {hasMultiple && (
              <>
                <TouchableOpacity
                  style={[styles.navButton, styles.navLeft]}
                  onPress={goToPrevious}
                >
                  <Text style={styles.navText}>‹</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.navButton, styles.navRight]}
                  onPress={goToNext}
                >
                  <Text style={styles.navText}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  fileName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
    marginLeft: 8,
  },
  headerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playPauseButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
    marginLeft: -40,
  },
  playPauseText: {
    fontSize: 32,
    color: 'white',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  progressBarTouchable: {
    flex: 1,
    marginHorizontal: 12,
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
});