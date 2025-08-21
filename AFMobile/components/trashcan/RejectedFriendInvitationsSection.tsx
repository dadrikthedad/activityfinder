import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { UserCheck, UserX } from 'lucide-react-native';
import { FriendInvitationDTO } from '@shared/types/FriendInvitationDTO';
import { useFriendRequestHandlerNative } from '@/hooks/friends/useFriendInvitationsHandlerNative';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import SearchInput from './SearchInput';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';

interface RejectedFriendInvitationsSectionProps {
  rejectedInvitations: FriendInvitationDTO[];
  isLoading: boolean;
  error: string | null;
  navigation: any;
  onError: (message: string) => void;
  onRefetch: () => void;
}

export default function RejectedFriendInvitationsSection({
  rejectedInvitations,
  isLoading,
  error,
  navigation,
  onError,
  onRefetch,
}: RejectedFriendInvitationsSectionProps) {
  const [searchText, setSearchText] = useState('');
  const { handleResponse, handlingId } = useFriendRequestHandlerNative();
  const { confirm } = useConfirmModalNative();

  // Filter rejected invitations based on search
  const filteredInvitations = useMemo(() => {
    if (!searchText.trim()) return rejectedInvitations;
    const searchLower = searchText.toLowerCase();
    return rejectedInvitations.filter(invitation => 
      invitation.userSummary.fullName.toLowerCase().includes(searchLower)
    );
  }, [rejectedInvitations, searchText]);

  const handleAcceptInvitation = useCallback(async (invitation: FriendInvitationDTO) => {
    const confirmed = await confirm({
      title: 'Accept Friend Request',
      message: `Are you sure you want to accept the friend request from ${invitation.userSummary.fullName}?`
    });

    if (confirmed) {
      try {
        // 🆕 Send med userSummary for rejected invitations
        await handleResponse(invitation.id, 'accept', {
          userSummary: {
            id: invitation.userSummary.id,
            fullName: invitation.userSummary.fullName,
            profileImageUrl: invitation.userSummary.profileImageUrl
          }
        });
        
        // 🎉 Show success toast
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Friend Request Accepted",
          customBody: `You are now friends with ${invitation.userSummary.fullName}!`,
          position: 'top'
        });

        onRefetch(); // Refresh the list
      } catch (error) {
        console.error('❌ Could not accept invitation:', error);
        onError('Could not accept friend request');
      }
    }
  }, [confirm, handleResponse, onError, onRefetch]);

  const renderRejectedInvitationItem = useCallback((invitation: FriendInvitationDTO) => {
    const isHandling = handlingId === invitation.id;
    
    return (
      <View key={invitation.id} style={styles.invitationContainer}>
        <View style={styles.invitationContent}>
          <ClickableAvatarNative
            user={invitation.userSummary}
            size={60}
            navigation={navigation}
          />
          
          <View style={styles.invitationInfo}>
            <Text style={styles.invitationUserName}>{invitation.userSummary.fullName}</Text>
            <Text style={styles.invitationSubtitle}>
              Friend request rejected • {new Date(invitation.sentAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleAcceptInvitation(invitation)}
            disabled={isHandling}
            style={[styles.button, styles.acceptButton]}
          >
            {isHandling ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <UserCheck size={16} color="white" />
                <Text style={styles.buttonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [navigation, handleAcceptInvitation, handlingId]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rejected Friend Requests</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7280" />
          <Text style={styles.loadingText}>Loading rejected invitations...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rejected Friend Requests</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading rejected invitations</Text>
          <TouchableOpacity onPress={onRefetch} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (rejectedInvitations.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Rejected Friend Requests ({rejectedInvitations.length})
      </Text>
      <Text style={styles.sectionSubtitle}>
        Friend requests you have rejected
      </Text>
      
      <SearchInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search rejected invitations..."
      />
      
      {filteredInvitations.length === 0 && searchText.trim() ? (
        <Text style={styles.noResultsText}>
          No rejected invitations match "{searchText}"
        </Text>
      ) : (
        <View style={styles.scrollableContainer}>
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {filteredInvitations.map((invitation) => renderRejectedInvitationItem(invitation))}
          </ScrollView>
        </View>
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
  invitationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  invitationSubtitle: {
    fontSize: 13,
    color: '#6B7280',
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
  acceptButton: {
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
  scrollableContainer: {
    maxHeight: 500,
    minHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
});