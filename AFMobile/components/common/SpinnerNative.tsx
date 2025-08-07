// Spinneren som brukes når en side laster og vi henter fra backend, feks bruker profilen på profilsiden og instillinger på profilesettings
// components/Spinner.tsx
// components/common/SpinnerNative.tsx
import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface SpinnerNativeProps {
  size?: "small" | "large" | number;
  color?: string;
  text?: string;
  textStyle?: any;
  containerStyle?: any;
}

export default function SpinnerNative({
  size = "large",
  color = "#1C6B1C", // Green color matching your theme
  text,
  textStyle,
  containerStyle,
}: SpinnerNativeProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <ActivityIndicator 
        size={size} 
        color={color}
        hidesWhenStopped={true}
      />
      {text && (
        <Text style={[styles.text, textStyle]}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280', // Gray text
    textAlign: 'center',
  },
});