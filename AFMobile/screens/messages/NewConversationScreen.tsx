import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import { ArrowLeft, Camera, Plus } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUserSearch } from '@/hooks/useUserSearch';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';
import AppHeader from '@/components/common/AppHeader';
import NewMessageInputNative from '@/components/messages/NewMessageInputNativ';
import { NewConversationScreenNavigationProp } from '@/types/navigation';
import { useChatStore } from '@/store/useChatStore';
import { useUploadGroupImageNative } from '@/hooks/files/useUploadGroupImageNative';
import { useAttachmentPicker } from '@/components/files/filepicker/useAttachmentPicker';
import { RNFile } from '@/utils/files/FileFunctions';
import { AttachmentPickerModal } from '@/components/files/filepicker/AttachmentPickerModal';

interface NewConversationScreenProps {
  navigation: NewConversationScreenNavigationProp;
}

export default function NewConversationScreen({
  navigation,
}: NewConversationScreenProps) {
  const { query, setQuery, results, loading } = useUserSearch();
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupImageUrl, setGroupImageUrl] = useState<string | null>(null);
  
  const { setCurrentConversationId } = useChatStore();
  const searchInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const isGroupMode = selectedUsers.length > 1;

  // Group image upload functionality
  const { upload: uploadGroupImage, uploading: uploadingImage, error: uploadError } = useUploadGroupImageNative();

  // Handle file selection for group image
  const handleGroupImageSelected = useCallback(async (files: RNFile[]) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Take first file (should be an image)
    
    try {
      console.log('🔄 Uploading group image for new conversation:', file.uri);
      
      // Convert RNFile to format expected by upload function
      const imageData = {
        uri: file.uri,
        type: file.type,
        name: file.name,
      };

      // For new conversations, we don't have a conversationId yet, so pass null/undefined
      const imageUrl = await uploadGroupImage(imageData);
      console.log('✅ Got imageUrl from API:', imageUrl);

      if (imageUrl) {
        setGroupImageUrl(imageUrl);
        console.log('📝 Set groupImageUrl to:', imageUrl);
      }
    } catch (err) {
      console.error('Failed to upload group image:', err);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  }, [uploadGroupImage]);

  // Use AttachmentPicker hook for group image
  const {
    showPicker: showImagePicker,
    showModal: showImageModal,
    setShowModal: setShowImageModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
  } = useAttachmentPicker({
    onFilesSelected: handleGroupImageSelected,
    allowMultipleImages: false, // Kun ett bilde for gruppebildet
    allowVideos: false, // Ikke tillat videoer for gruppebilde
    allowDocuments: false, // Ikke tillat dokumenter for gruppebilde
    imageQuality: 0.7, // God kvalitet for gruppebilde
    cameraQuality: 0.7, // God kvalitet for kamera
  });

  // Remove group image
  const removeGroupImage = useCallback(() => {
    setGroupImageUrl(null);
  }, []);

  // Reset state when component mounts
  useEffect(() => {
    setQuery('');
    setSelectedUsers([]);
    setGroupName('');
    setGroupImageUrl(null);
  }, [setQuery]);

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

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleMessageSent = useCallback((message: any) => {
    console.log('✅ Message sent:', message);
    if (message.conversationId) {
      // Set conversation ID in store
      setCurrentConversationId(message.conversationId);
      // Navigate to conversation
      navigation.navigate('ConversationScreen', { 
        conversationId: message.conversationId 
      });
    }
  }, [navigation, setCurrentConversationId]);

  const handleGroupCreated = useCallback((response: any) => {
    console.log('✅ Group created:', response);
    if (response.conversationId) {
      // Set conversation ID in store
      setCurrentConversationId(response.conversationId);
      // Navigate to conversation
      navigation.navigate('ConversationScreen', { 
        conversationId: response.conversationId 
      });
    }
  }, [navigation, setCurrentConversationId]);

  const renderSelectedUsers = () => {
    if (selectedUsers.length === 0) return null;

    return (
      <View style={styles.selectedSection}>
        <Text style={styles.sectionTitle}>
          {isGroupMode ? 'Group Members' : 'To:'} ({selectedUsers.length})
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedUsersList}
        >
          {selectedUsers.map((user) => (
            <View key={user.id} style={styles.selectedUserChip}>
              <MiniAvatarNative
                imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
                alt={user.fullName}
                size={32}
                withBorder={false}
              />
              <Text style={styles.selectedUserName} numberOfLines={1}>
                {user.fullName}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveUser(user.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Group info component - now inside ScrollView
  const renderGroupInfo = () => {
    if (!isGroupMode) return null;

    return (
      <View style={styles.groupInfo}>
        <Text style={styles.groupInfoText}>
          Creating group with {selectedUsers.length} members
          {groupName && `: "${groupName}"`}
          {groupImageUrl && ' 📷'}
        </Text>
        
        {/* Show selected users in compact format */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupInfoUsersList}
          contentContainerStyle={styles.groupInfoUsersContent}
        >
          {selectedUsers.map((user) => (
            <View key={user.id} style={styles.groupInfoUserChip}>
              <MiniAvatarNative
                imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
                alt={user.fullName}
                size={24}
                withBorder={false}
              />
              <Text style={styles.groupInfoUserName}>{user.fullName}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSearchResults = () => {
    if (!query) return null;

    return (
      <View style={styles.searchResultsSection}>
        {loading && <Text style={styles.loadingText}>Loading...</Text>}
        {!loading && filteredResults.length === 0 && (
          <Text style={styles.noResultsText}>No users found</Text>
        )}
        {!loading && filteredResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Search Results ({filteredResults.length})
            </Text>
            {filteredResults.map((user) => (
              <TouchableOpacity
                key={user.id}
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
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header using AppHeader */}
        <AppHeader
          title="New Message"
          onBackPress={handleBack}
          backIcon={ArrowLeft}
          showBorder={true}
        />

        {/* Main Content - scrollable area */}
        <View style={styles.content}>
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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

            {/* Search Results - moved to right under search input */}
            {renderSearchResults()}

            {/* Selected Users */}
            {renderSelectedUsers()}

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

            {/* Group Image Section (if group mode) */}
            {isGroupMode && (
              <View style={styles.groupImageSection}>
                <Text style={styles.sectionTitle}>Group Image (Optional)</Text>
                
                <View style={styles.groupImageContainer}>
                  {groupImageUrl ? (
                    <View style={styles.imageWithRemove}>
                      <MiniAvatarNative
                        imageUrl={groupImageUrl}
                        alt="Group"
                        size={80}
                        withBorder={true}
                      />
                      <TouchableOpacity
                        onPress={removeGroupImage}
                        style={styles.removeImageButton}
                      >
                        <Text style={styles.removeImageText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.emptyImageContainer}>
                      <Camera size={32} color="#9ca3af" />
                    </View>
                  )}
                  
                  <TouchableOpacity
                    onPress={showImagePicker}
                    style={styles.imageUploadButton}
                    disabled={uploadingImage}
                  >
                    <Plus size={16} color="#ffffff" />
                    <Text style={styles.imageUploadButtonText}>
                      {uploadingImage ? 'Uploading...' : groupImageUrl ? 'Change' : 'Add Image'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {uploadError && (
                  <Text style={styles.uploadErrorText}>Failed to upload image</Text>
                )}
              </View>
            )}

            {/* Group Info - moved inside ScrollView */}
            {renderGroupInfo()}
          </ScrollView>
        </View>

        {/* Fixed Message Input - always at bottom */}
        {selectedUsers.length > 0 && (
          <View style={styles.fixedMessageInputContainer}>
            <NewMessageInputNative
              receiverId={!isGroupMode ? selectedUsers[0]?.id : undefined}
              selectedUsers={selectedUsers}
              groupName={groupName || undefined}
              groupImageUrl={groupImageUrl}
              shouldFocus={false}
              onMessageSent={handleMessageSent}
              onGroupCreated={handleGroupCreated}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* AttachmentPickerModal for group image */}
      <AttachmentPickerModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
        onCamera={handleCamera}
        onImagePicker={handleImagePicker}
        onDocumentPicker={handleDocumentPicker}
        title="Choose Group Image"
        showDocuments={false}
        accentColor="#1C6B1C"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
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
  groupImageSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  groupImageContainer: {
    alignItems: 'center',
    gap: 12,
  },
  imageWithRemove: {
    position: 'relative',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#6b7280',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  imageUploadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadErrorText: {
    color: '#dc2626',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  searchResultsSection: {
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  noResultsText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  
  // Group info styles - now inside ScrollView
  groupInfo: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1C6B1C',
  },
  groupInfoText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  groupInfoUsersList: {
    maxHeight: 60,
  },
  groupInfoUsersContent: {
    paddingRight: 16,
  },
  groupInfoUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  groupInfoUserName: {
    fontSize: 12,
    color: '#1f2937',
    maxWidth: 100,
  },
  
  // Fixed message input container
  fixedMessageInputContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});