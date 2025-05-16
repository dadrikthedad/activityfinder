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
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";
import { startTransition } from "react";

interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  onCloseDropdown?: () => void;
  setPopoverRefs?: (refs: (HTMLElement | null)[]) => void;
  setUserPopoverRef?: (ref: React.RefObject<HTMLDivElement>) => void;
  openUserPopoverId: number | null;
  toggleUserPopover: (userId: number) => void;
}

export default function UserActionPopover({
  user,
  avatarSize = 120,
  onRemoveSuccess,
  dropdownRef,
  onCloseDropdown,
  setPopoverRefs,
  setUserPopoverRef,
  openUserPopoverId,
  toggleUserPopover,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = openUserPopoverId === user.id;
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [isFriendLoading, setIsFriendLoading] = useState(false);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  

  // Registrer panelRef i en samlet ref-liste
    useEffect(() => {
      if (isOpen && panelRef.current) {
        setUserPopoverRef?.(panelRef);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- panelRef er stabil
    }, [isOpen]);

  const handleRemove = async () => {
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    toggleUserPopover(user.id);
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
      if (isOpen && setPopoverRefs) {
        setPopoverRefs([buttonRef.current, panelRef.current]);
      }
    }, [isOpen, setPopoverRefs]);

  useEffect(() => {
    if (!isOpen || isFriend !== null) return;

    const fetchFriendStatus = async () => {
      setIsFriendLoading(true);
      try {
        const res = await fetch(`/api/friends/is-friend/${user.id}`);
        const json = await res.json();
        setIsFriend(json.isFriend);
      } catch (err) {
        console.warn("Kunne ikke hente vennestatus", err);
        setIsFriend(null);
      } finally {
        setIsFriendLoading(false);
      }
    };

    fetchFriendStatus();
  }, [isOpen, user.id]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;

      const insideDropdown = dropdownRef?.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      const insideButton = buttonRef.current?.contains(target);

      if (insideDropdown && !insidePanel && !insideButton) {
        toggleUserPopover(user.id);
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
      <button ref={buttonRef} onClick={() => toggleUserPopover(user.id)}>
        <MiniAvatar
          imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
          size={avatarSize}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyles}
            className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]"
          >
            <div className="relative">
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <ProfileNavButton
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUserPopover(user.id);
                  }}
                  text="X"
                  variant="smallx"
                  className="absolute -top-8 -right-4 text-gray-500 hover:text-gray-700 text-lg font-bold flex items-center justify-center"
                  aria-label="Close"
                />
              </div>

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
                    onClick={() => {
                      startTransition(() => {
                        onCloseDropdown?.();
                      });
                    }}
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
