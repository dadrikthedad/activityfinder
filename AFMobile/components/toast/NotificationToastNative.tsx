// NotificationToast.native.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useChatStore } from "@/store/useChatStore";
import { NotificationType } from "@shared/types/MessageNotificationDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useNotificationStore } from "@/store/useNotificationStore";
import MiniAvatarNative from "../common/MiniAvatarNative";
import { GroupEventType } from "@shared/types/GroupNotificationUpdateDTO";
import { formatUserListNative } from "../../utils/messages/NotificationsUserListFormatterNative";
import { AttachmentDto } from "@shared/types/MessageDTO";
import { getAttachmentSummary } from "./ToastFunctions";
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

export enum LocalToastType {
  MessageReactionChanged = "MessageReactionChanged",
  FriendRequestReceived = "FriendRequestReceived",
  CustomSystemNotice = "CustomSystemNotice",
  FriendInvAccepted = "FriendRequestAccepted",
  MsgRequestAcceptedLocally = "MsgRequestAcceptedLocally",
  FileDownloaded = "FileDownloaded",
}

export type ToastType = NotificationType | LocalToastType;

interface NotificationToastProps {
  messagePreview?: string | null;
  conversationId?: number;
  type?: ToastType;
  reactionEmoji?: string | null;
  messageId?: number | null;
  relatedUser?: UserSummaryDTO | null;
  groupName?: string | null;
  groupImage?: string | null;
  senderName?: string | null;
  senderProfileImage?: string | null;
  groupEventType?: GroupEventType | string;
  affectedUserNames?: string[];
  affectedUsers?: UserSummaryDTO[];
  attachments?: AttachmentDto[];
  position?: 'top' | 'bottom';
  offset?: number; // For lokalisjonen
  // Nye props for CustomSystemNotice
  customTitle?: string;
  customBody?: string;
}

export function showNotificationToastNative(props: NotificationToastProps) {
  const { position = 'top', offset = 60, ...toastProps } = props;
  Toast.show({
    type: 'customNotification',
    props: toastProps,
    position: position,
    visibilityTime: 5000,
    autoHide: true,
    topOffset: position === 'top' ? offset : undefined,
    bottomOffset: position === 'bottom' ? offset : undefined,
  });
}

