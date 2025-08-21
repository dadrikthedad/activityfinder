import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Trash2, Check } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useDeleteGroupRequest } from '@/hooks/messages/useDeleteGroupRequest';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { ConversationListItemNative } from '@/components/messages/ConversationListItemNative';
import SearchInput from './SearchInput';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';

interface RejectedConversationsSectionProps {
  rejectedConversations: any[];
  isLoading: boolean;
  error: string | null;
  deleteError: string | null;
  currentUserId?: number;
  navigation: any;
  onError: (message: string) => void;
  onRefetch: () => void;
  onDeletedGroupRequestMessage: (message: string) => void;
}

export default function RejectedConversationsSection({
  rejectedConversations,
  isLoading,
  error,
  deleteError,
  currentUserId,
  navigation,
  onError,
  onRefetch,
  onDeletedGroupRequestMessage,
}: RejectedConversationsSectionProps) {
  const [searchText, setSearchText] = useState('');
  const { approve, loading: isApproving } = useApproveMessageRequest();
  const { deleteRequest, isLoading: isDeletingGroupRequest } = useDeleteGroupRequest();
  const { confirm } = useConfirmModalNative();

  const getOtherParticipant = useCallback((participants: UserSummaryDTO[], currentUserId?: number): UserSummaryDTO | null => {
    if (!participants?.length) {
      return null;
    }

    if (!currentUserId) {
      return participants[0];
    }

    const otherParticipant = participants.find(p => p.id !== currentUserId);
    return otherParticipant || participants[0];
  }, []);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchText.trim()) return rejectedConversations;
    const searchLower = searchText.toLowerCase();
    return rejectedConversations.filter(conversation => {
      if (conversation.isGroup) {
        return conversation.groupName?.toLowerCase().includes(searchLower);
      } else {
        const otherParticipant = getOtherParticipant(conversation.participants, currentUserId);
        return otherParticipant?.fullName.toLowerCase().includes(searchLower);
      }
    });
  }, [rejectedConversations, searchText, getOtherParticipant, currentUserId]);

  const handleApprove = useCallback(async (conversationId: number, conversation: any) => {
    const confirmed = await confirm({
      title: 'Approve Conversation',
      message: 'Are you sure you want to approve this conversation?'
    });

    if (confirmed) {
      try {
        await approve(conversationId);
        await onRefetch();
        
        const otherParticipant = getOtherParticipant(conversation.participants, currentUserId);
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Conversation Approved",
          customBody: `You can now message ${otherParticipant?.fullName || 'this user'}!`,
          position: 'top'
        }); 
      } catch (error) {
        console.error('❌ Could not approve conversation:', error);
        onError('Could not approve conversation');
      }
    }
  }, [confirm, approve, onRefetch, onError, getOtherParticipant, currentUserId]);

  const handleDeleteGroupRequest = useCallback(async (conversationId: number, conversation: any) => {
    const confirmed = await confirm({
      title: 'Confirm deletion',
      message: 'Are you sure you want to delete this group request?'
    });

    if (confirmed) {
      try {
        const result = await deleteRequest(conversationId);
        await onRefetch();
        
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Group Request Deleted",
          customBody: `Request for "${conversation.groupName || 'group'}" has been removed`,
          position: 'top'
        });
        
        if (result?.message) {
          onDeletedGroupRequestMessage(result.message);
        }
        
      } catch (error) {
        console.error('❌ Could not delete group request:', error);
        onError('Could not delete group request');
      }
    }
  }, [confirm, deleteRequest, onRefetch, onError, onDeletedGroupRequestMessage]);

  const renderConversationItem = useCallback((conversation: any) => {
    const otherParticipant = getOtherParticipant(
      conversation.participants, 
      currentUserId
    );
    const isGroup = conversation.isGroup;
    
    const userForDisplay = isGroup 
      ? {
          id: conversation.id,
          fullName: conversation.groupName || "Unnamed Group",
          profileImageUrl: conversation.groupImageUrl,
        }
      : otherParticipant || {
          id: conversation.id,
          fullName: "Unknown User",
          profileImageUrl: null,
        };

    return (
      <View key={conversation.id} style={styles.conversationContainer}>
        <View style={styles.conversationItemWrapper}>
          <ConversationListItemNative
            user={userForDisplay}
            isGroup={isGroup}
            participants={conversation.participants}
            memberCount={isGroup ? conversation.participants?.length : undefined}
            subtitle={`ID: ${conversation.id}`}
            isClickable={false}
            isPendingApproval={true}
            navigation={navigation}
          />
        </View>
        
        <View style={styles.actionButtons}>
          {isGroup ? (
            <TouchableOpacity
              onPress={() => handleDeleteGroupRequest(conversation.id, conversation)}
              disabled={isDeletingGroupRequest}
              style={[styles.button, styles.actionButton]}
            >
              {isDeletingGroupRequest ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Trash2 size={16} color="white" />
                  <Text style={styles.buttonText}>Delete Request</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleApprove(conversation.id, conversation)}
              disabled={isApproving}
              style={[styles.button, styles.actionButton]}
            >
              {isApproving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Check size={16} color="white" />
                  <Text style={styles.buttonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [getOtherParticipant, currentUserId, navigation, handleDeleteGroupRequest, isDeletingGroupRequest, handleApprove, isApproving]);

  if (isLoading || error || deleteError || rejectedConversations.length === 0) {
    if (rejectedConversations.length === 0 && !isLoading && !error && !deleteError) {
      return null;
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Rejected Conversations ({rejectedConversations.length})
      </Text>
      <Text style={styles.sectionSubtitle}>
        Delete request to be eligible for group invitations again
      </Text>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1C6B1C" />
          <Text style={styles.loadingText}>Loading rejected conversations...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading: {error}</Text>
        </View>
      )}

      {deleteError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Error deleting group request: {deleteError}
          </Text>
        </View>
      )}
      
      {!isLoading && !error && rejectedConversations.length > 0 && (
        <>
          <SearchInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search rejected conversations..."
          />
          
          {filteredConversations.length === 0 && searchText.trim() ? (
            <Text style={styles.noResultsText}>
              No rejected conversations match "{searchText}"
            </Text>
          ) : (
            <View style={styles.scrollableContainer}>
              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {filteredConversations.map((conversation) => renderConversationItem(conversation))}
              </ScrollView>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  conversationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  conversationItemWrapper: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: '#1C6B1C',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 6,
  },
  noResultsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  // ✅ Scrollable container styles
  scrollableContainer: {
    maxHeight: 500, // Increased height for conversations
    minHeight: 200, // Minimum height to ensure content is visible
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
});