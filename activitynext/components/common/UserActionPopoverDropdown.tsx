// Dette er popup-en som dukker opp ved å trykke på en profil sin miniAvatar. Har en meny samt fultnavn, og et bilde vi kan zoome inn på for å se fullstørrelse. Bruker en Portal slik at den
// hentes opp samme sted uansett hvor den er. Bruke z-1000, så EnlargeableImage bruker feks z-1100
"use client";
import { useEffect, useRef, useState } from "react";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";
import UserActionPopoverContent from "./UserActionPopoverContent";
import { useRouter } from "next/navigation";


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
  position: { x: number; y: number };
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
  position,
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
  const router = useRouter();
  

  // 📌 2. Gi ytre komponenter tilgang til popoverRef for klikk-logikk
    useEffect(() => {
      if (isOpen && panelRef.current) {
        setUserPopoverRef?.(panelRef as React.RefObject<HTMLDivElement>);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- panelRef er stabil
    }, [isOpen]);

    // 📌 3. Gi tilgang til refs for andre klikksjekker hvis nødvendig
     useEffect(() => {
      if (isOpen && setPopoverRefs) {
        setPopoverRefs([buttonRef.current, panelRef.current]);
      }
    }, [isOpen, setPopoverRefs]);
    // sletting av venner
  const handleRemove = async () => {
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    toggleUserPopover(user.id);
  };

 
    // 📌 1. Beregn posisjon basert på props
    useEffect(() => {
    if (isOpen && position) {
      setPanelStyles({
        position: "absolute",
        top: position.y,
        left: position.x,
        zIndex: 1000,
      });
    }
  }, [isOpen, position]);

   
  // 📌 5. Last vennestatus (bare første gang)
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


  // 📌 4. Lukk popover hvis du klikker utenfor dropdown og panel
  useEffect(() => {
    if (!isOpen) return;
    
    const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as Node;

        const insideDropdown = dropdownRef?.current?.contains(target);
        const insidePanel = panelRef.current?.contains(target);

        if (!insideDropdown && !insidePanel) {
          toggleUserPopover(user.id);
        }
      };

      document.addEventListener("mousedown", handleOutsideClick);

      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }, [isOpen, dropdownRef, toggleUserPopover, user.id]);

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
          <div ref={panelRef} style={panelStyles}>
            <UserActionPopoverContent
              user={user}
              isOwner={isOwner}
              isFriend={!!isFriend}
              isFriendLoading={isFriendLoading}
              onVisitProfile={() => {
                router.push(`/profile/${user.id}`);
                onCloseDropdown?.();
              }}
              onSendMessage={() => alert("Coming soon!")}
              onRemoveFriend={handleRemove}
              onClose={() => toggleUserPopover(user.id)}
            />
          </div>,
          document.body
        )}
    </>
  );
}