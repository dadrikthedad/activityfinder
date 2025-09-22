// components/common/ImageViewerNative.tsx - Optimalisert versjon
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Modal, 
  View, 
  TouchableOpacity, 
  Image, 
  Text,                   
  StyleSheet,
  Dimensions,
  StatusBar
} from "react-native";
import * as ScreenOrientation from 'expo-screen-orientation';
import * as GestureHandler from 'react-native-gesture-handler';
import { RNFile } from "@/utils/files/FileFunctions";
import ViewerHeaderNative from "./ViewerHeaderNative";
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/toast/NotificationToastNative';
import ZoomableImage from "./ZoomableImage";

interface ImageViewerContentProps {
  images: RNFile[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  onShare?: (file: RNFile) => void;
  useModal?: boolean;
  onIndexChange?: (newIndex: number) => void;
  simultaneousGesture?: any;
  dimensions?: { width: number; height: number };
}

interface ImageViewerNativeProps extends Omit<ImageViewerContentProps, 'useModal' | 'onIndexChange'> {
  visible: boolean;
  onIndexChange?: (newIndex: number) => void;
  simultaneousGesture?: any;
}

// Core content component - optimalisert for å unngå re-renders
const ImageViewerContent: React.FC<ImageViewerContentProps> = ({
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
  useModal = true,
  onIndexChange,
  simultaneousGesture,
  dimensions: propDimensions
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  
  // Stable dimensions - bruk propDimensions hvis tilgjengelig
  const stableDimensions = useMemo(() => {
    if (propDimensions) {
      return propDimensions;
    }
    // Fallback til skjermdimensjoner, men ikke oppdater automatisk
    const { width, height } = Dimensions.get('window');
    return { width, height };
  }, [propDimensions?.width, propDimensions?.height]);

  const { GestureHandlerRootView } = GestureHandler;
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  // Helper function to update index and notify parent
  const updateIndex = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [onIndexChange]);

  // FJERNET: Orientasjonshåndtering fra denne komponenten
  // Dette skal håndteres av parent-komponenten (MediaViewerScreen)

  const goToNext = useCallback(() => {
    if (hasMultiple && !isZoomed) {
      const newIndex = (currentIndex + 1) % images.length;
      updateIndex(newIndex);
    }
  }, [hasMultiple, isZoomed, currentIndex, images.length, updateIndex]);

  const goToPrevious = useCallback(() => {
    if (hasMultiple && !isZoomed) {
      const newIndex = (currentIndex - 1 + images.length) % images.length;
      updateIndex(newIndex);
    }
  }, [hasMultiple, isZoomed, currentIndex, images.length, updateIndex]);

  // Toggle controls visibility
  const handleScreenTap = useCallback(() => {
    setShowControls(!showControls);
  }, [showControls]);

  // Handle zoom state changes - stable callback
  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
  }, []);

  // Handle close with orientation locking for Modal
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

  const content = (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.background} />

      {/* Zoomable Image */}
      <View style={styles.imageContainer}>
        <ZoomableImage
          uri={currentImage.uri}
          width={stableDimensions.width}
          height={stableDimensions.height}
          minScale={1}
          maxScale={5}
          onSingleTap={handleScreenTap}
          onZoomChange={handleZoomChange}
          simultaneousGesture={simultaneousGesture} 
        />
      </View>

      {/* Controls Overlay */}
      {showControls && (
        <>
          {/* Header */}
          <ViewerHeaderNative
            title={currentImage.name}
            subtitle={hasMultiple ? `${currentIndex + 1} of ${images.length}` : undefined}
            onClose={handleClose}
            onDownload={onDownload}
            currentFile={currentImage}
            onShare={onShare}
          />

          {/* Navigation - kun når ikke zoomet */}
          {hasMultiple && !isZoomed && (
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

          {/* Thumbnails - kun når ikke zoomet */}
          {hasMultiple && images.length <= 10 && !isZoomed && (
            <View style={styles.thumbnailContainer}>
              <View style={styles.thumbnailContent}>
                {images.map((image, index) => (
                  <TouchableOpacity
                    key={`${image.uri}-${index}`} // Stable key
                    style={[
                      styles.thumbnail,
                      index === currentIndex && styles.thumbnailActive
                    ]}
                    onPress={() => updateIndex(index)}
                  >
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Zoom hint */}
          {!isZoomed && (
            <View style={styles.zoomHint}>
              <Text style={styles.zoomHintText}>Touch to zoom</Text>
            </View>
          )}
        </>
      )}

      {/* Toast - only for Modal usage */}
      {useModal && <Toast config={toastConfig} />}
    </View>
  );

  // Wrap in GestureHandlerRootView if using Modal
  if (useModal) {
    return <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>;
  }

  return content;
};

// Modal wrapper for backwards compatibility
export default function ImageViewerNative({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare,
  onIndexChange,
  simultaneousGesture
}: ImageViewerNativeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <ImageViewerContent
        images={images}
        initialIndex={initialIndex}
        onClose={onClose}
        onDownload={onDownload}
        onShare={onShare}
        useModal={true}
        onIndexChange={onIndexChange}
        simultaneousGesture={simultaneousGesture} 
      />
    </Modal>
  );
}

// Export content component for use in screens
export { ImageViewerContent };

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
    backgroundColor: 'black',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  thumbnailContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 50,
    height: 50,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: '#1C6B1C',
    borderWidth: 3,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.7,
  },
  zoomHintText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
});