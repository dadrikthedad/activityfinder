// components/common/LabelWithTooltipNative.tsx
// Reusable label with optional tooltip component
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import TooltipButtonNative from "./TooltipButtonNative";

interface LabelWithTooltipNativeProps {
  label: string;
  tooltip?: string;
  labelStyle?: any;
  containerStyle?: any;
}

export default function LabelWithTooltipNative({
  label,
  tooltip,
  labelStyle,
  containerStyle,
}: LabelWithTooltipNativeProps) {
  return (
    <View style={[styles.labelContainer, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      {tooltip && <TooltipButtonNative tooltip={tooltip} />}
    </View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
});