// components/common/buttons/LabelWithTooltipNative.tsx
import React from "react";
import { View, Text } from "react-native";
import { useUnistyles } from "react-native-unistyles";
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
  const { theme } = useUnistyles();

  return (
    <View style={[{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm }, containerStyle]}>
      <Text style={[{
        fontSize: theme.typography.md,
        fontWeight: theme.typography.medium,
        color: theme.colors.textSecondary,
        flex: 1,
      }, labelStyle]}>
        {label}
      </Text>
      {tooltip && <TooltipButtonNative tooltip={tooltip} />}
    </View>
  );
}
