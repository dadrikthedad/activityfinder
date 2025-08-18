// components/common/MiniAvatarNative.tsx
import React, { useState } from "react";
import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import ImageViewerNative from "../files/ImageViewerNative";

interface MiniAvatarProps {
  imageUrl: string;
  size?: number;
  alt?: string;
  withBorder?: boolean;
  enlargeable?: boolean;
  isGroup?: boolean; // New prop to determine if this is a group avatar
}

export default function MiniAvatarNative({
  imageUrl,
  size = 40,
  alt = "Profile avatar",
  withBorder = true,
  enlargeable = false,
  isGroup = false, // Default to false for backwards compatibility
}: MiniAvatarProps) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Calculate border width
  const borderWidth = 1;
  
  // Calculate image size (smaller than container to show border)
  const imageSize = size - (borderWidth * 2);
 
  // Helper function to get the appropriate default image
  const getDefaultImageSource = () => {
    if (isGroup) {
      return require('../../assets/images/default-group.png');
    }
    return require('../../assets/images/default-avatar.png');
  };

  // Helper function to get default image URI for ImageViewer
  const getDefaultImageUri = () => {
    if (isGroup) {
      return Image.resolveAssetSource(require('../../assets/images/default-group.png')).uri;
    }
    return Image.resolveAssetSource(require('../../assets/images/default-avatar.png')).uri;
  };

  // Use local default if imageUrl is empty, is a default path, or if there's an error
  const shouldUseDefault = !imageUrl || 
                          imageUrl === "/default-avatar.png" || 
                          imageUrl === "/default-group.png" ||
                          imageUrl.startsWith('/default-') ||
                          hasError;
 
  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidth,
    },
    withBorder ? styles.withBorder : styles.withoutBorder,
  ];
 
  const imageStyle = [
    styles.image,
    {
      width: imageSize,
      height: imageSize,
      borderRadius: imageSize / 2,
    },
  ];

  const handleImageError = () => {
    setHasError(true);
  };
 
  const imageComponent = (
    <View style={containerStyle}>
      <Image
        source={
          shouldUseDefault
            ? getDefaultImageSource()
            : { uri: imageUrl }
        }
        style={imageStyle}
        onError={handleImageError}
        defaultSource={getDefaultImageSource()}
      />
    </View>
  );
 
  if (enlargeable) {
    return (
      <>
        <TouchableOpacity onPress={() => setShowImageViewer(true)}>
          {imageComponent}
        </TouchableOpacity>
       
        {/* Bruker Modal versjon av ImageViewerNative - perfekt for avatarer */}
        <ImageViewerNative
          visible={showImageViewer}
          images={[{
            uri: shouldUseDefault
              ? getDefaultImageUri()
              : imageUrl,
            name: alt,
            type: 'image/jpeg',
            size: undefined
          }]}
          initialIndex={0}
          onClose={() => setShowImageViewer(false)}
          // Ingen onDownload eller onShare for avatarer - bare visning
        />
      </>
    );
  }
 
  return imageComponent;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withBorder: {
    borderColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  withoutBorder: {
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  image: {
    resizeMode: 'cover',
  },
});