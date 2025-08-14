// components/messages/MessageToolbarNative.tsx
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Paperclip, Smile, ArrowDown, Settings } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';

interface MessageToolbarNativeProps {
  atBottom?: boolean;
  onScrollToBottom?: () => void;
  showScrollToBottom?: boolean;
  showFile?: boolean;
  showSettings?: boolean;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
}

export default function MessageToolbarNative({
  atBottom,
  onScrollToBottom,
  showScrollToBottom = true,
  showSettings = true,
  onShowUserPopover,
}: MessageToolbarNativeProps) {
  
  const handleSettingsPress = () => {
    const options = ['Search messages', 'Delete conversation', 'Cancel'];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            // Search messages
            console.log('Search messages pressed');
          } else if (buttonIndex === 1) {
            // Delete conversation
            Alert.alert(
              'Delete Conversation',
              'Are you sure you want to delete this conversation?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete confirmed') }
              ]
            );
          }
        }
      );
    } else {
      // Android - use Alert
      Alert.alert(
        'Conversation Settings',
        'Choose an action',
        [
          { text: 'Search messages', onPress: () => console.log('Search messages pressed') },
          { 
            text: 'Delete conversation', 
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete Conversation',
                'Are you sure you want to delete this conversation?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete confirmed') }
                ]
              );
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  return (
    <View style={styles.toolbar}>
      {/* Left side - Settings and Scroll to bottom */}
      <View style={styles.leftSection}>
        {showSettings && (
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleSettingsPress}
          >
            <Settings size={20} color="#1C6B1C" />
          </TouchableOpacity>
        )}
        
        {showScrollToBottom && !atBottom && onScrollToBottom && (
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={onScrollToBottom}
          >
            <ArrowDown size={20} color="#1C6B1C" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  // MessageToolbarNative styles
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 6,
  },
  
  // ParticipantsListNative styles
  container: {
    maxHeight: 200,
  },
  participantsList: {
    flexGrow: 0,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  participantStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});