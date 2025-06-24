"use client";

import { toast } from "sonner";
import { useChatStore } from "@/store/useChatStore";
import { NotificationType } from "@/types/MessageNotificationDTO";
import ProfileNavButton from "../settings/ProfileNavButton";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/useNotificationStore";
import MiniAvatar from "../common/MiniAvatar";// 🆕 Importer MiniAvatar

export enum LocalToastType {
  MessageReactionChanged = "MessageReactionChanged",
  FriendRequestReceived = "FriendRequestReceived",
  CustomSystemNotice = "CustomSystemNotice",
  FriendInvAccepted = "FriendRequestAccepted",
  MsgRequestAcceptedLocally ="MsgRequestAcceptedLocally"
}

export type ToastType = NotificationType | LocalToastType;

interface NotificationToastProps {
  messagePreview?: string | null;
  conversationId?: number;
  type?: ToastType;
  reactionEmoji?: string | null;
  messageId?: number | null;
  relatedUser?: UserSummaryDTO | null; // Primær kilde for sender info
  groupName?: string | null;
  groupImage?: string | null;
  // 🆕 Kun fallback felter hvis relatedUser ikke finnes
  senderName?: string | null; // Fallback
  senderProfileImage?: string | null; // Fallback
}

export function showNotificationToast({
  senderName,
  messagePreview,
  conversationId,
  type,
  reactionEmoji,
  messageId,
  relatedUser,
  groupName,
  senderProfileImage, // 🆕
  groupImage, // 🆕
}: NotificationToastProps) {
  toast.custom((tId) => (
    <NotificationToast
      t={{ id: tId }}
      senderName={senderName}
      messagePreview={messagePreview}
      conversationId={conversationId}
      type={type}
      reactionEmoji={reactionEmoji}
      messageId={messageId}
      relatedUser={relatedUser}
      groupName={groupName}
      senderProfileImage={senderProfileImage} // 🆕
      groupImage={groupImage} // 🆕
    />
  ), { duration: Infinity });
}

function NotificationToast({
  t,
  senderName,
  messagePreview,
  conversationId,
  type,
  reactionEmoji,
  messageId,
  relatedUser,
  groupName,
  senderProfileImage, // 🆕
  groupImage, // 🆕
}: NotificationToastProps & { t: { id: string | number } }) {
  const router = useRouter();
  const setShowMessages = useChatStore((s) => s.setShowMessages);
  const showMessages = useChatStore((s) => s.showMessages);
  const openConversation = useChatStore((s) => s.openConversation);
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const setShowNotificationDropdown = useNotificationStore((s) => s.setShowNotificationDropdown);

  const handleNotificationClick = () => {
    switch (type) {
      case NotificationType.MessageRequestApproved:
      case NotificationType.NewMessage:
      case NotificationType.MessageReaction:
      case NotificationType.MessageRequest:
      case NotificationType.GroupRequest:
      case NotificationType.GroupRequestApproved:
      case NotificationType.GroupRequestInvited:
        if (conversationId != null) {
          if (!showMessages) setShowMessages(true);
          openConversation(conversationId);
          setTimeout(() => setScrollToMessageId(messageId ?? null), 200);
        }
        break;
      case LocalToastType.FriendRequestReceived:
        setShowNotificationDropdown(true);
        break;
      case LocalToastType.FriendInvAccepted:
        if (relatedUser?.id) {
          router.push(`/profile/${relatedUser.id}`);
        }
        break;
    }

    toast.dismiss(t.id);
  };

  // 🆕 Bruk nullish coalescing og eksplisitt typing for å unngå TypeScript feil
  const senderDisplayName = relatedUser?.fullName ?? senderName ?? "ukjent";
  const senderDisplayImage = relatedUser?.profileImageUrl ?? senderProfileImage ?? "/default-avatar.png";

  const name = (
    <span className="font-semibold text-black dark:text-white">
      {senderDisplayName}
    </span>
  );

  const getTitle = () => {
    // Style group name samme som sender name
    const styledGroupName = (
      <span className="font-semibold text-black dark:text-white">
        {groupName ?? "a group"}
      </span>
    );

    switch (type) {
      case NotificationType.MessageRequest:
        return <>{name} sent you a message request</>;
      case NotificationType.MessageRequestApproved:
        return <>{name} approved your message request</>;
      case NotificationType.MessageReaction:
        return <>{name} reacted with {reactionEmoji ?? "👍"} on your message</>;
      case NotificationType.GroupRequest:
        return <>{name} invited you to join {styledGroupName}</>;
      case NotificationType.GroupRequestApproved:
        return <>{name} has accepted to join {styledGroupName}</>;
      case NotificationType.GroupRequestInvited:
        return <>{name} has invited user1 and 4 more to to join {styledGroupName}</>;
      case LocalToastType.MessageReactionChanged:
        return <>{name} changed their reaction to {reactionEmoji ?? "👍"} on message:</>;
      case LocalToastType.FriendInvAccepted:
        return <>{name} accepted your friend request</>;
      case LocalToastType.FriendRequestReceived:
        return <>{name} sent you a friend request</>;
      case LocalToastType.MsgRequestAcceptedLocally:
        return <>Message request from {name} is approved</>
      case NotificationType.NewMessage:
        return <>{name} says:</>;
      
      default:
        return;  
    }
  };

  const getBody = () => {
    switch (type) {
      case NotificationType.MessageReaction:
      case LocalToastType.MessageReactionChanged:
        return messagePreview ? `"${messagePreview}"` : null;
      case NotificationType.NewMessage:
        return messagePreview ?? null;
      default:
        return null;
    }
  };

  // 🆕 Vis gruppe-relaterte bilder for GroupRequest
  const showGroupImages = type === NotificationType.GroupRequest || type === NotificationType.GroupRequestApproved;

  return (
    <div className="bg-white dark:bg-[#1e2122] border-1 border-[#1C6B1C] shadow-lg rounded-xl p-4 max-w-sm w-full">
      {/* 🆕 Header med bilder */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avsender profilbilde */}
        <MiniAvatar
          imageUrl={senderDisplayImage}
          alt={senderDisplayName}
          size={40}
          withBorder={true}
        />

        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-left">{getTitle()}</p>
        </div>

        {/* Gruppe bilde (kun for GroupRequest) */}
        {showGroupImages && (
          <>
            <MiniAvatar
              imageUrl={groupImage || "/default-group.png"}
              alt={groupName || "Group"}
              size={40}
              withBorder={true}
            />
          </>
        )}
      </div>

      {/* Message body */}
      {getBody() && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-left">
          {getBody()}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex justify-center gap-2">
        <ProfileNavButton
          text="Open"
          variant="mini"
          onClick={(e) => {
            e.stopPropagation();
            handleNotificationClick();
          }}
          className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
        />
        <ProfileNavButton
          text="Close"
          variant="mini"
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t.id);
          }}
          className="bg-gray-500 hover:bg-gray-600 text-white"
        />
      </div>
      
    </div>
  );
}