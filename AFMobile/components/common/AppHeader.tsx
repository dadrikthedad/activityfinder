// components/common/AppHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  backIcon?: LucideIcon;
  rightButtons?: Array<{
    icon: LucideIcon;
    onPress: () => void;
    testID?: string;
  }>;
  showBorder?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  onBackPress,
  backIcon: BackIcon,
  rightButtons = [],
  showBorder = true,
}: AppHeaderProps) {
  // Sjekk om vi skal sentrere tittelen
  const shouldCenterTitle = onBackPress && BackIcon && rightButtons.length === 0;

  return (
    <View style={[styles.header, !showBorder && styles.headerNoBorder]}>
      <View style={styles.headerContent}>
        {/* Back Button */}
        {onBackPress && BackIcon && (
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.backButton}
          >
            <BackIcon size={24} color="white" />
          </TouchableOpacity>
        )}

        {/* Title Section */}
        <View style={[
          styles.titleSection,
          shouldCenterTitle && styles.titleSectionCentered
        ]}>
          <Text
            style={[
              styles.title,
              !subtitle && styles.titleSingleLine,
              shouldCenterTitle && styles.titleCentered
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={[
              styles.subtitle,
              shouldCenterTitle && styles.subtitleCentered
            ]}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Buttons */}
        {rightButtons.length > 0 && (
          <View style={styles.rightButtons}>
            {rightButtons.map((button, index) => {
              const IconComponent = button.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.rightButton}
                  onPress={button.onPress}
                  testID={button.testID}
                >
                  <IconComponent size={20} color="#ffffff" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Spacer if no back button */}
        {!onBackPress && (
          <View style={styles.headerSpacer} />
        )}

        {/* Invisible spacer for centering when only back button exists */}
        {shouldCenterTitle && (
          <View style={styles.rightSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  headerNoBorder: {
    borderBottomWidth: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingBottom: 6,
    gap: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 6,
  },
  titleSection: {
    flex: 1,
    minWidth: 0,
  },
  titleSectionCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  titleSingleLine: {
    marginTop: 0,
    marginBottom: 0,
    paddingBottom: 2,
  },
  titleCentered: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  subtitleCentered: {
    textAlign: 'center',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#1C6B1C',
  },
  headerSpacer: {
    width: 40, // Same width as back button for balance
  },
  rightSpacer: {
    width: 40, // Same width as back button to balance the layout
  },
});