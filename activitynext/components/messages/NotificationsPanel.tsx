import { useMessageNotificationActions } from "@/hooks/messages/useMessageNotificationActions";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import ProfileNavButton from "../settings/ProfileNavButton";
import Router from "next/router";

function formatNotificationText(n: MessageNotificationDTO): string {
  switch (n.type) {
    case "NewMessage":
    case 1:
      return n.messageCount && n.messageCount > 1
        ? `has sent you ${n.messageCount} messages`
        : n.messagePreview ? `said: ${n.messagePreview}` : "sent you a message";
    case "MessageRequest":
    case 2:
      return "requested to message you";
    case "MessageRequestApproved":
    case 3:
      return n.messagePreview ?? "approved your message request";
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
      return n.messagePreview ?? "";
  }
}

interface NotificationsPanelProps {
  onOpenConversation: (conversationId: number) => void;
}

export default function NotificationsPanel({ onOpenConversation }: NotificationsPanelProps) {
  const notifications = useMessageNotificationStore((s) => s.notifications);
  const { markOneAsRead, markAllAsRead, loading: markAllLoading } = useMessageNotificationActions();
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const hasLoaded = useMessageNotificationStore((s) => s.hasLoadedNotifications);

  const totalNotifications = useMessageNotificationStore((s) => s.notifications.length);

  const canGoToChat = totalNotifications >= 20; 

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 pt-10 gap-4 text-sm scrollbar-none">

      {notifications.length > 0 && (
    <div className="w-full text-center">
       <ProfileNavButton
        onClick={() => markAllAsRead()}
        text={markAllLoading ? "Marking..." : "Mark all as read"}
        variant="small"
        disabled={markAllLoading}
      />
    </div>
    )}

      {!hasLoaded ? (
          <p className="text-gray-500 text-xs">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500 text-xs">No recent notifications</p>
        ) : (
      <ul className="space-y-2 overflow-auto w-full flex-1 min-h-0 pb-4 px-32">
          {notifications.map((n) => (
            <li
                key={n.id}
                className={`px-4 py-2 rounded shadow-sm text-center cursor-pointer transition 
                    ${n.isRead
                    ? "bg-gray-100 dark:bg-[#2e2e2e] text-gray-400"
                    : "bg-white dark:bg-[#1e1e1e] font-semibold border border-[#1C6B1C] "}`}
                onClick={() => {
              if (!n.isRead) {
                markOneAsRead(n.id);
                if (n.conversationId) {
                  setScrollToMessageId(n.messageId ?? null);
                  onOpenConversation(n.conversationId);
                }
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
                {new Date(n.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
              </div>
            </li>
          ))}
            <li className="w-full text-center pt-2">
              <ProfileNavButton
                onClick={() => {
                  if (canGoToChat) Router.push("/page/chat");
                }}
                text="See more..."
                variant="small"
                disabled={!canGoToChat}
              />
            </li>
              <li className="py-1" /> {/* Litt ekstra luft under knappen */}
        </ul>
        
      )}
     
    </div>
  );
}
