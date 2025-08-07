// components/common/DropdownButtonNative.tsx - Alert-based dropdown
import React from "react";
import { Alert } from "react-native";
import ButtonNative from "./ButtonNative";

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: "cancel" | "default" | "destructive";
}

interface DropdownButtonNativeProps {
  text: string;
  actions: Action[];
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  style?: any;
}

export default function DropdownButtonNative({
  text,
  actions,
  variant = "secondary",
  size = "medium",
  style,
}: DropdownButtonNativeProps) {

  const handlePress = () => {
    // Filter out disabled actions
    const enabledActions = actions.filter(action => !action.disabled);
    
    if (enabledActions.length === 0) return;

    const alertButtons = enabledActions.map(action => ({
      text: action.label,
      onPress: action.onPress,
      style: action.style || "default",
    }));

    // Always add cancel button
    alertButtons.push({
      text: "Cancel",
      onPress: () => {}, // Empty function for cancel
      style: "cancel",
    });

    Alert.alert(
      "Options",
      "Choose an action",
      alertButtons
    );
  };

  return (
    <ButtonNative
      text={text}
      onPress={handlePress}
      variant={variant}
      size={size}
      style={style}
    />
  );
}