// Dette er popup-en som dukker opp ved å trykke på en profil sin miniAvatar. Har en meny samt fultnavn, og et bilde vi kan zoome inn på for å se fullstørrelse. Bruker en Portal slik at den
// hentes opp samme sted uansett hvor den er. Bruke z-1000, så EnlargeableImage bruker feks z-1100
"use client";
import { Popover, Transition } from "@headlessui/react";
import ProfileNavButton from "../settings/ProfileNavButton";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { Fragment, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DropdownNavButton from "../DropdownNavButton";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";




interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void; // Brukes for å bekrefte at en bruker har blitt slettet
}

export default function UserActionPopover({ user, avatarSize = 120, onRemoveSuccess }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});
  const { confirmAndRemove } = useConfirmRemoveFriend();

  const handleRemove = async () => {
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
  };

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelStyles({
          position: "absolute",
          top: rect.bottom + window.scrollY + 10,
          left: rect.left + window.scrollX,
          zIndex: 1000,
        });
      }
    };
  
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);
  
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, []);

  return (
    <Popover className="relative inline-block text-left">
      <Popover.Button ref={buttonRef}>
        <MiniAvatar
          imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
          size={avatarSize}
        />
      </Popover.Button>

      {createPortal(
        <Transition
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <Popover.Panel style={panelStyles} className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]">
          {({ close }) => (
    <div className="relative">
      {/* Lukkeknapp */}
      <ProfileNavButton
            onClick={() => close()}
            text="X"
            variant="smallx"
            className="absolute -top-7 -right-4 text-gray-500 hover:text-gray-700 text-lg font-bold flex items-center justify-center"
            aria-label="Close"
          />

    <div className="flex gap-12 mt-4 items-start">
          {/* VENSTRE SIDE: Avatar */}
          <div className="flex-shrink-0">
            <EnlargeableImage
              src={user.profileImageUrl ?? "/default-avatar.png"}
              size={120}
            />
            <div className="w-full mt-2 text-center break-words max-w-[120px]">
              <p className="text-lg font-semibold">{user.fullName}</p>
            </div>
          </div>

          {/* HØYRE SIDE: Info og knapper */}
          <div className="flex flex-col justify-center flex-1 items-start space-y-2">
            
            <ProfileNavButton
              href={`/profile/${user.id}`}
              text="Visit Profile"
              variant="small"
              className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
            />
            <ProfileNavButton
              text="Send Message"
              onClick={() => alert("Coming soon!")}
              variant="small"
              className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
            />
            <DropdownNavButton
              text="More Options"
              variant="small"
              className="self-start bg-gray-500 hover:bg-gray-600 text-white rounded-md"
              actions={[
                { label: "Remove Friend", onClick: handleRemove },
                { label: "Block", onClick: () => alert("Block clicked") },
                { label: "Ignore", onClick: () => alert("Ignore clicked") },
                { label: "Report", onClick: () => alert("Report clicked") },
              ]}
            />
          </div>
        </div>
    </div>
  )}
</Popover.Panel>
        </Transition>,
        document.body
      )}
    </Popover>
  );
}
