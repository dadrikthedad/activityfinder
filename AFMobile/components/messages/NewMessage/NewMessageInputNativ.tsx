// components/messages/NewMessageInputNative.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { ArrowBigRight } from 'lucide-react-native';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { useGroupRequests } from '@/hooks/messages/useGroupRequests';
import { MessageDTO, AttachmentDto } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { SendGroupRequestsResponseDTO } from '@shared/types/SendGroupRequestsDTO';
import { useConversationUpdate } from '@/hooks/common/useConversationUpdate';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { RNFile, validateFiles } from '@/utils/files/FileFunctions';
import { showNotificationToastNative } from '../../toast/NotificationToastNative';
import { LocalToastType } from '../../toast/NotificationToastNative';

// Import attachment components - COMMENTED OUT FOR NOW
// import { AttachmentPreview } from '../files/AttachmentPreview';
// import { useAttachmentViewer } from '../files/AttachmentViewer';
// import { AttachmentPicker } from '../files/filepicker/AttachmentPicker';

interface NewMessageInputNativeProps {
  receiverId?: number;
  selectedUsers?: UserSummaryDTO[];
  groupName?: string;
  groupImageUrl?: string | null;
  shouldFocus?: boolean;
  onMessageSent?: (message: MessageDTO) => void;
  onGroupCreated?: (response: SendGroupRequestsResponseDTO) => void;
}

