// features/messages/components/SelectedUserChip.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import MiniAvatarNative from "@/components/common/MiniAvatarNative";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";

interface Props {
  user: UserSearchResultDTO;
  removable?: boolean;
  onRemove?: (userId: string) => void;
}

export default function SelectedUserChip({ user, removable = true, onRemove }: Props) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: theme.radii.full,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 6,
        marginRight: theme.spacing.sm,
      }}
    >
      <MiniAvatarNative imageUrl={user.profileImageUrl} alt={user.fullName} size={28} withBorder={false} />
      <Text
        style={{ fontSize: theme.typography.sm, color: theme.colors.textPrimary, maxWidth: 120 }}
        numberOfLines={1}
      >
        {user.fullName}
      </Text>
      {removable && onRemove && (
        <TouchableOpacity onPress={() => onRemove(user.id)} hitSlop={8}>
          <X size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
