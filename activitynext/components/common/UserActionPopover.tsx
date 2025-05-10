// Dette er popup-en som dukker opp ved å trykke på en profil sin miniAvatar. Har en meny samt fultnavn, og et bilde vi kan zoome inn på for å se fullstørrelse. Bruker en Portal slik at den
// hentes opp samme sted uansett hvor den er. Bruke z-1000, så EnlargeableImage bruker feks z-1100
"use client";
import { useEffect, useRef, useState } from "react";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import EnlargeableImage from "@/components/common/EnlargeableImage";
import ProfileNavButton from "../settings/ProfileNavButton";
import DropdownNavButton from "../DropdownNavButton";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useFriendWith } from "@/hooks/useFriendWith";
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>
  onCloseDropdown?: () => void;
}

export default function UserActionPopover({ user, avatarSize = 120, onRemoveSuccess, popoverRef, onCloseDropdown }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(user.id);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter(); // Linke til profilsiden

  
    const handleVisitProfile = () => {
      router.push(`/profile/${user.id}`);
      onCloseDropdown?.(); // ← Nå skjer dette ETTER push
    };

  const handleRemove = async () => {
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    setIsOpen(false);
  };

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelStyles({
        position: "absolute",
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        zIndex: 1000,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

    return (
    <>
      <button ref={buttonRef} onClick={() => setIsOpen((prev) => !prev)}>
        <MiniAvatar
          imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
          size={avatarSize}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={panelStyles}
            className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]"
          >
            <div className="relative">
              {/* 👇 Lukke-knapp */}
              <ProfileNavButton
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                text="X"
                variant="smallx"
                className="absolute -top-8 -right-4 text-gray-500 hover:text-gray-700 text-lg font-bold flex items-center justify-center"
                aria-label="Close"
              />

              <div className="flex gap-12 mt-4 items-start">
                <div className="flex-shrink-0">
                  <EnlargeableImage
                    src={user.profileImageUrl ?? "/default-avatar.png"}
                    size={120}
                  />
                  <div className="w-full mt-2 text-center break-words max-w-[120px]">
                    <p className="text-lg font-semibold">{user.fullName}</p>
                  </div>
                </div>

                <div className="flex flex-col justify-center flex-1 items-start space-y-2">
                  <ProfileNavButton
                    href={`/profile/${user.id}`}
                    text="Visit Profile"
                    variant="small"
                    className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                    onClick={handleVisitProfile}
                    
                  />
                  {!isOwner && (
                    <>
                      <ProfileNavButton
                        text="Send Message"
                        onClick={() => alert("Coming soon!")}
                        variant="small"
                        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                      />
                      {!isFriendLoading && (
                        <DropdownNavButton
                          text="More Options"
                          variant="small"
                          className="self-start bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                          actions={[
                            ...(isFriend ? [{ label: "Remove Friend", onClick: handleRemove }] : []),
                            { label: "Block", onClick: () => alert("Block clicked") },
                            { label: "Ignore", onClick: () => alert("Ignore clicked") },
                            { label: "Report", onClick: () => alert("Report clicked") },
                          ]}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
