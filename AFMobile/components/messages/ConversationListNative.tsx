import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { ConversationDTO } from '@shared/types/ConversationDTO';
import { useChatStore } from '@/store/useChatStore';
import { usePaginatedConversations } from '@/hooks/messages/getMyConversations';
import { ConversationListItemNative } from './ConversationListItemNative'; // Import from separate file
import { take } from '@/hooks/messages/getMyConversations'; // Import take constant

interface ConversationListNativeProps {
  selectedId: number | null;
  onSelect: (conversationId: number) => void;
  currentUser: UserSummaryDTO | null;
  conversations?: ConversationDTO[];
}

export default function ConversationListNative({
  selectedId,
  onSelect,
  currentUser,
  conversations: propConversations,
}: ConversationListNativeProps) {
  const { conversations: storeConversations } = useChatStore();
  const { loadMore, loading, hasMore } = usePaginatedConversations();
  const [hasAutoLoadedOnce, setHasAutoLoadedOnce] = useState(false);
  
  const getOtherUser = (conv: ConversationDTO): UserSummaryDTO | undefined => {
    return conv.participants.find(p => p.id !== currentUser?.id);
  };
  
  const displayedConversations = propConversations ?? storeConversations;
  const hasLoadedConversations = useChatStore((s) => s.hasLoadedConversations);
  const unreadConversationIds = useChatStore(state => state.unreadConversationIds);

  // Handle pagination loading
  const handleLoadMore = useCallback(() => {
    if (propConversations || loading || !hasMore) return;
    console.log("📥 Loading more conversations...");
    loadMore();
  }, [propConversations, loading, hasMore, loadMore]);

  // Auto-load if needed (similar to web version)
  useEffect(() => {
    if (
      hasAutoLoadedOnce ||
      propConversations ||
      !hasLoadedConversations ||
      storeConversations.length <= take // Use imported take constant
    ) return;

    if (!loading && hasMore) {
      console.log("🧪 Auto-loading more conversations");
      loadMore();
      setHasAutoLoadedOnce(true);
    }
  }, [
    storeConversations.length,
    loadMore,
    loading,
    hasMore,
    propConversations,
    hasLoadedConversations,
    hasAutoLoadedOnce,
  ]);

  const renderConversation = ({ item: conv }: { item: ConversationDTO }) => {
    const hasUnread = unreadConversationIds.includes(conv.id);
    const isGroup = conv.isGroup;
    const otherUser = getOtherUser(conv);

    if (isGroup) {
      return (
        <ConversationListItemNative
          user={{
            id: conv.id,
            fullName: conv.groupName || "Navnløs gruppe",
            profileImageUrl: conv.groupImageUrl || null,
          }}
          selected={selectedId === conv.id}
          isPendingApproval={conv.isPendingApproval}
          hasUnread={hasUnread}
          onClick={() => onSelect(conv.id)}
          isGroup={true}
          memberCount={conv.participants.length}
          participants={conv.participants}
        />
      );
    }

    if (!otherUser) return null;

    return (
      <ConversationListItemNative
        user={otherUser}
        selected={selectedId === conv.id}
        isPendingApproval={conv.isPendingApproval}
        hasUnread={hasUnread}
        onClick={() => onSelect(conv.id)}
        isGroup={false}
      />
    );
  };

  // Loading state
  if (!propConversations && !hasLoadedConversations && storeConversations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C6B1C" />
      </View>
    );
  }

  // Empty state
  if (displayedConversations.length === 0 && !loading) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Ingen samtaler ennå</Text>
        <Text style={styles.emptySubtext}>
          Start en ny samtale ved å trykke på + knappen
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#1C6B1C" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});