// components/common/HighlightedTextNative.tsx
import React from 'react';
import { Text, TextStyle } from 'react-native';

interface HighlightedTextNativeProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export const HighlightedTextNative: React.FC<HighlightedTextNativeProps> = ({ 
  children, 
  style 
}) => (
  <Text 
    style={[
      {
        fontWeight: 'bold',
        color: '#1C6B1C', // Same green color as web version
      },
      style // Allow custom overrides
    ]}
  >
    {children}
  </Text>
);

// Alternative with more styling options
export const HighlightedTextNativeAdvanced: React.FC<{
  children: React.ReactNode;
  color?: string;
  weight?: 'normal' | 'bold' | '600' | '700';
  style?: TextStyle;
}> = ({ 
  children, 
  color = '#1C6B1C',
  weight = 'bold',
  style 
}) => (
  <Text 
    style={[
      {
        fontWeight: weight,
        color: color,
      },
      style
    ]}
  >
    {children}
  </Text>
);