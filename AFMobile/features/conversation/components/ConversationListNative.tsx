import React, { useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import { ConversationDTO, ConversationType } from "@shared/types/ConversationDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useConversationStore } from "@/store/useConversationStore";
import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationListItemNative } from "./ConversationListItemNative";

interface ConversationListNativeProps {
  selectedId: number | null;
  onSelect: (conversationId: number) => void;
  currentUser: UserSummaryDTO | null;
  conversations?: ConversationDTO[];
  navigation: any;
}

export default function ConversationListNative({
  selectedId,
  onSelect,
  currentUser,
  conversations: propConversations,
  navigation,
}: ConversationListNativeProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const storeConversations = useConversationStore((s) => s.conversations);
  const hasLoadedConversations = useConversationStore((s) => s.hasLoadedConversations);
  const unreadConversationIds = useConversationStore((s) => s.unreadConversationIds);

  const { loadMore, loading, hasMore } = usePaginatedConversations();

  const displayedConversations = propConversations ?? storeConversations;

  const handleLoadMore = useCallback(() => {
    if (propConversations || loading || !hasMore) return;
    loadMore();
  }, [propConversations, loading, hasMore, loadMore]);

  const renderConversation = ({ item: conv }: { item: ConversationDTO }) => {
    const hasUnread = unreadConversationIds.includes(conv.id);
    const isGroup = conv.type === ConversationType.GroupChat;
    const isPending = conv.type === ConversationType.PendingRequest;

    if (isGroup) {
      return (
        <ConversationListItemNative
          user={{
            id: String(conv.id),
            fullName: conv.groupName || t("conversation.unknownGroup"),
            profileImageUrl: conv.groupImageUrl || null,
          }}
          selected={selectedId === conv.id}
          isPendingApproval={isPending}
          hasUnread={hasUnread}
          onClick={() => onSelect(conv.id)}
          isGroup
          memberCount={conv.participants?.length ?? 0}
          participants={(conv.participants ?? []).map((p) => p.user)}
          navigation={navigation}
        />
      );
    }

    // Direkte samtale — navn og avatar ligger nå under participant.user
    const otherParticipant = conv.participants.find((p) => p.user.id !== currentUser?.id);
    if (!otherParticipant) return null;

    return (
      <ConversationListItemNative
        user={otherParticipant.user}
        selected={selectedId === conv.id}
        isPendingApproval={isPending}
        hasUnread={hasUnread}
        onClick={() => onSelect(conv.id)}
        isGroup={false}
        navigation={navigation}
      />
    );
  };

  if (!propConversations && !hasLoadedConversations && storeConversations.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: theme.spacing.lg }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (displayedConversations.length === 0 && !loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: theme.spacing.xl }}>
        <Text style={{ fontSize: theme.typography.lg, fontWeight: "600", color: theme.colors.textPrimary, marginBottom: theme.spacing.sm, textAlign: "center" }}>
          {t("conversation.emptyTitle")}
        </Text>
        <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 }}>
          {t("conversation.emptyHint")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <FlashList
        data={displayedConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        estimatedItemSize={66}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loading ? (
            <View style={{ paddingVertical: theme.spacing.md, alignItems: "center" }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
}
