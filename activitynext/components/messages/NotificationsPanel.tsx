import { useMessageNotificationActions } from "@/hooks/messages/useMessageNotificationActions";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import ProfileNavButton from "../settings/ProfileNavButton";
import Router from "next/router";
import { useState, useRef } from 'react';
import GroupEventTooltip from "./GroupEventTooltip";
import React from 'react'; 
import { formatNotificationText } from "../functions/message/FormatNotificationsText";
import { shouldShowSenderName } from "../functions/message/shouldShowSenderName";
import { calculatePopoverPosition } from "../common/PopoverPositioning";

interface NotificationsPanelProps {
  onOpenConversation: (conversationId: number) => void;
}

export default function NotificationsPanel({ onOpenConversation }: NotificationsPanelProps) {
  const notifications = useMessageNotificationStore((s) => s.messageNotifications);
  const { markOneAsRead, markAllAsRead, loading: markAllLoading } = useMessageNotificationActions();
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const hasLoaded = useMessageNotificationStore((s) => s.hasLoadedNotifications);

  const totalNotifications = useMessageNotificationStore((s) => s.messageNotifications.length);
  const canGoToChat = totalNotifications >= 20;

  // 🆕 Forbedret tooltip state med calculatePopoverPosition
  const [activeTooltip, setActiveTooltip] = useState<{
    notificationId: number;
    position: { x: number; y: number };
  } | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

  // 🔄 Oppdatert handler for å vise tooltip med calculatePopoverPosition
  const handleMouseEnter = (notificationId: number, event: React.MouseEvent) => {
    // Kanseller eventuell pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Bruk calculatePopoverPosition for bedre plassering
    const position = calculatePopoverPosition(event);
    
    setActiveTooltip({
      notificationId,
      position
    });
  };

  const handleMouseLeave = (notificationId: number) => {
    // Gi tid til å bevege musen til tooltip før den skjules
    hideTimeoutRef.current = setTimeout(() => {
      // Dobbeltsjekk at vi fortsatt skal skjule denne tooltipet
      setActiveTooltip(prev => {
        if (prev?.notificationId === notificationId) {
          return null;
        }
        return prev;
      });
    }, 200); // Økt til 200ms for bedre UX
  };

  // 🆕 Handler for når musen er over tooltip-området
  const handleTooltipMouseEnter = () => {
    // Kanseller hide timeout når musen er over tooltip
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // 🆕 Handler for når musen forlater tooltip-området
  const handleTooltipMouseLeave = () => {
    // Skjul tooltip umiddelbart når musen forlater tooltip
    setActiveTooltip(null);
  };

  const shouldShowTooltip = (n: MessageNotificationDTO): boolean => {
    return (n.type === "GroupEvent" || n.type === 8);
  };

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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
        <ul className="space-y-2 overflow-auto w-full flex-1 min-h-0 pb-4 px-32">
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
              onMouseLeave={shouldShowTooltip(n) ? () => handleMouseLeave(n.id) : undefined}
              title={n.isConversationRejected ? "This conversation has been declined" : undefined}
            >
              {/* 🛡️ TRYGG: Rejected sjekkes først - beholder originale farger */}
              {!n.isConversationRejected && !n.isRead && (
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

      {/* 🆕 Tooltip med fast posisjonering - ikke lenger inni li-elementet */}
      {activeTooltip && (
        (() => {
          const notification = notifications.find(n => n.id === activeTooltip.notificationId);
          return notification && shouldShowTooltip(notification) && notification.conversationId ? (
            <div 
              ref={tooltipRef}
              className="fixed z-50"
              style={{
                left: activeTooltip.position.x,
                top: activeTooltip.position.y
              }}
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              <GroupEventTooltip
                eventSummaries={notification.eventSummaries || []}
                groupName={notification.groupName || "Unknown Group"}
                eventCount={notification.messageCount || 0}
                isVisible={true}
              />
            </div>
          ) : null;
        })()
      )}
    </div>
  );
}