// components/notifications/NotificationBadgeNative.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NotificationBadgeNativeProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export default function NotificationBadgeNative({ 
  count, 
  size = 'medium',
  color = '#dc2626' 
}: NotificationBadgeNativeProps) {
  if (count <= 0) return null;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: 16, height: 16, fontSize: 10 };
      case 'large':
        return { width: 24, height: 24, fontSize: 12 };
      case 'medium':
      default:
        return { width: 20, height: 20, fontSize: 11 };
    }
  };

  const sizeStyles = getSizeStyles();
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <View style={[
      styles.badge, 
      { 
        backgroundColor: color,
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: sizeStyles.width / 2,
      }
    ]}>
      <Text style={[styles.badgeText, { fontSize: sizeStyles.fontSize }]}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});