// Her har vi siden til notifications. Bruker UserActionPopover til brukerne samt en link til FriendRequests
"use client";

import { useNotificationStore } from "@/store/useNotificationStore";
import { useDeleteAllNotifications } from "@/hooks/notifications/useDeleteAllNotifications";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import UserActionPopover   from "@/components/common/UserActionPopover";
import ProfileNavButton    from "@/components/settings/ProfileNavButton";
import { useRouter }       from "next/navigation";

export default function NotificationsPage() {
  /* -------- data ---------- */
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadLoading = false; // ikke behov – data er allerede i store

  /* -------- delete all ---------- */
  const { deleteAll, loading: deleteLoading } = useDeleteAllNotifications();
  const { confirm } = useConfirmDialog();
  const router = useRouter();

  const handleDeleteAll = async () => {
    const ok = await confirm({
      title: "Delete All Notifications?",
      message:
        "Are you sure you want to delete all your notifications? This action cannot be undone.",
    });
    if (ok) {
      await deleteAll();
      router.refresh();          // optional – hvis du vil trigge SSR-refetch
    }
  };

  /* -------- tom- / lastestand -------- */
  if (unreadLoading) {
    return <p className="text-center mt-8">Loading notifications...</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center mt-12">
        <h1 className="text-2xl font-bold mb-6 text-[#1C6B1C]">
          Your Notifications
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          No notifications found.
        </p>
      </div>
    );
  }

  /* -------- render-liste -------- */
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center text-[#1C6B1C]">
        Your Notifications
      </h1>

      <div className="flex justify-between items-center mb-6">
        <div />
        <ProfileNavButton
          text={deleteLoading ? "Deleting..." : "Delete All"}
          onClick={handleDeleteAll}
          variant="small"
          className="bg-gray-500 hover:bg-gray-700 text-white"
          disabled={deleteLoading}
        />
      </div>

      <ul className="space-y-4">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="p-4 border border-[#1C6B1C] rounded-lg shadow-sm dark:bg-[#1e2122] bg-white flex justify-between items-center gap-4"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {n.relatedUser ? (
                <UserActionPopover
                  mode="standalone"
                  user={n.relatedUser}
                  avatarSize={60}
                />
              ) : (
                <div className="w-[60px] h-[60px] bg-gray-300 rounded-full flex-shrink-0" />
              )}

              <div className="truncate">
                <p className="text-lg font-semibold truncate">
                  {n.relatedUser?.fullName ?? "Someone"}{" "}
                  {n.type === "FriendRequest"
                    ? "wants to be your friend."
                    : n.type === "FriendRequestAccepted"
                    ? "accepted your friend request."
                    : `sent a ${n.type}`}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {n.type === "FriendRequest" && (
              <ProfileNavButton
                text="View Requests"
                href="/friends"
                variant="small"
                className="bg-[#1C6B1C] hover:bg-[#145214] text-white flex-shrink-0"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
