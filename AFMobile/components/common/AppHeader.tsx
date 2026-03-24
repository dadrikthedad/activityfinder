// components/common/AppHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowBigLeft, LucideIcon } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();

  // Sjekk om vi skal sentrere tittelen
  const shouldCenterTitle = onBackPress && BackIcon && rightButtons.length === 0;

  return (
    <View style={[
      {
        backgroundColor: theme.colors.navbar,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: theme.colors.border,
      },
    ]}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        paddingBottom: 6,
        gap: theme.spacing.md,
      }}>
        {/* Back Button */}
        {onBackPress && BackIcon && (
          <TouchableOpacity
            onPress={onBackPress}
            style={{ padding: 8, marginLeft: -8, borderRadius: theme.radii.sm }}
          >
            <ArrowBigLeft size={24} color={theme.colors.navbarText} />
          </TouchableOpacity>
        )}

        {/* Title Section */}
        <View style={[
          { flex: 1, minWidth: 0 },
          shouldCenterTitle && { alignItems: 'center', justifyContent: 'center' },
        ]}>
          <Text
            style={[
              {
                fontSize: theme.typography.lg,
                fontWeight: theme.typography.semibold,
                color: theme.colors.navbarText,
              },
              !subtitle && { marginTop: 0, marginBottom: 0, paddingBottom: 2 },
              shouldCenterTitle && { textAlign: 'center' },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={[
              {
                fontSize: theme.typography.sm,
                color: theme.colors.navbarText,
                opacity: 0.8,
                marginTop: 2,
              },
              shouldCenterTitle && { textAlign: 'center' },
            ]}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Buttons */}
        {rightButtons.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            {rightButtons.map((button, index) => {
              const IconComponent = button.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={{
                    padding: 8,
                    borderRadius: theme.radii.sm,
                    backgroundColor: theme.colors.navbar,
                  }}
                  onPress={button.onPress}
                  testID={button.testID}
                >
                  <IconComponent size={20} color={theme.colors.navbarText} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Spacer if no back button */}
        {!onBackPress && (
          <View style={{ width: 40 }} />
        )}

        {/* Invisible spacer for centering when only back button exists */}
        {shouldCenterTitle && (
          <View style={{ width: 40 }} />
        )}
      </View>
    </View>
  );
}