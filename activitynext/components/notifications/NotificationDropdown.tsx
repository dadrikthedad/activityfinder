"use client";

import { useEffect } from "react";
import { useGetNavbarNotifications } from "@/hooks/notifications/useGetNavbarNotifications";
import { useMarkAllNotificationsAsRead } from "@/hooks/notifications/useMarkAllNotificationsAsRead";
import { NotificationDTO } from "@/types/NotificationEventDTO";

interface Props {
    onClose: () => void;
  }
  
  export default function NotificationDropdown({ onClose }: Props) {
    const { notifications, loading } = useGetNavbarNotifications();
    const { markAllAsRead } = useMarkAllNotificationsAsRead();
  
    useEffect(() => {
      markAllAsRead();
    }, [markAllAsRead]);
  
    return (
      <div className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 w-80 max-h-96 overflow-y-auto border-2 border-[#1C6B1C] text-center">
        <h4 className="text-lg font-semibold mb-2">Notifications</h4>
  
        {loading ? (
          <p>Loading...</p>
        ) : notifications.length === 0 ? (
          <p>No new notifications.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n: NotificationDTO) => (
              <li key={n.id}>
                <div
                  onClick={() => {
                    // Håndter visning av informasjon her uten å navigere bort fra siden
                    onClose();
                  }}
                  className="block p-2 rounded hover:bg-[#e7f3e7] dark:hover:bg-[#2c2f30] cursor-pointer"
                >
                  {n.relatedUser?.fullName} sent you a friend request.
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }