"use client";

import { toast } from "sonner";
import { useChatStore } from "@/store/useChatStore";
import { NotificationType} from "@/types/MessageNotificationDTO";
import ProfileNavButton from "../settings/ProfileNavButton";

export enum LocalToastType {
  MessageReactionChanged = "MessageReactionChanged",
  FriendRequestReceived = "FriendRequestReceived",
  CustomSystemNotice = "CustomSystemNotice",
}


type ToastType = NotificationType | LocalToastType;

interface NotificationToastProps {
  senderName?: string | null;
  messagePreview?: string | null;
  conversationId: number;
  type?: ToastType;
  reactionEmoji?: string | null;
  messageId?: number | null;
}

export function showNotificationToast({
  senderName,
  messagePreview,
  conversationId,
  type,
  reactionEmoji,
}: NotificationToastProps) {
  toast.custom((tId) => (
    <NotificationToast
      t={{ id: tId }}
      senderName={senderName}
      messagePreview={messagePreview}
      conversationId={conversationId}
      type={type}
      reactionEmoji={reactionEmoji}
    />
  ),
  {
    duration: Infinity, // viktig!
  });
}

function NotificationToast({
  t,
  senderName,
  messagePreview,
  conversationId,
  type,
  reactionEmoji,
  messageId
}: NotificationToastProps & { t: { id: string | number } }) {
  const openConversation = useChatStore((state) => state.openConversation);
  const setScrollToMessageId = useChatStore((state) => state.setScrollToMessageId);
  const setShowMessages = useChatStore((s) => s.setShowMessages);
  const showMessages = useChatStore((s) => s.showMessages);
    const name = (
    <span className="font-semibold text-black dark:text-white">
      {senderName ?? "ukjent"}
    </span>
  );

  const getTitle = () => {
    switch (type) {
      case NotificationType.MessageRequest:
        return <>{name} sent you a message request</>;
      case NotificationType.MessageRequestApproved:
        return <>{name} approved your message request</>;
      case NotificationType.MessageReaction:
        return <>{name} reacted with {reactionEmoji ?? "👍"} on your message</>;
      case LocalToastType.MessageReactionChanged:
        return <>{name} changed their reaction to {reactionEmoji ?? "👍"} on message:</>;
      case NotificationType.NewMessage:
      default:
        return <>{name} says:</>;
    }
  };

  const getBody = () => {
    switch (type) {
      case NotificationType.MessageReaction:
      case LocalToastType.MessageReactionChanged:
        return messagePreview ? `"${messagePreview}"` : null;
      case NotificationType.NewMessage:
      case NotificationType.MessageRequest:
        return messagePreview ?? null;
      case NotificationType.MessageRequestApproved:
      default:
        return null; // ingen ekstra tekst
    }
  };


  return (
    <div className="bg-white dark:bg-[#1e2122] border-1 border-[#1C6B1C] shadow-lg rounded-xl p-4 max-w-sm w-full text-center">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {getTitle()}
      </p>

        {getBody() && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {getBody()}
          </p>
        )}
      <div className="flex justify-center gap-2 mt-3 text-center">
        <ProfileNavButton
          text="Open"
          variant="mini"
          onClick={(e) => {
            e.stopPropagation();
            if (!showMessages) {
                setShowMessages(true);
            }
            openConversation(conversationId);
              setTimeout(() => {
                setScrollToMessageId(messageId ?? null);
              }, 200);
            toast.dismiss(t.id);
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
