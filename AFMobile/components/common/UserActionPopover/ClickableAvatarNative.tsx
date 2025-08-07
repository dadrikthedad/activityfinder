// components/common/ClickableAvatar.tsx
import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import MiniAvatarNative from "../MiniAvatarNative";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";

interface ClickableAvatarNativeProps {
  user: UserSummaryDTO;
  size?: number;
  style?: any; // React Native style instead of className
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  conversationId?: number;
  isPendingRequest?: boolean;
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
}: ClickableAvatarNativeProps) {
 
  const handlePress = () => {
    // For React Native, we don't need position calculation
    // The modal will center itself
    const position = { x: 0, y: 0 }; // Default position
   
    useUserActionPopoverStore.getState().show({
      user,
      position,
      isGroup,
      participants,
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