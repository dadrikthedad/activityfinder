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
  MsgRequestAcceptedLocally = "MsgRequestAcceptedLocally"
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
}

export function showNotificationToastNative(props: NotificationToastProps) {
  Toast.show({
    type: 'customNotification',
    props: props,
    position: 'top',
    visibilityTime: 5000,
    autoHide: true,
    topOffset: 60,
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
    attachments
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
      default:
        return `${senderDisplayName} sent you a notification`;
    }
  };

  const getBody = (): string => {
    let mainMessage = "";
    let attachmentInfo = "";

    switch (type) {
      case NotificationType.MessageReaction:
      case LocalToastType.MessageReactionChanged:
        mainMessage = messagePreview ? `"${messagePreview}"` : "";
        break;
      case NotificationType.NewMessage:
        mainMessage = messagePreview ?? "";
        break;
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

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handleNotificationClick}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        {/* Header with images */}
        <View style={styles.header}>
          <MiniAvatarNative
            imageUrl={senderDisplayImage}
            alt={senderDisplayName}
            size={40}
            withBorder={true}
          />

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={2}>
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
          <Text style={styles.body} numberOfLines={3}>
            {getBody()}
          </Text>
        )}

        {/* Action buttons */}
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
    elevation: 5,
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