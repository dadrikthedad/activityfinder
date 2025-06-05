"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { NotificationType} from "@/types/MessageNotificationDTO";
import ProfileNavButton from "../settings/ProfileNavButton";

interface NotificationToastProps {
  senderName?: string | null;
  messagePreview?: string | null;
  conversationId: number;
  type?: NotificationType;
  reactionEmoji?: string | null;
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
}: NotificationToastProps & { t: { id: string | number } }) {
  const router = useRouter();
    const getTitle = () => {
      const name = (
        <span className="font-semibold text-black dark:text-white">
          {senderName ?? "ukjent"}
        </span>
      );

      switch (type) {
        case NotificationType.MessageRequest:
          return (
            <>
              {name} sent you a message request
            </>
          );
        case NotificationType.MessageRequestApproved:
          return (
            <>
              {name} approved your message request
            </>
          );
        case NotificationType.MessageReaction:
          return (
            <>
              {name} reacted with {reactionEmoji ?? "👍"} on your message:
            </>
          );
        case NotificationType.NewMessage:
        default:
          return (
            <>
              {name} says:
            </>
          );
      }
    };


  return (
    <div className="bg-white dark:bg-[#1e2122] border-1 border-[#1C6B1C] shadow-lg rounded-xl p-4 max-w-sm w-full text-center">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {getTitle()}
      </p>

      {messagePreview && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {messagePreview}
        </p>
      )}
      <div className="flex justify-center gap-2 mt-3 text-center">
        <ProfileNavButton
          text="Open"
          variant="mini"
          onClick={() => {
            router.push(`/chat/${conversationId}`);
            toast.dismiss(t.id);
          }}
          className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
        />
        <ProfileNavButton
          text="Close"
          variant="mini"
          onClick={() => {
            router.push(`/chat/${conversationId}`);
            toast.dismiss(t.id);
          }}
          className="bg-gray-500 hover:bg-gray-600 text-white"
        />
        </div>
    </div>
  );
}