// Custom toast component
function NotificationToastComponent({ 
  props, 
  hide 
}: { 
  props: NotificationToastProps; 
  hide: () => void; 
}) {
  const navigation = useNavigation();
  const setShowMessages = useChatStore((s) => s.setShowMessages);
  const showMessages = useChatStore((s) => s.showMessages);
  const openConversation = useChatStore((s) => s.openConversation);
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const setShowNotificationDropdown = useNotificationStore((s) => s.setShowNotificationDropdown);

  const {
    senderName,
    messagePreview,
    conversationId,
    type,
    reactionEmoji,
    messageId,
    relatedUser,
    groupName,
    senderProfileImage,
    groupImage,
    groupEventType,
    affectedUserNames,
    affectedUsers,
    attachments,
    customTitle,
    customBody
  } = props;

  const handleNotificationClick = () => {
    switch (type) {
      case NotificationType.MessageRequestApproved:
      case NotificationType.NewMessage:
      case NotificationType.MessageReaction:
      case NotificationType.MessageRequest:
      case NotificationType.GroupRequest:
      case NotificationType.GroupEvent:
        if (conversationId != null) {
          if (!showMessages) setShowMessages(true);
          openConversation(conversationId);
          setTimeout(() => setScrollToMessageId(messageId ?? null), 200);
          // Navigate to chat screen
          (navigation as any).navigate('Chat', { conversationId });
        }
        break;
      case NotificationType.GroupDisbanded:
        if (!showMessages) setShowMessages(true);
        (navigation as any).navigate('Chat');
        break;
      case LocalToastType.FriendRequestReceived:
        setShowNotificationDropdown(true);
        (navigation as any).navigate('Notifications');
        break;
      case LocalToastType.FriendInvAccepted:
        if (relatedUser?.id) {
          (navigation as any).navigate('Profile', { userId: relatedUser.id });
        }
        break;
    }

    hide();
  };

  const senderDisplayName = relatedUser?.fullName ?? senderName ?? "ukjent";
  const senderDisplayImage = relatedUser?.profileImageUrl ?? senderProfileImage ?? "/default-avatar.png";

  const getTitle = (): string => {
    const groupNameText = groupName ?? "a group";

    // Handle CustomSystemNotice
    if (type === LocalToastType.CustomSystemNotice) {
      return customTitle || messagePreview || "System Notice";
    }

    if (type === NotificationType.GroupEvent && groupEventType) {
      switch (groupEventType) {
        case GroupEventType.MemberInvited:
          return `${senderDisplayName} invited ${formatUserListNative(affectedUsers)} to ${groupNameText}`;
        case GroupEventType.MemberAccepted:
          if (affectedUserNames && affectedUserNames.length > 0) {
            return `${formatUserListNative(affectedUsers)} joined ${groupNameText}`;
          }
          return `${senderDisplayName} joined ${groupNameText}`;
        case GroupEventType.MemberLeft:
          if (affectedUserNames && affectedUserNames.length > 0) {
            return `${formatUserListNative(affectedUsers)} left ${groupNameText}`;
          }
          return `${senderDisplayName} left ${groupNameText}`;
        case GroupEventType.MemberRemoved:
          return `${senderDisplayName} removed ${formatUserListNative(affectedUsers)} from ${groupNameText}`;
        case GroupEventType.GroupNameChanged:
          return `${senderDisplayName} changed the name of ${groupNameText}`;
        case GroupEventType.GroupImageChanged:
          return `${senderDisplayName} changed the image of ${groupNameText}`;
        case GroupEventType.GroupCreated:
          return `${senderDisplayName} created ${groupNameText}`;
        default:
          return `${senderDisplayName} performed an action in ${groupNameText}`;
      }
    }

    switch (type) {
      case NotificationType.MessageRequest:
        return `${senderDisplayName} sent you a message request`;
      case NotificationType.MessageRequestApproved:
        return `${senderDisplayName} approved your message request`;
      case NotificationType.MessageReaction:
        return `${senderDisplayName} reacted with ${reactionEmoji ?? "👍"} on your message`;
      case NotificationType.GroupRequest:
        return `${senderDisplayName} invited you to join ${groupNameText}`;
      case LocalToastType.MessageReactionChanged:
        return `${senderDisplayName} changed their reaction to ${reactionEmoji ?? "👍"} on message:`;
      case NotificationType.GroupDisbanded:
        return `${groupNameText} has been disbanded`;
      case LocalToastType.FriendInvAccepted:
        return `${senderDisplayName} accepted your friend request`;
      case LocalToastType.FriendRequestReceived:
        return `${senderDisplayName} sent you a friend request`;
      case LocalToastType.MsgRequestAcceptedLocally:
        return `Message request from ${senderDisplayName} is approved`;
      case NotificationType.NewMessage:
        if ((!messagePreview || messagePreview.trim() === "") && attachments && attachments.length > 0) {
          return groupName ? 
            `${senderDisplayName} sent in ${groupName}:` : 
            `${senderDisplayName} sent:`;
        }
        return groupName ? 
          `${senderDisplayName} says in ${groupName}:` : 
          `${senderDisplayName} says:`;
      case LocalToastType.FileDownloaded:
        return messagePreview || "";
      default:
        return `${senderDisplayName} sent you a notification`;
    }
  };

  const getBody = (): string => {
    let mainMessage = "";
    let attachmentInfo = "";

    // Handle CustomSystemNotice
    if (type === LocalToastType.CustomSystemNotice) {
      return customBody || "";
    }

    switch (type) {
      case NotificationType.MessageReaction:
      case LocalToastType.MessageReactionChanged:
        mainMessage = messagePreview ? `"${messagePreview}"` : "";
        break;
      case NotificationType.NewMessage:
        mainMessage = messagePreview ?? "";
        break;
      case LocalToastType.FileDownloaded:
        return 'Download complete';
      default:
        return "";
    }

    if (attachments && attachments.length > 0) {
      attachmentInfo = getAttachmentSummary(attachments);
    }

    if (mainMessage && attachmentInfo) {
      return `${mainMessage}\n${attachmentInfo}`;
    } else if (attachmentInfo && !mainMessage) {
      return attachmentInfo;
    } else if (mainMessage) {
      return mainMessage;
    }

    return "";
  };

  const showGroupImages = type === NotificationType.GroupRequest || 
                         type === NotificationType.GroupRequestApproved || 
                         type === NotificationType.GroupEvent ||
                         type === NotificationType.GroupDisbanded;

  const shouldShowButtons = (): boolean => {
    switch (type) {
      case LocalToastType.FileDownloaded:
      case LocalToastType.CustomSystemNotice:
        return false; // Ingen knapper for disse typene
      default:
        return true;  // Vis knapper for alle andre
    }
  };

  const shouldShowAvatar = (): boolean => {
    switch (type) {
      case LocalToastType.FileDownloaded:
      case LocalToastType.CustomSystemNotice:
        return false; // Ingen avatar for disse typene
      default:
        return true;  // Vis avatar for alle andre
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={shouldShowButtons() ? handleNotificationClick : undefined}
      activeOpacity={shouldShowButtons() ? 0.9 : 1}
    >
      <View style={styles.content}>
        {/* Header with images */}
        <View style={styles.header}>
          {shouldShowAvatar() && (
            <MiniAvatarNative
              imageUrl={senderDisplayImage}
              alt={senderDisplayName}
              size={40}
              withBorder={true}
            />
          )}

          <View style={[
            styles.textContainer,
            !shouldShowAvatar() && styles.textContainerCentered
          ]}>
            <Text style={[
              styles.title,
              !shouldShowAvatar() && styles.titleCentered
            ]} numberOfLines={2}>
              {getTitle()}
            </Text>
          </View>

          {showGroupImages && (
            <MiniAvatarNative
              imageUrl={groupImage || "/default-group.png"}
              alt={groupName || "Group"}
              size={40}
              withBorder={true}
            />
          )}
        </View>

        {/* Message body */}
        {getBody() && (
          <Text style={[
            styles.body,
            !shouldShowAvatar() && styles.bodyCentered
          ]} numberOfLines={3}>
            {getBody()}
          </Text>
        )}

        {/* Action buttons */}
        {shouldShowButtons() && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.openButton]}
              onPress={handleNotificationClick}
            >
              <Text style={styles.buttonText}>Open</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.closeButton]}
              onPress={hide}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Register the custom toast type
const toastConfig = {
  customNotification: ({ props, hide }: { props: NotificationToastProps; hide: () => void }) => (
    <NotificationToastComponent props={props} hide={hide} />
  ),
};

// Export the toast config to be used in your App.tsx
export { toastConfig };

const styles = StyleSheet.create({
  container: {
    width: screenWidth - 32,
    marginHorizontal: 16,
    zIndex: 999999,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 999999,
    zIndex: 999999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
  },
  body: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 17,
  },
  textContainerCentered: {
    alignItems: 'center',  
    justifyContent: 'center',
  },
  titleCentered: {
    textAlign: 'center',
  },
  bodyCentered: {
    textAlign: 'center', 
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#1C6B1C',
  },
  closeButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});