// Her har vi siden til notifications. Bruker UserActionPopover til brukerne samt en link til FriendRequests
"use client";

import { useGetPageNotifications } from "@/hooks/notifications/useGetPageNotifications";
import UserActionPopover from "@/components/common/UserActionPopover";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { useDeleteAllNotifications } from "@/hooks/notifications/useDeleteAllNotifications";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useRouter } from "next/navigation"; 


export default function NotificationsPage() {
  const { notifications, loading, error } = useGetPageNotifications();
  const { deleteAll, loading: deleteLoading } = useDeleteAllNotifications();
  const { confirm } = useConfirmDialog(); // <-- bruker hooken her
  const router = useRouter();

  const handleDeleteAll = async () => {
    const confirmed = await confirm({
      title: "Delete All Notifications?",
      message: "Are you sure you want to delete all your notifications? This action cannot be undone.",
    });

    if (confirmed) {
      deleteAll();
      router.refresh();
    }
  };

  if (loading) {
    return <p className="text-center mt-8">Loading notifications...</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center mt-12">
        <h1 className="text-2xl font-bold mb-6 text-center text-[#1C6B1C]">Your Notifications</h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">No notifications found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center text-[#1C6B1C]">Your Notifications</h1>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#1C6B1C]"></h1>
        <ProfileNavButton
          text={deleteLoading ? "Deleting..." : "Delete All"}
          onClick={handleDeleteAll} // <-- byttet fra deleteAll direkte til handleDeleteAll
          variant="small"
          className="bg-gray-500 hover:bg-gray-700 text-white"
          disabled={deleteLoading}
        />
      </div>

      {loading && <p>Loading notifications...</p>}
      {error && <p className="text-red-500">Error loading notifications: {error.message}</p>}

      <ul className="space-y-4">
        {notifications.map((notification: NotificationDTO) => (
          <li
          key={notification.id}
          className="p-4 border border-[#1C6B1C] rounded-lg shadow-sm dark:bg-[#1e2122] bg-white flex justify-between items-center gap-4"
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {notification.relatedUser ? (
              <UserActionPopover mode="standalone" user={notification.relatedUser} avatarSize={60} />
            ) : (
              <div className="w-[60px] h-[60px] bg-gray-300 rounded-full flex-shrink-0" />
            )}
            <div className="truncate">
            <p className="text-lg font-semibold truncate">
            {notification.relatedUser?.fullName ?? "Someone"}{" "}
            {notification.type === "FriendRequest"
              ? "wants to be your friend."
              : notification.type === "FriendRequestAccepted"
              ? "accepted your friend request."
              : `sent a ${notification.type}`}
          </p>
              <p className="text-sm text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p>
            </div>
          </div>
        
          {notification.type === "FriendRequest" && (
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
