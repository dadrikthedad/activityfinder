// Dette er popup-en som dukker opp ved å trykke på en profil sin miniAvatar. Har en meny samt fultnavn, og et bilde vi kan zoome inn på for å se fullstørrelse. Bruker en Portal slik at den
// hentes opp samme sted uansett hvor den er. Bruke z-1000, så EnlargeableImage bruker feks z-1100
// Støtter både standalone bruk og bruk innenfor dropdown-kontekster.
// Bruker Portal og z-1000, så EnlargeableImage bruker feks z-1100

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

// Standalone mode props (original UserActionPopover)
interface StandaloneProps {
  mode: 'standalone';
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}

// Dropdown mode props (original UserActionPopoverDropdown)
interface DropdownProps {
  mode: 'dropdown';
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

type Props = StandaloneProps | DropdownProps;

export default function UserActionPopover(props: Props) {
  const { user, avatarSize = 120, onRemoveSuccess } = props;
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // State management basert på mode
  const [standaloneIsOpen, setStandaloneIsOpen] = useState(false);
  const isOpen = props.mode === 'standalone' 
    ? standaloneIsOpen 
    : props.openUserPopoverId === user.id;
    
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});
  const [friendCheckEnabled, setFriendCheckEnabled] = useState(props.mode === 'standalone');
  
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(friendCheckEnabled ? user.id : undefined);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter();
  const dropdownContext = useDropdown();
  const { showModal } = useModal();

  // Enable friend check når popover åpnes (for dropdown mode)
  useEffect(() => {
    if (isOpen && !friendCheckEnabled) {
      setFriendCheckEnabled(true);
    }
  }, [isOpen, friendCheckEnabled]);

  // ESC key handling
  useEffect(() => {
    if (!isOpen) return;

    const id = `user-popover-${user.id}`;
    const close = props.mode === 'standalone' 
      ? () => setStandaloneIsOpen(false)
      : () => props.toggleUserPopover(user.id);

    dropdownContext.register({ id, close });

    return () => {
      dropdownContext.unregister(id);
    };
  }, [isOpen, props.mode, user.id]);

  // Dropdown mode specific effects
  useEffect(() => {
    if (props.mode === 'dropdown' && isOpen && panelRef.current) {
      props.setUserPopoverRef?.(panelRef as React.RefObject<HTMLDivElement>);
    }
  }, [props.mode, isOpen]);

  useEffect(() => {
    if (props.mode === 'dropdown' && isOpen && props.setPopoverRefs) {
      props.setPopoverRefs([buttonRef.current, panelRef.current]);
    }
  }, [props.mode, isOpen]);

  // Position calculation
  const updatePosition = () => {
    if (props.mode === 'standalone' && buttonRef.current) {
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
    if (props.mode === 'dropdown' && isOpen && props.position) {
      setPanelStyles({
        position: "absolute",
        top: props.position.y,
        left: props.position.x,
        zIndex: 1000,
      });
    }
  }, [props.mode, isOpen, props.mode === 'dropdown' ? props.position : null]);

  // Outside click and position updates for standalone mode
  useEffect(() => {
    if (props.mode !== 'standalone' || !isOpen) return;

    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setStandaloneIsOpen(false);
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
  }, [props.mode, isOpen]);

  // Outside click for dropdown mode
  useEffect(() => {
    if (props.mode !== 'dropdown' || !isOpen) return;
    
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDropdown = props.dropdownRef?.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);

      if (!insideDropdown && !insidePanel) {
        props.toggleUserPopover(user.id);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [props.mode, isOpen]);

  const handleRemove = async () => {
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    
    if (props.mode === 'standalone') {
      setStandaloneIsOpen(false);
    } else {
      props.toggleUserPopover(user.id);
    }
  };

  const handleClick = () => {
    if (props.mode === 'standalone') {
      setStandaloneIsOpen(prev => !prev);
    } else {
      props.toggleUserPopover(user.id);
    }
  };

  const handleClose = () => {
    if (props.mode === 'standalone') {
      setStandaloneIsOpen(false);
    } else {
      props.toggleUserPopover(user.id);
    }
  };

  const handleVisitProfile = () => {
    router.push(`/profile/${user.id}`);
    handleClose();
    if (props.mode === 'dropdown') {
      props.onCloseDropdown?.();
    }
  };

  const handleSendMessage = () => {
    showModal(<NewMessageModal initialReceiver={user} />, { blurBackground: false });
    handleClose();
    if (props.mode === 'dropdown') {
      props.onCloseDropdown?.();
    }
  };

  const finalPopoverRef = props.mode === 'standalone' && props.popoverRef 
    ? props.popoverRef 
    : panelRef;

  return (
    <>
      <button ref={buttonRef} onClick={handleClick}>
        <MiniAvatar imageUrl={user.profileImageUrl ?? "/default-avatar.png"} size={avatarSize} />
      </button>

      {isOpen &&
        createPortal(
          <div ref={finalPopoverRef} style={panelStyles}>
            <UserActionPopoverContent
              user={user}
              isOwner={isOwner}
              isFriend={!!isFriend}
              isFriendLoading={isFriendLoading}
              onVisitProfile={handleVisitProfile}
              onSendMessage={handleSendMessage}
              onRemoveFriend={handleRemove}
              onClose={handleClose}
            />
          </div>,
          document.body
        )}
    </>
  );
}