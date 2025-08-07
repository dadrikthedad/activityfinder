// Her er den som håndterer Notifications sammen med bjella i Navbaren. Her er eventen som kobler seg på websocketen til backend
"use client";

import { Bell } from "lucide-react";
import NotificationBadge from "@/components/notifications/NotificationBadgeNative";

interface Props {
  onClick: () => void;
  unreadCount: number;
}

export default function NavbarNotifications({ onClick, unreadCount }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2"
    >
      <Bell size={18} />
      <span className="relative">
        Notifications
        <NotificationBadge count={unreadCount} />
      </span>
    </button>
  );
}