// Dropdownen til notificaitons i navbaren. Henter både friendrequests og notificaitons til å vise de hver for seg i navbaren
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useEffect } from "react";

import { useDropdown } from "@/context/DropdownContext";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";

import FriendRequestButtons from "../friends/FriendRequestButtons";

import { useNotificationStore } from "@/store/useNotificationStore";

import ProfileNavButton from "@/components/settings/ProfileNavButton";
import type { NotificationDTO } from "@/types/NotificationEventDTO";
import { useFriendRequestHandler } from "@/hooks/friends/useFriendInvitationsHandler";


export default function NotificationDropdown({ onClose }: { onClose: () => void }) {
  /* ---------- data fra store ---------- */
  const invitations         = useNotificationStore((s) => s.friendRequests);
  const notifications       = useNotificationStore((s) => s.notifications);
  const { handleResponse, handlingId } = useFriendRequestHandler();
  const totalFriendRequests = useNotificationStore((s) => s.friendRequestTotalCount);


  const dropdownContext = useDropdown();
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef("notification-dropdown");

  /* ---------- lukk ved klikk utenfor ---------- */
  useClickOutsideGroups({
    includeRefs: [containerRef],
    onOutsideClick: onClose,
    isActive: true,
  });

  /* ---------- registrer i DropdownContext ---------- */
  useEffect(() => {
    dropdownContext.register({ id: idRef.current, close: onClose });
    return () => dropdownContext.unregister(idRef.current);
  }, [dropdownContext, onClose]);       


  /* ---------- RENDER ---------- */
  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 w-120 max-h-[480px] overflow-y-auto border-2 border-[#1C6B1C] custom-scrollbar"
    >
      <h4 className="text-lg font-semibold mb-2 text-center">
        Notifications
      </h4>

      {/* -------- Friend Requests -------- */}
      {invitations.length > 0 && (
        <ul className="space-y-2 mb-4">
          {invitations.slice(0, 3).map((invite) => (
            <li
              key={invite.id}
              className="flex items-center justify-between gap-2 p-2"
            >
              <Link
                href={`/profile/${invite.userSummary?.id}`}
                onClick={onClose}
                className="flex items-center gap-3"
              >
                <Image
                  src={
                    invite.userSummary?.profileImageUrl ??
                    "/default-avatar.png"
                  }
                  alt={invite.userSummary?.fullName || "User"}
                  width={60}
                  height={60}
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <span className="text-lg font-semibold truncate max-w-[300px]">
                    {invite.userSummary?.fullName}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    wants to be your friend.
                  </span>
                </div>
              </Link>

              <div className="flex gap-1">
                <FriendRequestButtons
                  requestId={invite.id}
                  isLoading={handlingId === invite.id}
                  onRespond={handleResponse}
                  variant="icons"
                  size="smallx"
                />
              </div>
            </li>
          ))}

          {totalFriendRequests > 3 && (
            <>
              <li className="text-sm text-gray-500 text-center mt-1">
                You have {totalFriendRequests} total friend requests
              </li>
              <li className="text-center mt-2">
                <ProfileNavButton
                  text="View All Friends"
                  href="/friends"
                  variant="small"
                  className="bg-[#1C6B1C] hover:bg-[#145214] text-white"
                />
              </li>
            </>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-[#1C6B1C]" />
        </ul>
      )}

      {/* -------- Vanlige notifikasjoner -------- */}
      <ul className="space-y-2">
        {notifications
          .filter((n) => n.type !== "FriendInvitation")
          .map((n: NotificationDTO) => (
            <li key={n.id}>
              <div
                onClick={onClose}
                className="block p-2 rounded hover:bg-[#e7f3e7] dark:hover:bg-[#2c2f30] cursor-pointer"
              >
                {n.relatedUser ? (
                  <Link
                    href={`/profile/${n.relatedUser.id}`}
                    onClick={onClose}
                    className="underline hover:text-[#1C6B1C]"
                  >
                    {n.relatedUser.fullName}
                  </Link>
                ) : (
                  "Someone"
                )}
                {n.type === "FriendInvAccepted"
                  ? " accepted your friend request."
                  : " sent you a notification."}
              </div>
            </li>
          ))}
      </ul>

      {/* -------- View all -------- */}
      <div className="text-center mt-3">
        <ProfileNavButton
          text="View All Notifications"
          href="/notifications"
          variant="small"
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white"
        />
      </div>
    </div>
  );
}