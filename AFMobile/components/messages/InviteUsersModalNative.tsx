// components/group/InviteUsersModalNative.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Keyboard,
} from 'react-native';
import { showNotificationToastNative } from '@/components/toast/NotificationToastNative';
import { LocalToastType } from '@/components/toast/NotificationToastNative';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUserSearchForGroupInvite } from '@/hooks/search/useUserSearchForGroupInvite';
import { useGroupRequests } from '@/hooks/messages/useGroupRequests';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';
import ButtonNative from '@/components/common/ButtonNative';
import AppHeader from '@/components/common/AppHeader';
import { X } from 'lucide-react-native';

interface InviteUsersModalNativeProps {
  visible: boolean;
  conversationId: number;
  groupName: string;
  existingParticipants?: UserSummaryDTO[];
  onClose: () => void;
  onInvitesSent?: (response: unknown) => void;
}

export default function InviteUsersModalNative({
  visible,
  conversationId,
  groupName,
  existingParticipants = [],
  onClose,
  onInvitesSent,
}: InviteUsersModalNativeProps) {
  const { query, setQuery, results, loading } = useUserSearchForGroupInvite(conversationId);
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const { sendGroupInvitations, isLoading, error } = useGroupRequests();
  
  const searchInputRef = useRef<TextInput>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelectedUsers([]);
    }
  }, [visible, setQuery]);

  // Filter out already selected users from results
  const filteredResults = results.filter(
    (user) => !selectedUsers.some((u) => u.id === user.id) &&
              !existingParticipants.some((p) => p.id === user.id)
  );

  const handleAddUser = useCallback((user: UserSummaryDTO) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setQuery('');
    searchInputRef.current?.focus();
  }, [selectedUsers, setQuery]);

  const handleRemoveUser = useCallback((userId: number) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
  }, []);

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const response = await sendGroupInvitations({
        conversationId,
        invitedUserIds: selectedUsers.map(u => u.id)
      });

      if (response) {
        console.log('✅ Invitasjoner sendt:', response);
        onInvitesSent?.(response);
        
        // Show success toast
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Invitations Sent!",
          customBody: `Successfully invited ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} to ${groupName}`,
          position: 'top'
        });
        
        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error('❌ Feil ved sending av invitasjoner:', err);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: "Failed to send invitations. Please try again.",
        position: 'top'
      });
    }
  };

  // Create sections data for FlatList
  const createSectionsData = () => {
    const sections: any[] = [];
    
    // Search section (header er nå separat)
    sections.push({ type: 'search' });
    
    // Search results section
    if (query) {
      if (loading) {
        sections.push({ type: 'loading' });
      } else if (filteredResults.length === 0) {
        sections.push({ type: 'no-results' });
      } else {
        filteredResults.forEach(user => {
          sections.push({ type: 'search-result', data: user });
        });
      }
    }
    
    // Selected users section
    if (selectedUsers.length > 0) {
      sections.push({ type: 'selected-header' });
      sections.push({ type: 'selected-users' });
    }
    
    // Existing participants section
    if (existingParticipants.length > 0) {
      sections.push({ type: 'existing-header' });
      sections.push({ type: 'existing-participants' });
    }
    
    // Error section
    if (error) {
      sections.push({ type: 'error' });
    }
    
    return sections;
  };

  const renderSectionItem = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'search':
        return (
          <View style={styles.searchSection}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search users to invite..."
              placeholderTextColor="#9ca3af"
              autoFocus
            />
          </View>
        );

      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        );

      case 'no-results':
        return (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No users found</Text>
          </View>
        );

      case 'search-result':
        return (
          <TouchableOpacity
            style={styles.searchResultItem}
            onPress={() => handleAddUser(item.data)}
          >
            <MiniAvatarNative
              imageUrl={item.data.profileImageUrl ?? '/default-avatar.png'}
              alt={item.data.fullName}
              size={40}
              withBorder
            />
            <Text style={styles.searchResultName}>{item.data.fullName}</Text>
          </TouchableOpacity>
        );

      case 'selected-header':
        return (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>Selected Users ({selectedUsers.length})</Text>
          </View>
        );

      case 'selected-users':
        return (
          <View style={styles.selectedUsersContainer}>
            <FlatList
              horizontal
              data={selectedUsers}
              renderItem={({ item: user }) => (
                <View style={styles.selectedUserChip}>
                  <MiniAvatarNative
                    imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
                    alt={user.fullName}
                    size={24}
                    withBorder={false}
                  />
                  <Text style={styles.selectedUserName}>{user.fullName}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveUser(user.id)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.selectedUsersList}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        );

      case 'existing-header':
        return (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>
              Current Members ({existingParticipants.length})
            </Text>
          </View>
        );

      case 'existing-participants':
        return (
          <View style={styles.existingParticipantsContainer}>
            <FlatList
              horizontal
              data={existingParticipants}
              renderItem={({ item: participant }) => (
                <View style={styles.existingParticipantChip}>
                  <MiniAvatarNative
                    imageUrl={participant.profileImageUrl ?? '/default-avatar.png'}
                    alt={participant.fullName}
                    size={20}
                    withBorder={false}
                  />
                  <Text style={styles.existingParticipantName}>{participant.fullName}</Text>
                </View>
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.existingParticipantsList}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        );

      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* App Header */}
        <AppHeader
          title={`Invite to ${groupName}`}
          onBackPress={onClose}
          backIcon={X}
        />
        
        <FlatList
          data={createSectionsData()}
          renderItem={renderSectionItem}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
        
        {/* Send Button at bottom */}
        {selectedUsers.length > 0 && (
          <View style={styles.sendButtonContainer}>
            <ButtonNative
              text={isLoading ? 'Sending...' : `Send Invitations (${selectedUsers.length})`}
              onPress={handleSendInvitations}
              variant="primary"
              disabled={selectedUsers.length === 0 || isLoading}
              fullWidth
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingBottom: 20,
  },
  sendButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#6b7280',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  searchResultName: {
    fontSize: 16,
    color: '#1f2937',
  },
  sectionHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  selectedUsersContainer: {
    paddingHorizontal: 16,
  },
  selectedUsersList: {
    paddingBottom: 8,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 8,
  },
  selectedUserName: {
    fontSize: 14,
    color: '#1f2937',
  },
  removeButton: {
    marginLeft: 4,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  existingParticipantsContainer: {
    paddingHorizontal: 16,
  },
  existingParticipantsList: {
    paddingBottom: 8,
  },
  existingParticipantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  existingParticipantName: {
    fontSize: 12,
    color: '#6b7280',
  },
  moreParticipantsText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
});