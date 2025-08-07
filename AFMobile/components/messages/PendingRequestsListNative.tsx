// components/messages/PendingRequestsListNative.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePendingMessageRequests } from '@/hooks/messages/usePendingMessageRequests';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useRejectMessageRequest } from '@/hooks/messages/useRejectMessageRequest';
import { MessageRequestDTO } from '@shared/types/MessageReqeustDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { ConversationListItemNative } from './ConversationListItemNative';
import { useChatStore } from '@/store/useChatStore';

interface PendingRequestsListNativeProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation: (conversationId: number) => void;
}

export function PendingRequestsListNative({
  limit,
  showMoreLink = false,
  onSelectConversation,
}: PendingRequestsListNativeProps) {
  const { 
    requests, 
    isLoading, 
    error,
    removeRequest 
  } = usePendingMessageRequests();
  
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  
  const conversations = useChatStore((s) => s.conversations);

  const handleReject = async (r: MessageRequestDTO) => {
    if (r.conversationId == null) return;

    const requestType = r.isGroup ? "group invitation" : "message request";
    const actionText = r.isGroup ? "decline" : "reject";

    Alert.alert(
      r.isGroup ? "Decline Group Invitation" : "Reject Message Request",
      `Are you sure you want to ${actionText} the ${requestType} from ${r.senderName}${r.isGroup && r.groupName ? ` to join ${r.groupName}` : ''}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1), 
          style: "destructive",
          onPress: async () => {
            try {
              await reject(r.senderId, r.conversationId!, r.isGroup || false);
              removeRequest(r.conversationId!);
            } catch (error) {
              console.error('❌ Error rejecting request:', error);
              Alert.alert("Error", "Failed to reject request. Please try again.");
            }
          }
        }
      ]
    );
  };

  const handleApprove = async (r: MessageRequestDTO) => {
    if (r.conversationId !== null && r.conversationId !== undefined) {
      try {
        await approve(r.conversationId);
        console.log("✔ Approved conversation:", r.conversationId);
        removeRequest(r.conversationId);
      } catch (error) {
        console.error('❌ Error approving request:', error);
        Alert.alert("Error", "Failed to approve request. Please try again.");
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
        />
        
        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(r)}
            disabled={approving || rejecting}
          >
            <Text style={styles.actionButtonText}>✔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(r)}
            disabled={approving || rejecting}
          >
            <Text style={styles.actionButtonText}>✖</Text>
          </TouchableOpacity>
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
      <Text style={styles.pendingHeader}>Ventende forespørsler</Text>
      <FlatList
        data={visibleRequests}
        renderItem={renderPendingRequest}
        keyExtractor={(item) => `${item.senderId}-${item.conversationId ?? "privat"}`}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
      
      {showMoreLink && requests.length > (limit ?? 0) && (
        <TouchableOpacity style={styles.showMoreButton}>
          <Text style={styles.showMoreText}>See more</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pendingContainer: {
    paddingVertical: 8,
  },
  pendingHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pendingRequestContainer: {
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 60, // Align with conversation content
    paddingRight: 16,
    marginTop: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#1C6B1C',
  },
  rejectButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  showMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  showMoreText: {
    color: '#1C6B1C',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
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