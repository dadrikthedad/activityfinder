// components/common/MiniAvatarNative.tsx
// components/common/MiniAvatarNative.tsx
import React, { useState } from "react";
import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import ImageViewerNative from "./ImageViewerNative";

interface MiniAvatarProps {
  imageUrl: string;
  size?: number;
  alt?: string;
  withBorder?: boolean;
  enlargeable?: boolean;
}

export default function MiniAvatarNative({
  imageUrl,
  size = 40,
  alt = "Profile avatar",
  withBorder = true,
  enlargeable = false,
}: MiniAvatarProps) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Use local default if imageUrl is empty or if there's an error
  const shouldUseDefault = !imageUrl || imageUrl === "/default-avatar.png" || hasError;
 
  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    withBorder ? styles.withBorder : styles.withoutBorder,
  ];
  
  const imageStyle = [
    styles.image,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
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
            ? require('../../assets/images/default-avatar.png')
            : { uri: imageUrl }
        }
        style={imageStyle}
        onError={handleImageError}
        defaultSource={require('../../assets/images/default-avatar.png')}
      />
    </View>
  );
  
  if (enlargeable) {
    return (
      <>
        <TouchableOpacity onPress={() => setShowImageViewer(true)}>
          {imageComponent}
        </TouchableOpacity>
       
        <ImageViewerNative
          visible={showImageViewer}
          images={[{ 
            uri: shouldUseDefault ? 'default-avatar' : imageUrl, 
            name: alt, 
            type: 'image/jpeg' 
          }]}
          initialIndex={0}
          onClose={() => setShowImageViewer(false)}
        />
      </>
    );
  }
  
  return imageComponent;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  withBorder: {
    borderWidth: 1,
    borderColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  withoutBorder: {
    borderWidth: 1,
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