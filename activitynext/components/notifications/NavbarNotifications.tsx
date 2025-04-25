// Her er den som håndterer Notifications sammen med bjella i Navbaren. Her er eventen som kobler seg på websocketen til backend
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import NotificationBadge from "@/components/notifications/NotificationBagde";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useGetNavbarNotifications } from "@/hooks/notifications/useGetNavbarNotifications";
import { useMarkAllNotificationsAsRead } from "@/hooks/notifications/useMarkAllNotificationsAsRead";
import { useNotificationHub } from "@/hooks/useNotificationHub";
import { NotificationDTO } from "@/types/NotificationEventDTO";

export default function NavbarNotifications() {
    const { notifications, setNotifications } = useGetNavbarNotifications();
  const { markAllAsRead } = useMarkAllNotificationsAsRead();
  const [showNotifications, setShowNotifications] = useState(false);

  useNotificationHub({
    onReceive: (newNotification: NotificationDTO) => {
      setNotifications((prev) => [newNotification, ...prev]);
    }
  });


  const handleToggleNotifications = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!showNotifications) {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }

    setShowNotifications((prev) => !prev);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggleNotifications}
        className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2"
      >
        <Bell size={18} />
        <span className="relative">
          Notifications
          <NotificationBadge count={notifications.filter((n) => !n.isRead).length} />
        </span>
      </button>

      {showNotifications && (
        <NotificationDropdown onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
}
