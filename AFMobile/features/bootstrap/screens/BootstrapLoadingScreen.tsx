import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useBootstrap } from "@/features/bootstrap/hooks/useBootstrap";
import { RootStackNavigationProp } from "@/types/navigation";

export const BootstrapLoadingScreen = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { phase, runBootstrap } = useBootstrap();

  useEffect(() => {
    const start = async () => {
      await runBootstrap();
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    };
    start();
  }, []);

  const phaseLabel = () => {
    switch (phase) {
      case "critical":   return t("bootstrap.loadingProfile");
      case "secondary":  return t("bootstrap.loadingConversations");
      case "decrypting": return t("bootstrap.decrypting");
      default:           return t("bootstrap.loading");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        gap: theme.spacing.md,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
};
