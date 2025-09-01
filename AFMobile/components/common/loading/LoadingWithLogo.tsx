// Loading komponent med logo og spinner
// components/common/loading/LoadingWithLogo.tsx
import React from "react";
import { View, Image, StyleSheet, ImageSourcePropType } from "react-native";
import SpinnerNative from "../SpinnerNative";

interface LoadingWithLogoProps {
  logoSource: ImageSourcePropType;
  logoSize?: number;
  spinnerSize?: "small" | "large" | number;
  spinnerColor?: string;
  backgroundColor?: string;
  logoStyle?: any;
  containerStyle?: any;
}

export default function LoadingWithLogo({
  logoSource,
  logoSize = 120,
  spinnerSize = "large",
  spinnerColor = "#FFFFFF",
  backgroundColor = "#1C6B1C",
  logoStyle,
  containerStyle,
}: LoadingWithLogoProps) {
  return (
    <View style={[styles.container, { backgroundColor }, containerStyle]}>
      <View style={styles.content}>
        {/* Logo i midten */}
        <Image
          source={logoSource}
          style={[
            styles.logo,
            {
              width: logoSize,
              height: logoSize,
            },
            logoStyle,
          ]}
          resizeMode="contain"
        />
        
        {/* Spinner under logoen */}
        <View style={styles.spinnerContainer}>
          <SpinnerNative
            size={spinnerSize}
            color={spinnerColor}
            containerStyle={styles.spinner}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginBottom: 30,
  },
  spinnerContainer: {
    height: 50, // Fast høyde for spinner området
    justifyContent: 'center',
  },
  spinner: {
    flex: 0, // Override flex: 1 fra SpinnerNative
    padding: 0,
  },
});