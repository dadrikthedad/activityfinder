// components/common/TooltipButtonNative.tsx
// Reusable tooltip button component
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface TooltipButtonNativeProps {
  tooltip: string;
  iconSize?: number;
  iconColor?: string;
  maxWidth?: number;
}

export default function TooltipButtonNative({
  tooltip,
  iconSize = 18,
  iconColor = "#6b7280",
  maxWidth = 280,
}: TooltipButtonNativeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowTooltip(!showTooltip)}
        style={styles.tooltipButton}
      >
        <Ionicons 
          name="information-circle-outline" 
          size={iconSize} 
          color={iconColor} 
        />
      </TouchableOpacity>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <TouchableOpacity
          style={styles.tooltipOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <View style={[styles.tooltipContent, { maxWidth }]}>
            <Text style={styles.tooltipText}>{tooltip}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tooltipButton: {
    marginLeft: 8,
    padding: 2,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  tooltipContent: {
    backgroundColor: "#ffffffff",
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1C6B1C'
  },
  tooltipText: {
    color: "#030303ff",
    fontSize: 14,
    lineHeight: 20,
  },
});