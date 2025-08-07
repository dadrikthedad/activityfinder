// components/messages/NewMessageModalNative.tsx
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUserSearch } from '@/hooks/useUserSearch';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';
import NewMessageInputNative from './NewMessageInputNativ';

interface NewMessageModalNativeProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToChat?: (conversationId: number) => void;
}

export default function NewMessageModalNative({
  visible,
  onClose,
  onNavigateToChat,
}: NewMessageModalNativeProps) {
  const { query, setQuery, results, loading } = useUserSearch();
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const [groupName, setGroupName] = useState('');
  
  const searchInputRef = useRef<TextInput>(null);
  const isGroupMode = selectedUsers.length > 1;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedUsers([]);
      setGroupName('');
    }
  }, [visible, setQuery]);

  // Filter out already selected users
  const filteredResults = results.filter(
    (user) => !selectedUsers.some((u) => u.id === user.id)
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

  const handleMessageSent = useCallback((message: any) => {
    console.log('✅ Message sent:', message);
    if (message.conversationId && onNavigateToChat) {
      onNavigateToChat(message.conversationId);
    }
    onClose();
  }, [onNavigateToChat, onClose]);

  const handleGroupCreated = useCallback((response: any) => {
    console.log('✅ Group created:', response);
    if (response.conversationId && onNavigateToChat) {
      onNavigateToChat(response.conversationId);
    }
    onClose();
  }, [onNavigateToChat, onClose]);

  const renderSearchResult = ({ item: user }: { item: UserSummaryDTO }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleAddUser(user)}
    >
      <MiniAvatarNative
        imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
        alt={user.fullName}
        size={48}
        withBorder
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.fullName}</Text>
        {/* You can add additional user info here */}
      </View>
    </TouchableOpacity>
  );

  const renderSelectedUser = ({ item: user }: { item: UserSummaryDTO }) => (
    <View style={styles.selectedUserChip}>
      <MiniAvatarNative
        imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
        alt={user.fullName}
        size={32}
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

  const renderListHeader = () => (
    <View>
      {/* Search Input */}
      <View style={styles.searchSection}>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search people to message..."
          placeholderTextColor="#9ca3af"
          autoFocus
        />
      </View>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionTitle}>
            {isGroupMode ? 'Group Members' : 'To:'} ({selectedUsers.length})
          </Text>
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

      {/* Group Name Input (if group mode) */}
      {isGroupMode && (
        <View style={styles.groupNameSection}>
          <Text style={styles.sectionTitle}>Group Name (Optional)</Text>
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name..."
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>
      )}

      {/* Search Results Header */}
      {query && (
        <View style={styles.resultsHeader}>
          {loading && <Text style={styles.loadingText}>Loading...</Text>}
          {!loading && filteredResults.length === 0 && (
            <Text style={styles.noResultsText}>No users found</Text>
          )}
          {!loading && filteredResults.length > 0 && (
            <Text style={styles.sectionTitle}>
              Search Results ({filteredResults.length})
            </Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>New Message</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* User Search and Selection */}
          <FlatList
            data={query ? filteredResults : []}
            renderItem={renderSearchResult}
            keyExtractor={item => item.id.toString()}
            ListHeaderComponent={renderListHeader}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Message Input (shown when users are selected) */}
        {selectedUsers.length > 0 && (
          <View style={styles.messageInputContainer}>
            <NewMessageInputNative
              receiverId={!isGroupMode ? selectedUsers[0]?.id : undefined}
              selectedUsers={selectedUsers}
              groupName={groupName || undefined}
              shouldFocus={false}
              onMessageSent={handleMessageSent}
              onGroupCreated={handleGroupCreated}
            />
          </View>
        )}
      </KeyboardAvoidingView>
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
  },
  headerSpacer: {
    width: 60, // Same width as cancel button for centering
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
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
  selectedSection: {
    paddingHorizontal: 16,
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
    maxWidth: 100,
  },
  removeButton: {
    marginLeft: 4,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  groupNameSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  noResultsText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  messageInputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
});