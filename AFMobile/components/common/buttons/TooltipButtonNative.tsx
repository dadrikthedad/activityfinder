// components/common/buttons/TooltipButtonNative.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";

interface TooltipButtonNativeProps {
  tooltip: string;
  iconSize?: number;
  maxWidth?: number;
}

export default function TooltipButtonNative({
  tooltip,
  iconSize = 18,
  maxWidth = 280,
}: TooltipButtonNativeProps) {
  const { theme } = useUnistyles();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowTooltip(!showTooltip)}
        style={{ marginLeft: theme.spacing.sm, padding: 2 }}
      >
        <Ionicons
          name="information-circle-outline"
          size={iconSize}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: theme.spacing.lg,
          }}
          onPress={() => setShowTooltip(false)}
        >
          <View style={{
            maxWidth,
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            borderWidth: 2,
            borderColor: theme.colors.primary,
          }}>
            <Text style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.sm,
              lineHeight: 20,
            }}>
              {tooltip}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
