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
  const [showControls, setShowControls] = useState(true);
  
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

  const { width, height } = Dimensions.get('window');
  
  if (videos.length === 0) return null;
  
  const currentVideo = videos[currentIndex];
  const hasMultiple = videos.length > 1;
  const displayPosition = dragState.isDragging ? dragState.position : position;
  const isNearEnd = position >= duration * 0.95 && duration > 0;

  // Consolidated timeout management
  const manageControlsTimeout = (show: boolean, startCountdown = false) => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    
    setShowControls(show);
    
    if (startCountdown && isPlaying && !isNearEnd && !dragState.isDragging) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
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
      manageControlsTimeout(true, true);
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
      manageControlsTimeout(true, true);
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
          manageControlsTimeout(true, true);
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
    manageControlsTimeout(true, isPlaying);
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
    
    if (showControls && isPlaying) {
      manageControlsTimeout(false);
    } else if (!showControls) {
      manageControlsTimeout(true, isPlaying);
    } else {
      manageControlsTimeout(true, isPlaying);
    }
  };

  // Format time helper
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

  // Show options menu
  const showOptions = () => {
    const options = [];
    if (onDownload) options.push({ text: 'Download', onPress: handleDownload });
    options.push({ text: 'Close', onPress: onClose, style: 'cancel' as const });
    Alert.alert(currentVideo.name, 'Choose an action', options);
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

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              <Text style={styles.playPauseText}>
                {duration === 0 ? '⏳' : 
                 isPlaying ? '⏸️' : 
                 isNearEnd ? '🔄' : '▶️'}
              </Text>
            </TouchableOpacity>

            {/* Progress Bar */}
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