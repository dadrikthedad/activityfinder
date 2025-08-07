// components/common/ImageViewerNative.tsx - Simple React Native image viewer
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
  ScrollView
} from "react-native";
import { RNFile } from "@/utils/files/FileFunctions";

interface ImageViewerNativeProps {
  visible: boolean;
  images: RNFile[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (file: RNFile) => void;
}

export default function ImageViewerNative({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onDownload
}: ImageViewerNativeProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
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

  const handleDownload = () => {
    if (onDownload && currentImage) {
      onDownload(currentImage);
    } else {
      Alert.alert("Download", "Download functionality not implemented");
    }
  };

  const showOptions = () => {
    const options: Array<{
      text: string;
      onPress?: () => void;
      style?: "cancel" | "default" | "destructive";
    }> = [];
    
    if (onDownload) {
      options.push({ text: "Download", onPress: handleDownload });
    }
    
    options.push({ text: "Close", onPress: onClose, style: "cancel" });
    
    Alert.alert(
      currentImage.name,
      "Choose an action",
      options
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Background */}
        <TouchableOpacity 
          style={styles.background}
          onPress={onClose}
          activeOpacity={1}
        />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.fileName} numberOfLines={1}>
              {currentImage.name}
            </Text>
            {hasMultiple && (
              <Text style={styles.counter}>
                {currentIndex + 1} of {images.length}
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

        {/* Image */}
        <View style={styles.imageContainer}>
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
              style={[styles.image, { width, height: height * 0.8 }]}
              resizeMode="contain"
              onError={() => {
                Alert.alert("Error", "Could not load image");
              }}
            />
          </ScrollView>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Account for status bar
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
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
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