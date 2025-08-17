// components/common/ClickableAvatarNative.tsx
import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import MiniAvatarNative from "../MiniAvatarNative";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useUserActionPopover } from "@/context/UserActionPopoverContext"; // 👈 ADDED
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
  navigation?: any; // Still needed for GroupSettings navigation
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
}: ClickableAvatarNativeProps) {
  const currentUser = useCurrentUser();
  const { showPopover } = useUserActionPopover(); // 👈 USE CONTEXT

  const handlePress = (event: any) => {
    // Get touch position for popover placement
    const { pageX, pageY } = event.nativeEvent;
    
    // If it's a group and we have navigation and conversationId, navigate to GroupSettings
    if (isGroup && navigation && conversationId && currentUser) {
      navigation.navigate('GroupSettingsScreen', {
        user: currentUser,
        conversationId: conversationId,
      });
      return;
    }
    
    // Otherwise, show the popover using context
    console.log('🎯 ClickableAvatar clicked for:', user.fullName);
    
    showPopover({
      user,
      position: { x: pageX || 100, y: pageY || 100 },
      isGroup,
      participants: participants || [],
      onLeaveGroup,
      conversationId,
      isPendingRequest,
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
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
  },
});