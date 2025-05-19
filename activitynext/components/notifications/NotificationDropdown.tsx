// Dropdownen til notificaitons i navbaren. Henter både friendrequests og notificaitons til å vise de hver for seg i navbaren
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { FriendInvitationDTO } from "@/types/FriendInvitationDTO";
import { useDropdown } from "@/context/DropdownContext";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";

interface Props {
  onClose: () => void;
  notifications: NotificationDTO[];
  loading: boolean;
  invitations: FriendInvitationDTO[]; // Hvis du har en type for invitations – ellers `any[]` midlertidig
}

export default function NotificationDropdown({
  onClose,
  notifications,
  loading,
  invitations
}: Props) {
  const { token } = useAuth();
  const [handlingRequest, setHandlingRequest] = useState<number | null>(null);
  const dropdownContext = useDropdown();
  const containerRef = useRef<HTMLDivElement>(null);

  // lukke ved klikk på utsiden
  useClickOutsideGroups({
    includeRefs: [containerRef],
    onOutsideClick: () => onClose(),
    isActive: true,
  });

  useEffect(() => {
    const id = "notification-dropdown";
    const close = () => onClose();

    dropdownContext.register({ id, close });
    return () => dropdownContext.unregister(id);
  }, [onClose, dropdownContext]);



  const handleResponse = async (id: number, action: "accept" | "decline") => {
    if (!token) return;
    setHandlingRequest(id);
    try {
      await respondToInvitation(id, action, token);
      onClose(); // Reload optional
    } finally {
      setHandlingRequest(null);
    }
  };

  return (
    <div ref={containerRef} className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 w-120 max-h-[480px] overflow-y-auto border-2 border-[#1C6B1C]">
      <h4 className="text-lg font-semibold mb-2 text-center">Notifications</h4>

      {/* Friend Requests */}
      {invitations.length > 0 && (
        <ul className="space-y-2 mb-4">
          {invitations.slice(0, 3).map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-2 p-2">
              <Link href={`/profile/${invite.userSummary?.id}`} onClick={onClose} className="flex items-center gap-3">
              <Image
                    src={invite.userSummary?.profileImageUrl ?? "/default-avatar.png"}
                    alt={invite.userSummary?.fullName || "User"}
                    width={60}
                    height={60}
                    className="w-14 h-14 rounded-full object-cover"
                />
                <div className="flex flex-col">
                    <span className="text-lg font-semibold truncate max-w-[300px]">{invite.userSummary?.fullName}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 text-center">wants to be your friend.</span>
                </div>
                </Link>
              <div className="flex gap-1">
              <ProfileNavButton
                text="✔"
                onClick={() => handleResponse(invite.id, "accept")}
                disabled={handlingRequest === invite.id}
                variant="smallx"
                className="bg-green-600 hover:bg-green-700 text-white text-lg font-bold flex items-center justify-center"
                />
                <ProfileNavButton
                text="✖"
                onClick={() => handleResponse(invite.id, "decline")}
                disabled={handlingRequest === invite.id}
                variant="smallx"
                className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                />
              </div>
            </li>
          ))}

          

            {invitations.length > 3 && (
                <>
                    <li className="text-sm text-gray-500 text-center mt-1">
                    You have {invitations.length} total friend requests
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
                {/* Divider between Friend Requests and Notifications */}
      <div className="my-4 border-t border-[#1C6B1C]" />
            </ul>
      )}

      

      {/* Other Notifications */}
{loading ? (
  <p className="text-center">Loading...</p>
) : (
  <>
    <ul className="space-y-2">
    {notifications
    .filter((n) => n.type !== "FriendRequest")
    .map((n: NotificationDTO) => (
        <li key={n.id}>
        <div
            onClick={() => onClose()}
            className="block p-2 rounded hover:bg-[#e7f3e7] dark:hover:bg-[#2c2f30] cursor-pointer"
        >
            {n.relatedUser ? (
            <Link href={`/profile/${n.relatedUser.id}`} onClick={onClose} className="underline hover:text-[#1C6B1C]">
                {n.relatedUser.fullName}
            </Link>
            ) : (
            "Someone"
            )}
            {n.type === "FriendRequestAccepted"
            ? " accepted your friend request."
            : " sent you a notification."}
        </div>
        </li>
    ))}
    </ul>

    {/* 🔽 View All Notifications button (always visible) */}
    <div className="text-center mt-3">
      <ProfileNavButton
        text="View All Notifications"
        href="/notifications"
        variant="small"
        className="bg-[#1C6B1C] hover:bg-[#145214] text-white"
      />
    </div>
  </>
)}
    </div>
  );
}