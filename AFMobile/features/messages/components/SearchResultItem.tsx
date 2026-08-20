// features/messages/components/SearchResultItem.tsx
import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import MiniAvatarNative from "@/components/common/MiniAvatarNative";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";

interface Props {
  user: UserSearchResultDTO;
  onPress: (user: UserSearchResultDTO) => void;
}

export default function SearchResultItem({ user, onPress }: Props) {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      onPress={() => onPress(user)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <MiniAvatarNative imageUrl={user.profileImageUrl} alt={user.fullName} size={48} withBorder />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: theme.typography.md,
            fontWeight: theme.typography.medium,
            color: theme.colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {user.fullName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
