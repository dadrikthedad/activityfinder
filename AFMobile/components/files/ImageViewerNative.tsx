// components/common/ImageViewerNative.tsx - Midtstilt som VideoViewerNative
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
  ScrollView,
  StatusBar
} from "react-native";
import { RNFile } from "@/utils/files/FileFunctions";
import ViewerHeaderNative from "./ViewerHeaderNative";
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/toast/NotificationToastNative';

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
  const { width, height } = Dimensions.get('window');
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const goToNext = () => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  };

  const goToPrevious = () => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  // Toggle controls visibility like VideoViewerNative
  const handleScreenTap = () => {
    setShowControls(!showControls);
  };

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
          <View style={styles.imageContainer}>
            <TouchableOpacity 
              style={styles.imageTouchable}
              onPress={handleScreenTap}
              activeOpacity={1}
            >
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                maximumZoomScale={3}
                minimumZoomScale={1}
                bouncesZoom
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: currentImage.uri }}
                  style={[styles.image, { width, height }]} // Full skjermstørrelse som video
                  resizeMode="contain"
                  onError={() => {
                    Alert.alert("Error", "Could not load image");
                  }}
                />
              </ScrollView>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Controls Overlay - kun når synlig */}
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

            {/* Thumbnails */}
            {hasMultiple && images.length <= 10 && (
              <View style={styles.thumbnailContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailContent}
                >
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
                </ScrollView>
              </View>
            )}
          </>
        )}
      </View>
      <Toast config={toastConfig} />
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
  imageContainer: {
    flex: 1,
    justifyContent: 'center',  // ← Senterer som VideoViewerNative
    alignItems: 'center',
  },
  imageTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',  // ← Ekstra sentrering som VideoViewerNative
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%', // ← Sikrer at innholdet kan sentreres
  },
  image: {
    backgroundColor: 'transparent',
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
  },
  thumbnailContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
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
});