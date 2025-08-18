// components/messages/PendingRequestsListNative.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { usePendingMessageRequests } from '@/hooks/messages/usePendingMessageRequests';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useRejectMessageRequest } from '@/hooks/messages/useRejectMessageRequest';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { MessageRequestDTO } from '@shared/types/MessageReqeustDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { ConversationListItemNative } from './ConversationListItemNative';
import { useChatStore } from '@/store/useChatStore';
import ButtonNative from '@/components/common/buttons/ButtonNative';

interface PendingRequestsListNativeProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation: (conversationId: number) => void;
  onShowMore?: () => void; // Ny prop for "Se mer" funksjonalitet
  navigation: any;
}

export function PendingRequestsListNative({
  limit,
  showMoreLink = false,
  onSelectConversation,
  onShowMore,
  navigation
}: PendingRequestsListNativeProps) {
  const { 
    requests, 
    isLoading, 
    error,
    removeRequest 
  } = usePendingMessageRequests();
  
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  const { confirm } = useConfirmModalNative();
  
  const conversations = useChatStore((s) => s.conversations);

  const handleReject = async (r: MessageRequestDTO) => {
    if (r.conversationId == null) return;

    const requestType = r.isGroup ? "group invitation" : "message request";
    const actionText = r.isGroup ? "decline" : "reject";

    const confirmed = await confirm({
      title: r.isGroup ? "Decline Group Invitation" : "Reject Message Request",
      message: `Are you sure you want to ${actionText} the ${requestType} from ${r.senderName}${r.isGroup && r.groupName ? ` to join ${r.groupName}` : ''}?`
    });

    if (confirmed) {
      try {
        await reject(r.senderId, r.conversationId!, r.isGroup || false);
        removeRequest(r.conversationId!);
      } catch (error) {
        console.error('❌ Error rejecting request:', error);
        // You might want to show another modal or toast for errors
      }
    }
  };

  const handleApprove = async (r: MessageRequestDTO) => {
    if (r.conversationId !== null && r.conversationId !== undefined) {
      try {
        await approve(r.conversationId);
        console.log("✔ Approved conversation:", r.conversationId);
        removeRequest(r.conversationId);
      } catch (error) {
        console.error('❌ Error approving request:', error);
        // You might want to show another modal or toast for errors
      }
    }
  };

  const renderPendingRequest = ({ item: r }: { item: MessageRequestDTO }) => {
    const conversationFromStore = r.conversationId ? conversations.find(c => c.id === r.conversationId) : null;
    const storeParticipants = conversationFromStore?.participants || [];
    
    let participants: UserSummaryDTO[] = [];
    if (r.participants && Array.isArray(r.participants) && r.participants.length > 0) {
      participants = r.participants;
    } else if (storeParticipants.length > 0) {
      participants = storeParticipants;
    }
    
    const memberCount = r.isGroup ? (participants.length > 0 ? participants.length : 2) : undefined;

    return (
      <View style={styles.pendingRequestContainer}>
        {/* Hovedcontainer med samtale og knapper side ved side */}
        <View style={styles.conversationWithActions}>
          {/* Samtalekortet - tar opp mesteparten av plassen */}
          <View style={styles.conversationSection}>
            <ConversationListItemNative
              user={{
                id: r.isGroup ? r.conversationId ?? 0 : r.senderId,
                fullName: r.isGroup ? r.groupName ?? "Gruppe" : r.senderName,
                profileImageUrl: r.isGroup
                  ? r.groupImageUrl || null
                  : r.profileImageUrl || null,
              }}
              isClickable={true}
              isPendingApproval={true}
              onClick={() => {
                console.log("✅ Clicked on conversation:", r.conversationId);
                if (r.conversationId) {
                  onSelectConversation(r.conversationId);
                }
              }}
              isGroup={r.isGroup || false}
              memberCount={memberCount}
              participants={participants}
              navigation={navigation}
            />
          </View>
          
          {/* Action buttons til høyre */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(r)}
              disabled={approving || rejecting}
            >
              <Check size={20} color="white" strokeWidth={3} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(r)}
              disabled={approving || rejecting}
            >
              <X size={20} color="white" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading && requests.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1C6B1C" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No requests.</Text>
      </View>
    );
  }

  const visibleRequests = limit ? requests.slice(0, limit) : requests;

  return (
    <View style={styles.pendingContainer}>
      <Text style={styles.pendingHeader}>You have {requests.length} conversations that are pending:</Text>
      <FlatList
        data={visibleRequests}
        renderItem={renderPendingRequest}
        keyExtractor={(item) => `${item.senderId}-${item.conversationId ?? "privat"}`}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
      
      {showMoreLink && requests.length > (limit ?? 0) && (
        <View style={styles.showMoreContainer}>
          <ButtonNative
            text="See more"
            onPress={onShowMore || (() => {})}
            variant="primary"
            size="small"
            style={{ alignSelf: 'center' }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pendingContainer: {
  },
  pendingHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
  },
  pendingRequestContainer: {
  },
  conversationWithActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationSection: {
    flex: 1, // Tar opp mesteparten av plassen
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  approveButton: {
    backgroundColor: '#1C6B1C',
  },
  rejectButton: {
    backgroundColor: '#9CA3AF',
  },
  showMoreContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});