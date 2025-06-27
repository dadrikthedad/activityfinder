// Dropdown til ved besøk av en bruker, gir en meny med feks block, ignore osv. Brukes i profile/[id]
// DropdownNavButton.tsx
"use client";

import { useRef } from "react";
import { useOverlay } from "@/context/OverlayProvider"; // NY IMPORT
import ProfileNavButton from "@/components/settings/ProfileNavButton";

interface Action {
  label: string;
  onClick: () => void;
}

interface DropdownNavButtonProps {
  text: string;
  actions: Action[];
  isFriend?: boolean;
  variant?: "default" | "small" | "large" | "long" | "normal" | "iconOnly" | "usual";
  className?: string;
  level?: number; // Ny: explicit level control
}

export default function DropdownNavButton({
  text,
  actions,
  isFriend = false,
  variant = "long",
  className = "",// Level kan settes eksplisitt hvis nødvendig
}: DropdownNavButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  // NY: Bruk den nye overlay hooken
  const overlay = useOverlay(); // Auto-level eller eksplisitt level

  const handleToggle = () => {
    overlay.toggle();
  };

  const handleClose = () => {
    overlay.close();
  };

  const handleActionClick = (action: Action) => {
    action.onClick();
    handleClose();
  };

  const combinedActions: Action[] = [
    ...actions,
    ...(isFriend
      ? [{ label: "Remove as Friend", onClick: () => alert("Friend removed") }]
      : []),
  ];

  return (
    <div ref={ref} className={`relative w-auto flex flex-col items-center ${className}`}>
      <ProfileNavButton
        text={text}
        onClick={handleToggle}
        variant={variant}
        className={className || "bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"}
      />
     
      {overlay.isOpen && (
        <div
          ref={overlay.ref}
          style={{ zIndex: overlay.zIndex }}
          className="absolute top-full mt-2 w-full bg-white dark:bg-[#1e2122] text-white rounded-md shadow-lg border-2 border-[#1C6B1C]"
        >
          {combinedActions.map((action, idx) => (
            <button
              key={idx}
              className="block w-full justify-center text-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}