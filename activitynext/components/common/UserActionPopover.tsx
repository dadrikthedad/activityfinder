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

interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
}

export default function UserActionPopover({ user, avatarSize = 120 }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyles, setPanelStyles] = useState<React.CSSProperties>({});

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelStyles({
          position: "absolute",
          top: rect.bottom + window.scrollY + 10, // 10px below the button
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
            <div className="flex justify-between items-start gap-4">
              {/* Left side: Larger avatar and name */}
              <div className="flex flex-col items-center">
                <EnlargeableImage
                  src={user.profileImageUrl ?? "/default-avatar.png"}
                  size={150}
                />
                <p className="mt-2 font-semibold text-center">{user.fullName}</p>
              </div>

              {/* Right side: Actions */}
              <ul className="text-sm space-y-2 text-right self-center">
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
                <ProfileNavButton
                  text="Ignore"
                  onClick={() => alert("Coming soon!")}
                  variant="small"
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                />
                <ProfileNavButton
                  text="Block User"
                  onClick={() => alert("Coming soon!")}
                  variant="small"
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                />
              </ul>
            </div>
          </Popover.Panel>
        </Transition>,
        document.body
      )}
    </Popover>
  );
}
