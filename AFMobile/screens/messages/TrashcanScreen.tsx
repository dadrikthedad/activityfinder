import React, { useEffect, useState } from 'react';
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity, 
 Image, 
 ActivityIndicator,
} from 'react-native';
import { Trash2, Check, RefreshCw } from 'lucide-react-native';
import { useGetDeletedConversations } from '@/hooks/messages/useGetDeletedConversations';
import { useGetRejectedConversations } from '@/hooks/messages/useGetRejectedConversations';
import { useRestoreConversation } from '@/hooks/messages/useRestoreConversation';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useDeleteGroupRequest } from '@/hooks/messages/useDeleteGroupRequest';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useAuth } from '@/context/AuthContext';
import { ConversationListItemNative } from '@/components/messages/ConversationListItemNative';

interface TrashcanScreenProps {
  navigation: any;
}

export default function TrashcanScreen({ navigation }: TrashcanScreenProps) {
  const [deletedGroupRequestMessage, setDeletedGroupRequestMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { 
    deletedConversations, 
    isLoading: deletedLoading, 
    error: deletedError, 
    refetch: refetchDeleted 
  } = useGetDeletedConversations();
  
  const { 
    rejectedConversations, 
    isLoading: rejectedLoading, 
    error: rejectedError, 
    refetch: refetchRejected 
  } = useGetRejectedConversations();
  
  const { restoreConversationMutation, isRestoring } = useRestoreConversation();
  const { approve, loading: isApproving } = useApproveMessageRequest();
  const { deleteRequest, isLoading: isDeletingGroupRequest, error: deleteError } = useDeleteGroupRequest();
  const { confirm } = useConfirmModalNative();

  const { userId: currentUserId } = useAuth();

  // Helper function to show temporary success message
  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Helper function to show temporary error message
  const showErrorMessage = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleRestore = async (conversationId: number) => {
    const confirmed = await confirm({
      title: 'Restore Conversation',
      message: 'Are you sure you want to restore this conversation?'
    });

    if (confirmed) {
      try {
        await restoreConversationMutation(conversationId);
        await refetchDeleted();
        showSuccessMessage('Conversation restored!');
      } catch (error) {
        console.error('❌ Could not restore conversation:', error);
        showErrorMessage('Could not restore conversation');
      }
    }
  };

  const handleApprove = async (conversationId: number) => {
    const confirmed = await confirm({
      title: 'Approve Conversation',
      message: 'Are you sure you want to approve this conversation?'
    });

    if (confirmed) {
      try {
        await approve(conversationId);
        await refetchRejected();
        showSuccessMessage('Conversation approved!');
      } catch (error) {
        console.error('❌ Could not approve conversation:', error);
        showErrorMessage('Could not approve conversation');
      }
    }
  };

  const handleDeleteGroupRequest = async (conversationId: number) => {
    const confirmed = await confirm({
      title: 'Confirm deletion',
      message: 'Are you sure you want to delete this group request?'
    });

    if (confirmed) {
      try {
        const result = await deleteRequest(conversationId);
        await refetchRejected();
        
        if (result?.message) {
          setDeletedGroupRequestMessage(result.message);
          setTimeout(() => setDeletedGroupRequestMessage(null), 5000);
        }
        
        showSuccessMessage(result?.message || 'Group request deleted');
      } catch (error) {
        console.error('❌ Could not delete group request:', error);
        showErrorMessage('Could not delete group request');
      }
    }
  };

  const getOtherParticipant = (participants: UserSummaryDTO[], currentUserId?: number): UserSummaryDTO | null => {
    if (!participants?.length) {
      return null;
    }

    if (!currentUserId) {
      return participants[0];
    }

    const otherParticipant = participants.find(p => p.id !== currentUserId);
    return otherParticipant || participants[0];
  };

  const handleRefresh = async () => {
    await Promise.all([refetchDeleted(), refetchRejected()]);
  };

  const renderConversationItem = (
    conversation: any,
    type: 'deleted' | 'rejected'
  ) => {
    const otherParticipant = getOtherParticipant(
      conversation.participants, 
      currentUserId ?? undefined
    );
    const isGroup = conversation.isGroup;
    
    // Create user object for ConversationListItemNative
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
        {/* Use ConversationListItemNative for consistent styling */}
        <View style={styles.conversationItemWrapper}>
          <ConversationListItemNative
            user={userForDisplay}
            isGroup={isGroup}
            participants={conversation.participants}
            memberCount={isGroup ? conversation.participants?.length : undefined}
            subtitle={`ID: ${conversation.id}`}
            isClickable={false}
            isPendingApproval={type === 'rejected'}
            navigation={navigation}
          />
        </View>
        
        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {type === 'deleted' && (
            <TouchableOpacity
              onPress={() => handleRestore(conversation.id)}
              disabled={isRestoring}
              style={[styles.button, styles.actionButton]}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <RefreshCw size={16} color="white" />
                  <Text style={styles.buttonText}>Restore</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {type === 'rejected' && (
            <>
              {isGroup ? (
                <TouchableOpacity
                  onPress={() => handleDeleteGroupRequest(conversation.id)}
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
                  onPress={() => handleApprove(conversation.id)}
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
            </>
          )}
        </View>
      </View>
    );
  };

  // Check if both sections are empty (not loading and no data)
  const isDeletedEmpty = !deletedLoading && deletedConversations.length === 0;
  const isRejectedEmpty = !rejectedLoading && rejectedConversations.length === 0;
  const isBothEmpty = isDeletedEmpty && isRejectedEmpty && !deletedError && !rejectedError;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Message */}
        {(deletedGroupRequestMessage || successMessage) && (
          <View style={styles.successMessage}>
            <View style={styles.successIndicator} />
            <Text style={styles.successText}>
              {deletedGroupRequestMessage || successMessage}
            </Text>
          </View>
        )}

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorMessage}>
            <View style={styles.errorIndicator} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Show empty state if both sections are empty */}
        {isBothEmpty ? (
          <View style={styles.emptyTrashcanContainer}>
            <View style={styles.emptyTrashcanIcon}>
              <Trash2 size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTrashcanTitle}>Your trashcan is empty</Text>
            <Text style={styles.emptyTrashcanSubtitle}>
              Deleted and rejected conversations will appear here
            </Text>
          </View>
        ) : (
          <>
            {/* Deleted Conversations - only show if not empty or loading/error */}
            {(!isDeletedEmpty || deletedLoading || deletedError) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Deleted Conversations ({deletedConversations.length})
                </Text>
                
                {deletedLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#1C6B1C" />
                    <Text style={styles.loadingText}>Loading deleted conversations...</Text>
                  </View>
                )}
                
                {deletedError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error loading: {deletedError}</Text>
                  </View>
                )}
                
                {deletedConversations.map((conversation) => 
                  renderConversationItem(conversation, 'deleted')
                )}
              </View>
            )}
            
            {/* Rejected Conversations - only show if not empty or loading/error */}
            {(!isRejectedEmpty || rejectedLoading || rejectedError || deleteError) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Rejected Conversations ({rejectedConversations.length})
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Delete request to be eligible for group invitations again
                </Text>
                
                {rejectedLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#1C6B1C" />
                    <Text style={styles.loadingText}>Loading rejected conversations...</Text>
                  </View>
                )}
                
                {rejectedError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error loading: {rejectedError}</Text>
                  </View>
                )}

                {deleteError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                      Error deleting group request: {deleteError}
                    </Text>
                  </View>
                )}
                
                {rejectedConversations.map((conversation) => 
                  renderConversationItem(conversation, 'rejected')
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#047857',
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 8,
  },
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
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 32,
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
  emptyTrashcanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTrashcanIcon: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTrashcanTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyTrashcanSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});