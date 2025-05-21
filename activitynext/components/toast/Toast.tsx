"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { NotificationType} from "@/types/MessageNotificationDTO";

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
  ));
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
    switch (type) {
        case NotificationType.MessageRequest:
        return `📩 Forespørsel fra ${senderName ?? "ukjent"}`;
        case NotificationType.MessageRequestApproved:
        return `✅ Forespørsel godkjent`;
        case NotificationType.MessageReaction:
        return `${reactionEmoji ?? "👍"} Reaksjon fra ${senderName ?? "ukjent"}`;
        case NotificationType.NewMessage:
        default:
        return `📝 Ny melding fra ${senderName ?? "ukjent"}`;
    }
    };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-4 max-w-sm w-full">
      <p className="font-semibold text-sm">{getTitle()}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
        {messagePreview ?? "Du har fått en melding"}
      </p>
      <button
        onClick={() => {
          router.push(`/chat/${conversationId}`);
          toast.dismiss(t.id);
        }}
        className="mt-2 text-blue-500 hover:underline text-sm"
      >
        Åpne samtale
      </button>
    </div>
  );
}
