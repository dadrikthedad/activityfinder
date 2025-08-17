import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';

interface AttachmentPickerButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const AttachmentPickerButton: React.FC<AttachmentPickerButtonProps> = ({
  onPress,
  disabled = false,
  size = 24,
  color = "#ffffff",
  backgroundColor = "#1C6B1C",
  style,
  icon,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? '#9CA3AF' : backgroundColor },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon || <Plus size={size} color={color} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
});