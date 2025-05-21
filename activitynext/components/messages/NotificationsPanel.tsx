import { useMessageNotifications } from "@/hooks/messages/useMessageNotifications";
import { useMessageMarkNotificationAsRead } from "@/hooks/messages/useMarkMessageNotificationAsRead";
import { useMarkAllMessageNotificationsAsRead } from "@/hooks/messages/useMarkAllMessageNotificationsAsRead";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";

function formatNotificationText(n: MessageNotificationDTO): string {
  switch (n.type) {
    case "NewMessage":
    case 0:
      return "sent you a message";
    case "MessageRequest":
    case 1:
      return "requested to message you";
    case "MessageRequestApproved":
    case 2:
      return "approved your message request";
    case "MessageReaction":
    case 4:
      if (n.reactionEmoji) {
        const preview = n.messagePreview
          ? ` on "${n.messagePreview}"`
          : "";
        return `reacted with ${n.reactionEmoji}${preview}`;
      }
      return "reacted to your message";
    default:
      return "";
  }
}

interface NotificationsPanelProps {
  onOpenConversation: (conversationId: number) => void;
}

export default function NotificationsPanel({ onOpenConversation }: NotificationsPanelProps) {
  const {
    loading: notifLoading,
    error: notifError,
    loadMore,
    hasMore
  } = useMessageNotifications();

  const notifications = useChatStore((s) => s.messageNotifications);
  const { markAsRead } = useMessageMarkNotificationAsRead();
  const { markAllAsRead, loading: markAllLoading } = useMarkAllMessageNotificationsAsRead();
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);

  return (
    <div className="flex-1 flex flex-col items-center justify-start text-sm text-center px-4 pt-10 gap-4 custom-scrollbar">
      <p className="text-gray-400">Recent notifications</p>
      {notifications.length > 0 && (
    <div className="w-full text-center">
        <button
        disabled={markAllLoading}
        onClick={() =>
            markAllAsRead(() => {
            // Oppdater lokal state direkte (uten reload)
            notifications.forEach((n) => {
                n.isRead = true;
            });
            })
        }
        className="text-xs text-blue-600 hover:underline disabled:opacity-50 mb-2"
        >
        {markAllLoading ? "Marking..." : "Mark all as read"}
        </button>
    </div>
    )}

      {notifLoading ? (
        <p className="text-gray-500 text-xs">Loading notifications...</p>
      ) : notifError ? (
        <p className="text-red-500 text-xs">Error loading notifications</p>
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 text-xs">No recent notifications</p>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-auto w-full max-w-md">
          {notifications.map((n) => (
            <li
                key={n.id}
                className={`px-4 py-2 rounded shadow-sm text-center cursor-pointer transition 
                    ${n.isRead
                    ? "bg-gray-100 dark:bg-[#2e2e2e] text-gray-400"
                    : "bg-white dark:bg-[#1e1e1e] font-semibold border border-[#1C6B1C] "}`}
                onClick={() => {
              if (!n.isRead) {
                markAsRead(n.id, () => {
                  if (n.conversationId) {
                    setScrollToMessageId(n.messageId ?? null);
                    onOpenConversation(n.conversationId);
                  }
                });
              } else {
                if (n.conversationId) {
                  setScrollToMessageId(n.messageId ?? null);
                  onOpenConversation(n.conversationId);
                }
              }
            }}

                >
            {!n.isRead && <span className="inline-block w-2 h-2 bg-green-600 rounded-full mr-2" />}
              <strong>{n.senderName}</strong> {formatNotificationText(n)}

              <div className="text-xs text-gray-500 mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button
            onClick={loadMore}
            disabled={notifLoading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50 mt-2"
        >
            {notifLoading ? "Loading..." : "Load more"}
        </button>
        )}
    </div>
  );
}
