"use client";

import { Mail } from "lucide-react";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

interface Props {
    onClick: (e: React.MouseEvent) => void;
}

export default function NavbarMessageNotifications({ onClick }: Props) {
  const unreadCount = useMessageNotificationStore(
    (s) => s.notifications.filter((n) => !n.isRead).length
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2"
    >
      <Mail size={18} />
      <span className="relative">
        Messages
        <NotificationBadge count={unreadCount} />
      </span>
    </button>
  );
}
