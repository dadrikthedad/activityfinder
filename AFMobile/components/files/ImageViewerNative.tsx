// components/common/ImageViewerNative.tsx - Med ZoomableImage
import React, { useState } from "react";
import { 
  Modal, 
  View, 
  TouchableOpacity, 
  Image, 
  Text, 
  StyleSheet,
  Dimensions,
  Alert,
  StatusBar
} from "react-native";
import * as GestureHandler from 'react-native-gesture-handler'; // 👈 LEGG TIL DENNE
import { RNFile } from "@/utils/files/FileFunctions";
import ViewerHeaderNative from "./ViewerHeaderNative";
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/toast/NotificationToastNative';
import ZoomableImage from "./ZoomableImage"; // Din ZoomableImage komponent

interface ImageViewerNativeProps {
  visible: boolean;
  images: RNFile[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
  onShare?: (file: RNFile) => void;
}

export default function ImageViewerNative({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  onShare
}: ImageViewerNativeProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const { width, height } = Dimensions.get('window');
  const { GestureHandlerRootView } = GestureHandler; // 👈 DESTRUKTUR HER
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const goToNext = () => {
    if (hasMultiple && !isZoomed) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  };

  const goToPrevious = () => {
    if (hasMultiple && !isZoomed) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  // Toggle controls visibility - TILLAT ALLTID
  const handleScreenTap = () => {
    console.log('[ImageViewer] Screen tap received, isZoomed:', isZoomed, 'showControls:', showControls);
    setShowControls(!showControls);
  };

  // Handle zoom state changes
  const handleZoomChange = (zoomed: boolean) => {
    console.log('[ImageViewer] Zoom changed to:', zoomed);
    setIsZoomed(zoomed);
    // IKKE skjul kontroller automatisk når zoomet - la brukeren bestemme
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 👈 WRAPPER ALT I GESTUREHANDLERROOTVIEW */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar hidden />
        <View style={styles.container}>
          {/* Background */}
          <View style={styles.background} />

          {/* Zoomable Image */}
          <View style={styles.imageContainer}>
            <ZoomableImage
              uri={currentImage.uri}
              width={width}
              height={height}
              minScale={1}
              maxScale={5}
              onSingleTap={handleScreenTap}
              onZoomChange={handleZoomChange}
            />
          </View>

          {/* Controls Overlay */}
          {showControls && (
            <>
              {/* Header */}
              <ViewerHeaderNative
                title={currentImage.name}
                subtitle={hasMultiple ? `${currentIndex + 1} of ${images.length}` : undefined}
                onClose={onClose}
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
                        key={index}
                        style={[
                          styles.thumbnail,
                          index === currentIndex && styles.thumbnailActive
                        ]}
                        onPress={() => setCurrentIndex(index)}
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
                  <Text style={styles.zoomHintText}>Klyp eller dobbelttrykk for å zoome</Text>
                </View>
              )}
            </>
          )}
        </View>
        <Toast config={toastConfig} />
      </GestureHandlerRootView>
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