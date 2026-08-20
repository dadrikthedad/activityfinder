import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useUnistyles } from "react-native-unistyles";

export const BootstrapLoadingScreen = () => {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
};
