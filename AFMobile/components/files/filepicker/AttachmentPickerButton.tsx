import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';

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
  color,
  backgroundColor,
  style,
  icon,
}) => {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? theme.colors.disabled : (backgroundColor ?? theme.colors.primary) },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon || <Plus size={size} color={color ?? theme.colors.onPrimary} />}
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
