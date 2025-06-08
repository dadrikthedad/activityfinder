// Dette er popup-en som dukker opp ved å trykke på en profil sin miniAvatar. Har en meny samt fultnavn, og et bilde vi kan zoome inn på for å se fullstørrelse. Bruker en Portal slik at den
// hentes opp samme sted uansett hvor den er. Bruke z-1000, så EnlargeableImage bruker feks z-1100
"use client";
import { useEffect, useRef, useState } from "react";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import UserActionPopoverContent from "./UserActionPopoverContent";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useFriendWith } from "@/hooks/useFriendWith";
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useDropdown } from "@/context/DropdownContext";
import { useModal } from "@/context/ModalContext";
import NewMessageModal from "@/components/messages/NewMessageModal";


interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>
}

export default function UserActionPopover({ user, avatarSize = 120, onRemoveSuccess, popoverRef }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(user.id);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter(); // Linke til profilsiden
  const dropdownContext = useDropdown();
  const { showModal } = useModal();

  // Lukke UserActionPopvoer.tsx ved esc
    useEffect(() => {
      const id = `user-popover-${user.id}`;
      const close = () => setIsOpen(false);

      if (isOpen) {
        dropdownContext.register({ id, close });
      }

      return () => {
        dropdownContext.unregister(id);
      };
    }, [isOpen]);

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
        <MiniAvatar imageUrl={user.profileImageUrl ?? "/default-avatar.png"} size={avatarSize} />
      </button>

      {isOpen &&
        createPortal(
          <div ref={popoverRef ?? panelRef} style={panelStyles}>
            <UserActionPopoverContent
              user={user}
              isOwner={isOwner}
              isFriend={!!isFriend}
              isFriendLoading={isFriendLoading}
              onVisitProfile={() => {
                router.push(`/profile/${user.id}`);
                setIsOpen(false);
              }}
              onSendMessage={() => {
                showModal(<NewMessageModal initialReceiver={user} />);
                setIsOpen(false);
              }}
              onRemoveFriend={handleRemove}
              onClose={() => setIsOpen(false)}
            />
          </div>,
          document.body
        )}
    </>
  );
}
