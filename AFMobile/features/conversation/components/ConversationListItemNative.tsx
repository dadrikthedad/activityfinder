import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useConversationStore } from "@/store/useConversationStore";
import ClickableAvatarNative from "@/components/common/ClickableAvatarNative";

interface ConversationListItemNativeProps {
  user: UserSummaryDTO;
  selected?: boolean;
  onClick?: () => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  hasUnread?: boolean;
  isGroup?: boolean;
  memberCount?: number;
  participants?: UserSummaryDTO[];
  navigation?: any;
}

export const ConversationListItemNative = ({
  user,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
  isPendingApproval = false,
  hasUnread = false,
  isGroup = false,
  memberCount,
  participants,
  navigation,
}: ConversationListItemNativeProps) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const storeConversation = useConversationStore((s) =>
    isGroup ? s.conversations.find((c) => String(c.id) === user.id) : null
  );
  // Store-samtaler har deltakere på nytt format ({ user, status, role }) — map til UserSummaryDTO
  const finalParticipants =
    participants ?? storeConversation?.participants?.map((p) => p.user) ?? [];

  const borderColor = selected
    ? theme.colors.primary
    : isPendingApproval
    ? theme.colors.warning
    : "transparent";

  const borderWidth = selected || isPendingApproval ? 2 : 1;

  const backgroundColor = selected ? theme.colors.primaryLight : "transparent";

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        marginHorizontal: theme.spacing.sm,
        marginVertical: 4,
        borderRadius: theme.radii.md,
        alignItems: "center",
        borderWidth,
        borderColor,
        backgroundColor,
      }}
      onPress={onClick}
      disabled={!isClickable}
    >
      <View style={{ position: "relative", marginRight: theme.spacing.sm }}>
        <ClickableAvatarNative
          user={user}
          size={50}
          isGroup={isGroup}
          participants={finalParticipants}
          isPendingRequest={isPendingApproval}
          conversationId={typeof user.id === "number" ? user.id : undefined}
          navigation={navigation}
        />
        {hasUnread && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              backgroundColor: theme.colors.success,
              borderRadius: theme.radii.full,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: theme.typography.sm, fontWeight: "600", color: theme.colors.textPrimary, marginBottom: 2 }}
          numberOfLines={1}
        >
          {user.fullName}
        </Text>

        {isGroup && memberCount != null ? (
          <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted }} numberOfLines={1}>
            {t("conversation.memberCount", { count: memberCount })}
          </Text>
        ) : subtitle ? (
          <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};
