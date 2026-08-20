// features/conversation/components/PendingRequestActionsNative.tsx
import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';

type AppTheme = ReturnType<typeof useUnistyles>['theme'];

interface PendingRequestActionsNativeProps {
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
  processingType: 'approve' | 'reject' | null;
}

// Godkjenn/avslå-knappene for en innkommende pending-samtale.
// Godkjenn = primær (gull), avslå = dempet nøytral flate.
export function PendingRequestActionsNative({
  onApprove,
  onReject,
  isProcessing,
  processingType,
}: PendingRequestActionsNativeProps) {
  const { theme } = useUnistyles();
  const styles = makeStyles(theme);

  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, styles.approveButton, isProcessing && styles.disabledButton]}
        onPress={onApprove}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        {isProcessing && processingType === 'approve' ? (
          <ActivityIndicator size={16} color={theme.colors.onPrimary} />
        ) : (
          <Check size={20} color={theme.colors.onPrimary} strokeWidth={3} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.rejectButton, isProcessing && styles.disabledButton]}
        onPress={onReject}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        {isProcessing && processingType === 'reject' ? (
          <ActivityIndicator size={16} color={theme.colors.textSecondary} />
        ) : (
          <X size={20} color={theme.colors.textSecondary} strokeWidth={3} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    actionButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    approveButton: {
      backgroundColor: theme.colors.primary,
    },
    rejectButton: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    disabledButton: {
      opacity: 0.6,
    },
  });
