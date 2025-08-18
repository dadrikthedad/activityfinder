// components/common/ClickableAvatarNative.tsx
import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import MiniAvatarNative from "./MiniAvatarNative";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useCurrentUser } from "@/store/useUserCacheStore";

interface ClickableAvatarNativeProps {
  user: UserSummaryDTO;
  size?: number;
  style?: any;
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  conversationId?: number;
  isPendingRequest?: boolean;
  navigation?: any; // Make optional since we might use onPress instead
  closeModalOnAction?: boolean;
  onPress?: () => void; // Add the custom onPress prop
}

export default function ClickableAvatarNative({
  user,
  size = 60,
  style,
  isGroup = false,
  participants,
  onLeaveGroup,
  conversationId,
  isPendingRequest = false,
  navigation,
  closeModalOnAction = true,
  onPress, // Add onPress to destructuring
}: ClickableAvatarNativeProps) {
  const currentUser = useCurrentUser();
  
  const handlePress = () => {
    // If custom onPress is provided, use that instead
    if (onPress) {
      onPress();
      return;
    }

    // Check if navigation is available for default behavior
    if (!navigation) {
      console.error('ClickableAvatarNative: navigation prop is required when onPress is not provided');
      return;
    }

    // If it's a group and we have conversationId, navigate to GroupSettings
    if (isGroup && conversationId) {
      navigation.navigate('GroupSettingsScreen', {
        user: user, // Send the group data, not currentUser
        conversationId: conversationId,
      });
      return;
    }
    
    // For individual users, use push to allow multiple profile screens
    console.log('🎯 ClickableAvatar clicked for:', user.fullName, 'ID:', user.id);
   
    navigation.push('Profile', {
      id: user.id.toString()
    });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, style]}
      activeOpacity={0.7}
    >
      <MiniAvatarNative
        imageUrl={user.profileImageUrl ?? (isGroup ? "/default-group.png" : "/default-avatar.png")}
        size={size}
        alt={user.fullName}
        withBorder={true}
        isGroup={isGroup} // Pass isGroup prop to MiniAvatarNative
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
  },
});