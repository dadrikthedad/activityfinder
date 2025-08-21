import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useRestoreConversation } from '@/hooks/messages/useRestoreConversation';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { ConversationListItemNative } from '@/components/messages/ConversationListItemNative';
import SearchInput from './SearchInput';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';

interface DeletedConversationsSectionProps {
  deletedConversations: any[];
  isLoading: boolean;
  error: string | null;
  currentUserId?: number;
  navigation: any;
  onError: (message: string) => void;
  onRefetch: () => void;
}

export default function DeletedConversationsSection({
  deletedConversations,
  isLoading,
  error,
  currentUserId,
  navigation,
  onError,
  onRefetch,
}: DeletedConversationsSectionProps) {
  const [searchText, setSearchText] = useState('');
  const { restoreConversationMutation, isRestoring } = useRestoreConversation();
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
    if (!searchText.trim()) return deletedConversations;
    const searchLower = searchText.toLowerCase();
    return deletedConversations.filter(conversation => {
      if (conversation.isGroup) {
        return conversation.groupName?.toLowerCase().includes(searchLower);
      } else {
        const otherParticipant = getOtherParticipant(conversation.participants, currentUserId);
        return otherParticipant?.fullName.toLowerCase().includes(searchLower);
      }
    });
  }, [deletedConversations, searchText, getOtherParticipant, currentUserId]);

  const handleRestore = useCallback(async (conversationId: number, conversation: any) => {
  const confirmed = await confirm({
    title: 'Restore Conversation',
    message: 'Are you sure you want to restore this conversation?'
  });

  if (confirmed) {
    try {
      await restoreConversationMutation(conversationId);
      await onRefetch();
      
      const otherParticipant = getOtherParticipant(conversation.participants, currentUserId);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Conversation Restored",
        customBody: `You can now message ${otherParticipant?.fullName || 'this user'} again!`,
        position: 'top'
      });
    } catch (error) {
      console.error('❌ Could not restore conversation:', error);
      onError('Could not restore conversation');
    }
  }
}, [confirm, restoreConversationMutation, onRefetch, onError, getOtherParticipant, currentUserId]);

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
            isPendingApproval={false}
            navigation={navigation}
          />
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleRestore(conversation.id, conversation)}
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
        </View>
      </View>
    );
  }, [getOtherParticipant, currentUserId, navigation, handleRestore, isRestoring]);

  if (isLoading || error || deletedConversations.length === 0) {
    if (deletedConversations.length === 0 && !isLoading && !error) {
      return null;
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Deleted Conversations ({deletedConversations.length})
      </Text>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1C6B1C" />
          <Text style={styles.loadingText}>Loading deleted conversations...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading: {error}</Text>
        </View>
      )}
      
      {!isLoading && !error && deletedConversations.length > 0 && (
        <>
          <SearchInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search deleted conversations..."
          />
          
          {filteredConversations.length === 0 && searchText.trim() ? (
            <Text style={styles.noResultsText}>
              No deleted conversations match "{searchText}"
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