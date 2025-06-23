import { useMessageNotificationActions } from "@/hooks/messages/useMessageNotificationActions";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import ProfileNavButton from "../settings/ProfileNavButton";
import Router from "next/router";
import { useState } from 'react';
import GroupMembersTooltip from "./GroupMembersTooltip";


function formatNotificationText(n: MessageNotificationDTO): string {
  // Hvis samtalen er avslått, vis spesifikk tekst
  if (n.isConversationRejected) {
    switch (n.type) {
      case "MessageRequest":
      case 2:
        return "message request (declined)";
      case "NewMessage":
      case 1:
        return "sent message (conversation declined)";
      default:
        return "notification (conversation declined)";
    }
  }

    switch (n.type) {
    case "NewMessage":
    case 1:
      // 🆕 Bruk messagePreview direkte - backend håndterer alt
      return n.messagePreview ?? "sent you a message";
      
    case "MessageRequest":
    case 2:
      return "requested to message you";
      
    case "MessageRequestApproved":
    case 3:
      return n.messagePreview ?? "approved your message request";
      
    case "GroupRequest":
    case 5:
      return n.messagePreview ?? "invited you to join a group";
      
    case "GroupRequestApproved":
    case 6:
      return n.messagePreview ?? "joined your group";
      
    case "MessageReaction":
    case 4:
      if (n.reactionEmoji) {
        const preview = n.messagePreview ? ` on "${n.messagePreview}"` : "";
        return `reacted with ${n.reactionEmoji}${preview}`;
      }
      return "reacted to your message";
      
    default:
      return n.messagePreview ?? "You have a notification";
  }
}

function shouldShowSenderName(n: MessageNotificationDTO): boolean {
  if (n.type === "NewMessage" || n.type === 1) {
    // For grupper: kun vis sender-navn hvis det er 1 melding
    if (n.groupName) {
      return (n.messageCount ?? 1) === 1;
    }
    // For private: alltid vis sender-navn
    return true;
  }
  // For andre typer: alltid vis sender-navn
  return true;
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

  const handleNotificationClick = (n: MessageNotificationDTO) => {
    // Hvis samtalen er avslått, ikke gjør noe
    if (n.isConversationRejected) {
      return;
    }

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
  };
  
    // Tooltip
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Handler for å vise tooltip
  const handleMouseEnter = (notificationId: number, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.right + 10, // Til høyre for notifikasjonen
      y: rect.top
    });
    setActiveTooltip(notificationId);
  };

  const handleMouseLeave = () => {
    setActiveTooltip(null);
  };
  
  const shouldShowTooltip = (n: MessageNotificationDTO): boolean => {
    return n.type === "GroupRequestApproved" || n.type === 6;
  };



  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 pt-10 gap-4 text-sm custom-scrollbar">

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
      <ul className="space-y-2 overflow-auto w-full flex-1 min-h-0 pb-4 px-32
      ">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-2 rounded shadow-sm text-center transition 
                ${n.isConversationRejected 
                  ? "bg-gray-[#2e2e2e] dark:bg-gray-[#2e2e2e] border border-yellow-300 text-yellow-300 dark:text-yellow-300 cursor-not-allowed opacity-60" 
                  : `cursor-pointer ${n.isRead
                    ? "bg-gray-100 dark:bg-[#2e2e2e] text-gray-400"
                    : "bg-[#2e2e2e] dark:bg-[#2e2e2e] font-semibold border border-[#1C6B1C]"}`
                }`}
              onClick={() => handleNotificationClick(n)}
              onMouseEnter={shouldShowTooltip(n) ? (e) => handleMouseEnter(n.id, e) : undefined}
              onMouseLeave={shouldShowTooltip(n) ? handleMouseLeave : undefined}
              title={n.isConversationRejected ? "This conversation has been declined" : undefined}
            >
              {!n.isRead && (
                <span className="inline-block w-2 h-2 bg-green-600 rounded-full mr-2" />
              )}
              <strong>{shouldShowSenderName(n) ? n.senderName : ""}</strong> {formatNotificationText(n)}
              {shouldShowTooltip(n) && n.messageCount && n.messageCount > 1 && (
                <span className="ml-1"></span>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(n.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
              </div>
              {/* 🆕 Tooltip */}
              {activeTooltip === n.id && n.conversationId && (
                <div 
                  className="fixed z-50"
                  style={{
                    left: tooltipPosition.x,
                    top: tooltipPosition.y
                  }}
                >
                  <GroupMembersTooltip
                    conversationId={n.conversationId}
                    isVisible={true}
                  />
                </div>
              )}
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
