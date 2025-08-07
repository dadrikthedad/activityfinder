// components/group/InviteUsersModalNative.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Keyboard,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUserSearchForGroupInvite } from '@/hooks/search/useUserSearchForGroupInvite';
import { useGroupRequests } from '@/hooks/messages/useGroupRequests';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';
import ButtonNative from '@/components/common/ButtonNative';

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
        
        Alert.alert(
          'Success',
          `Sent invitations to ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}`,
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (err) {
      console.error('❌ Feil ved sending av invitasjoner:', err);
      Alert.alert('Error', 'Failed to send invitations. Please try again.');
    }
  };

  const renderSearchResult = ({ item: user, index }: { item: UserSummaryDTO; index: number }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleAddUser(user)}
    >
      <MiniAvatarNative
        imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
        alt={user.fullName}
        size={40}
        withBorder
      />
      <Text style={styles.searchResultName}>{user.fullName}</Text>
    </TouchableOpacity>
  );

  const renderSelectedUser = ({ item: user }: { item: UserSummaryDTO }) => (
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
  );

  const renderExistingParticipant = ({ item: participant }: { item: UserSummaryDTO }) => (
    <View style={styles.existingParticipantChip}>
      <MiniAvatarNative
        imageUrl={participant.profileImageUrl ?? '/default-avatar.png'}
        alt={participant.fullName}
        size={20}
        withBorder={false}
      />
      <Text style={styles.existingParticipantName}>{participant.fullName}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Invite to {groupName}</Text>
          
          <TouchableOpacity
            onPress={handleSendInvitations}
            style={[
              styles.sendButton,
              (selectedUsers.length === 0 || isLoading) && styles.sendButtonDisabled
            ]}
            disabled={selectedUsers.length === 0 || isLoading}
          >
            <Text style={[
              styles.sendButtonText,
              (selectedUsers.length === 0 || isLoading) && styles.sendButtonTextDisabled
            ]}>
              {isLoading ? 'Sending...' : `Send (${selectedUsers.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Search Input */}
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

          {/* Search Results */}
          {query && (
            <View style={styles.searchResults}>
              {loading && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              )}
              
              {!loading && filteredResults.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No users found</Text>
                </View>
              )}
              
              {!loading && filteredResults.length > 0 && (
                <FlatList
                  data={filteredResults}
                  renderItem={renderSearchResult}
                  keyExtractor={item => item.id.toString()}
                  style={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          )}

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <View style={styles.selectedSection}>
              <Text style={styles.sectionTitle}>Selected Users ({selectedUsers.length})</Text>
              <FlatList
                horizontal
                data={selectedUsers}
                renderItem={renderSelectedUser}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.selectedUsersList}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          {/* Existing Participants */}
          {existingParticipants.length > 0 && (
            <View style={styles.existingSection}>
              <Text style={styles.sectionTitle}>
                Current Members ({existingParticipants.length})
              </Text>
              <FlatList
                horizontal
                data={existingParticipants.slice(0, 10)} // Limit to first 10
                renderItem={renderExistingParticipant}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.existingParticipantsList}
                showsHorizontalScrollIndicator={false}
              />
              {existingParticipants.length > 10 && (
                <Text style={styles.moreParticipantsText}>
                  +{existingParticipants.length - 10} more
                </Text>
              )}
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  sendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1C6B1C',
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  sendButtonTextDisabled: {
    color: '#9ca3af',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchSection: {
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
  searchResults: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 16,
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
  resultsList: {
    maxHeight: 280,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  searchResultName: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectedSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
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
  existingSection: {
    marginBottom: 20,
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
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
});