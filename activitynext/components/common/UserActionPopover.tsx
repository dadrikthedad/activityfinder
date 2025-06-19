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
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";

// Standalone mode props (original UserActionPopover)
interface StandaloneProps {
  mode: 'standalone';
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
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
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
}

type Props = StandaloneProps | DropdownProps;

export default function UserActionPopover(props: Props) {
    const { user, avatarSize = 120, onRemoveSuccess, isGroup = false, participants = [], onLeaveGroup, isPendingRequest = false  } = props;
  
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

  const [nestedUserPopover, setNestedUserPopover] = useState<{
      user: UserSummaryDTO;
      position: { x: number; y: number };
    } | null>(null);

  // ESC key handling
    useEffect(() => {
    if (!isOpen) return;

    const id = `user-popover-${user.id}`;
    const close = () => {
      // ✅ Hierarkisk lukking ved ESC også
      if (nestedUserPopover) {
        console.log("🔸 ESC: Lukker nested popover først");
        setNestedUserPopover(null);
      } else {
        console.log("🔸 ESC: Lukker hovedpopover");
        if (props.mode === 'standalone') {
          setStandaloneIsOpen(false);
        } else {
          props.toggleUserPopover(user.id);
        }
      }
    };

    dropdownContext.register({ id, close });

    return () => {
      dropdownContext.unregister(id);
    };
  }, [isOpen, props.mode, user.id, nestedUserPopover]);

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
        position: "fixed",
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
  useClickOutsideGroups({
    includeRefs: props.mode === 'dropdown' 
      ? (props.dropdownRef ? [props.dropdownRef, panelRef] : [panelRef])
      : [buttonRef, panelRef],
    excludeRefs: nestedUserPopover ? [
      // Legg til nested popover ref hvis du lager en
    ] : [],
    excludeClassNames: ["[data-nested-user-popover]"],
    onOutsideClick: () => {
      // ✅ Hierarkisk lukking
      if (nestedUserPopover) {
        setNestedUserPopover(null);
      } else {
        if (props.mode === 'standalone') {
          setStandaloneIsOpen(false);
        } else {
          props.toggleUserPopover(user.id);
        }
      }
    },
    isActive: isOpen,
    dropdownId: `user-popover-${user.id}`,
  });

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

  // ✅ Handler for å vise nested user popover fra participants
  const handleShowUserPopover = (participantUser: UserSummaryDTO, pos: { x: number; y: number }) => {
    setNestedUserPopover({ user: participantUser, position: pos });
  };

  // ✅ Handler for å lukke nested user popover
  const handleCloseNestedPopover = () => {
    setNestedUserPopover(null);
  };

  // ✅ Oppdater handleLeaveGroup
  const handleLeaveGroup = () => {
    if (onLeaveGroup) {
      onLeaveGroup();
    }
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
        <MiniAvatar 
          imageUrl={user.profileImageUrl ?? (isGroup ? "/default-group.png" : "/default-avatar.png")} 
          size={avatarSize} 
        />
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
              // ✅ Pass gruppe-props
              isGroup={isGroup}
              participants={participants}
              onLeaveGroup={handleLeaveGroup}
              onShowUserPopover={handleShowUserPopover}
              isPendingRequest={isPendingRequest}
            />
          </div>,
          document.body
        )}

      {/* ✅ Nested UserActionPopover for participants */}
      {nestedUserPopover &&
        createPortal(
          <div
            data-nested-user-popover
            data-nested-popover 
            style={{
              position: "fixed",
              top: nestedUserPopover.position.y,
              left: nestedUserPopover.position.x,
              zIndex: 1100, // Høyere enn hovedpopover
            }}
          >
            <UserActionPopoverContent
              user={nestedUserPopover.user}
              isOwner={nestedUserPopover.user.id === currentUserId}
              isFriend={false} // Du kan implementere friend-check hvis nødvendig
              isFriendLoading={false}
              onVisitProfile={() => {
                router.push(`/profile/${nestedUserPopover.user.id}`);
                handleCloseNestedPopover();
                handleClose();
                if (props.mode === 'dropdown') {
                  props.onCloseDropdown?.();
                }
              }}
              onSendMessage={() => {
                showModal(<NewMessageModal initialReceiver={nestedUserPopover.user} />, { blurBackground: false });
                handleCloseNestedPopover();
                handleClose();
                if (props.mode === 'dropdown') {
                  props.onCloseDropdown?.();
                }
              }}
              onRemoveFriend={() => {}} // Implementer hvis ønskelig
              onClose={handleCloseNestedPopover}
              isGroup={false} // Participants er aldri grupper
            />
          </div>,
          document.body
        )}
    </>
  );
}