export default function NewMessageInputNative({
  receiverId,
  selectedUsers = [],
  groupName,
  shouldFocus = false,
  onMessageSent,
  onGroupCreated,
  groupImageUrl,
}: NewMessageInputNativeProps) {
  const [text, setText] = useState('');
  // const [selectedFiles, setSelectedFiles] = useState<RNFile[]>([]); // COMMENTED OUT - Attachments disabled for now
  const inputRef = useRef<TextInput>(null);

  // Hooks for both scenarios
  const { send, error: messageError } = useSendMessage(onMessageSent);
  const {
    sendGroupInvitations,
    isLoading: groupRequestLoading,
    error: groupRequestError,
    clearError: clearGroupError,
  } = useGroupRequests();
  const { refreshConversation } = useConversationUpdate();
  const { approveLocally } = useApproveMessageRequest();

  // Use AttachmentViewer hook for file opening - COMMENTED OUT
  // const { openFile } = useAttachmentViewer({
  //   files: selectedFiles,
  //   isMapped: false
  // });

  // Determine if we're in group mode
  const isGroupMode = selectedUsers.length > 1;
  const hasContent = text.trim().length > 0; // || selectedFiles.length > 0; // COMMENTED OUT - No file attachments for now
  const isDisabled = isGroupMode
    ? groupRequestLoading
    : (!hasContent || !receiverId);

  // Handle file selection from AttachmentPicker - COMMENTED OUT
  // const handleFilesSelected = (files: RNFile[]) => {
  //   setSelectedFiles(prev => [...prev, ...files]);
  // };

  // Remove file from selection - COMMENTED OUT
  // const removeFile = (index: number) => {
  //   setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  // };

  // Handle file preview press - COMMENTED OUT
  // const handleFilePreviewPress = (index: number) => {
  //   openFile(index);
  // };

  const handleSend = async () => {
    // For 1-til-1 samtaler: krev tekst eller filer
    if (!isGroupMode) {
      const trimmed = text.trim();
      const hasText = trimmed.length > 0;
      // const hasFiles = selectedFiles.length > 0; // COMMENTED OUT - No attachments for now
      
      if (!hasText) return; // && !hasFiles) return; // COMMENTED OUT - Only check text for now

      if (!receiverId) {
        console.error('❌ No receiverId provided for 1-to-1 message');
        return;
      }

      // Validate files if any - COMMENTED OUT
      // if (hasFiles) {
      //   const validation = validateFiles(selectedFiles);
      //   if (!validation.isValid) {
      //     Alert.alert('File Error', validation.error || 'Invalid files selected');
      //     return;
      //   }
      // }

      // Clear inputs immediately
      const sendingText = trimmed;
      // const sendingFiles = [...selectedFiles]; // COMMENTED OUT
      setText('');
      // setSelectedFiles([]); // COMMENTED OUT
      inputRef.current?.focus();

      const messageData = {
        text: sendingText,
        receiverId: receiverId.toString(),
      };
      // const messageData = hasFiles ? {
      //   text: sendingText || undefined,
      //   files: sendingFiles,
      //   receiverId: receiverId.toString(),
      // } : {
      //   text: sendingText,
      //   receiverId: receiverId.toString(),
      // }; // COMMENTED OUT - Complex file logic

      console.log('📤 Sender melding med payload:', messageData);

      send(messageData).then(async (result) => {
        if (!result) {
          // Restore inputs on failure
          setText(sendingText);
          // setSelectedFiles(sendingFiles); // COMMENTED OUT
          return;
        }

        if (result.isNowApproved) {
          approveLocally(result.conversationId);
        }

        if (!result.isRejectedRequest) {
          await refreshConversation(result.conversationId, {
            logPrefix: '📨',
          });
        }
        onMessageSent?.(result);
      }).catch(() => {
        // Restore inputs on error
        setText(sendingText);
        // setSelectedFiles(sendingFiles); // COMMENTED OUT
      });

      return;
    }

    // For gruppesamtaler: tekst og filer er optional
    try {
      const trimmed = text.trim();
      const invitedUserIds = selectedUsers.map((user) => user.id);

      // Validate files if any - COMMENTED OUT
      // if (selectedFiles.length > 0) {
      //   const validation = validateFiles(selectedFiles);
      //   if (!validation.isValid) {
      //     Alert.alert('File Error', validation.error || 'Invalid files selected');
      //     return;
      //   }
      // }

      const requestData = {
        groupName: groupName?.trim() || undefined,
        invitedUserIds,
        groupImageUrl: groupImageUrl || undefined,
        initialMessage: trimmed || undefined,
        // files: selectedFiles.length > 0 ? selectedFiles : undefined, // COMMENTED OUT
      };

      const response = await sendGroupInvitations(requestData);

      if (response) {
        console.log('✅ Group created successfully:', response);
        setText('');
        // setSelectedFiles([]); // COMMENTED OUT
        onGroupCreated?.(response);
        
        // Show success toast instead of Alert
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Group Created!",
          customBody: `Successfully created group "${groupName || 'Unnamed'}" with ${selectedUsers.length} member${selectedUsers.length > 1 ? 's' : ''}`,
          position: 'top'
        });
      }
    } catch (error) {
      console.error('❌ Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  useEffect(() => {
    if (shouldFocus) {
      inputRef.current?.focus();
    }
  }, [shouldFocus]);

  const currentError = messageError || groupRequestError;

  if (currentError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {currentError}</Text>
          {groupRequestError && (
            <TouchableOpacity onPress={clearGroupError} style={styles.errorCloseButton}>
              <Text style={styles.errorCloseText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const getPlaceholder = () => {
    if (isGroupMode) {
      return 'Write an initial message for the group (optional)...';
      // return selectedFiles.length > 0 
      //   ? 'Add an initial message for the group (optional)...'
      //   : 'Write an initial message for the group (optional)...'; // COMMENTED OUT - No file logic
    }
    return 'Write a message...';
    // return selectedFiles.length > 0 
    //   ? 'Add a message (optional)...'
    //   : 'Write a message...'; // COMMENTED OUT - No file logic
  };

  return (
    <View style={styles.container}>
      {/* File Previews - COMMENTED OUT FOR NOW */}
      {/* {selectedFiles.length > 0 && (
        <View style={styles.filePreviewContainer}>
          {selectedFiles.length === 1 ? (
            // Single file - centered, larger
            <View style={styles.singleFileContainer}>
              <AttachmentPreview
                file={selectedFiles[0]}
                index={0}
                totalCount={selectedFiles.length}
                size="medium"
                showRemoveButton={true}
                showGalleryIndicator={false}
                showFileNameFooter={true}
                onPress={() => handleFilePreviewPress(0)}
                onRemove={() => removeFile(0)}
                isBlurred={false}
                isUploading={false}
                uploadError={null}
                disabled={false}
                borderColor="white"
              />
            </View>
          ) : (
            // Multiple files - horizontal scroll
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filePreviewScrollContent}
              style={styles.filePreviewScroll}
            >
              {selectedFiles.map((file, index) => (
                <AttachmentPreview
                  key={`${file.uri}-${index}`}
                  file={file}
                  index={index}
                  totalCount={selectedFiles.length}
                  size="small"
                  showRemoveButton={true}
                  showGalleryIndicator={true}
                  showFileNameFooter={true}
                  onPress={() => handleFilePreviewPress(index)}
                  onRemove={() => removeFile(index)}
                  isBlurred={false}
                  isUploading={false}
                  uploadError={null}
                  disabled={false}
                  borderColor="white"
                />
              ))}
            </ScrollView>
          )}
        </View>
      )} */}

      {/* Message input area */}
      <View style={styles.inputContainer}>
        {/* Attachment Picker - COMMENTED OUT FOR NOW */}
        {/* <AttachmentPicker
          onFilesSelected={handleFilesSelected}
          disabled={groupRequestLoading}
          allowMultipleImages={true}
          allowVideos={true}
          allowDocuments={true}
          imageQuality={0.7}
          cameraQuality={0.7}
          modalTitle="Choose Attachment"
          accentColor="#1C6B1C"
          buttonBackgroundColor="#1C6B1C"
          buttonColor="#ffffff"
          buttonSize={24}
        /> */}

        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            groupRequestLoading && styles.textInputDisabled
          ]}
          value={text}
          onChangeText={handleTextChange}
          placeholder={getPlaceholder()}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          editable={!groupRequestLoading}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          textAlignVertical="top"
        />
        
        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (isDisabled || groupRequestLoading) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={isDisabled || groupRequestLoading}
        >
          <ArrowBigRight size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  
  // File preview styles - same as MessageInputNative
  filePreviewContainer: {
    marginBottom: 12,
  },
  singleFileContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  filePreviewScroll: {
    marginHorizontal: -4,
    overflow: 'visible',
    borderRadius: 8,
  },
  filePreviewScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },

  // Input container - same as MessageInputNative
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  textInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  
  // Send button - same as MessageInputNative
  sendButton: {
    backgroundColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  // Error styles - same as MessageInputNative
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  errorCloseButton: {
    marginLeft: 8,
    padding: 4,
  },
  errorCloseText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
});