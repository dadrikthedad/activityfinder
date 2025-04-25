// app/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

type NotificationDTO = {
  id: number;
  type: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  relatedUser: {
    id: number;
    fullName: string;
    profileImageUrl: string | null;
  } | null;
};

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWithAuth<NotificationDTO[]>(
          "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/notifications", // Merk: IKKE /navbar
          { method: "GET" },
          token
        );

        if (!data) {
          setError("No data received from server.");
        } else {
          setNotifications(data);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dine notifikasjoner</h1>
      {loading && <p>Laster inn...</p>}
      {error && <p className="text-red-500">Feil: {error}</p>}
      {notifications.length === 0 && !loading && <p>Ingen notifikasjoner.</p>}

      <ul className="space-y-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="p-4 border rounded-md shadow-sm bg-white dark:bg-[#1e2122]"
          >
            <p className="font-medium">
              {n.relatedUser?.fullName ?? "Ukjent bruker"} – {n.type}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(n.createdAt).toLocaleString()}
            </p>
            <p>{n.message ?? "Ingen melding"}</p>
            {!n.isRead && <span className="text-blue-600">Ulest</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}