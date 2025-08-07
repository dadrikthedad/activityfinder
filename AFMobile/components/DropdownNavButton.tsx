// Dropdown til ved besøk av en bruker, gir en meny med feks block, ignore osv. Brukes i profile/[id]
// DropdownNavButton.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import ProfileNavButton from "@/components/settings/ProfileNavButton";

interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface DropdownNavButtonProps {
  text: string;
  actions: Action[];
  isFriend?: boolean;
  variant?: "default" | "small" | "large" | "long" | "normal" | "iconOnly" | "usual";
  className?: string;
  useOverlaySystem?: boolean; // Support for nested usage
}

export default function DropdownNavButton({
  text,
  actions,
  isFriend = false,
  variant = "long",
  className = "",
  useOverlaySystem = true // Default to true for backwards compatibility
}: DropdownNavButtonProps) {

  const [isOpen, setIsOpen] = useState(false);
  const overlay = useOverlay();

  // Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) {
      // When not using overlay system, register only when opening
      if (isOpen && !overlay.isOpen) {
        overlay.open();
      }
      return;
    }

    // Normal overlay state management
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay, text, useOverlaySystem]);

  // Auto-close when overlay system closes us externally
  useOverlayAutoClose(() => {
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  }, overlay.level ?? undefined);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []); 

  const handleActionClick = useCallback((action: Action) => {
    if (action.disabled) return;
    action.onClick();
    handleClose();
  }, [handleClose])

  const combinedActions: Action[] = [
    ...actions,
    ...(isFriend
      ? [{ label: "Remove as Friend", onClick: () => alert("Friend removed") }]
      : []),
  ];

  return (
    <div className={`relative w-auto flex flex-col items-center ${className}`}>
      <ProfileNavButton
        text={text}
        onClick={handleToggle}
        variant={variant}
        className={className || "bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"}
      />
     
      {isOpen && (
        <div
          ref={overlay.ref}
          style={{ zIndex: overlay.zIndex }}
          className="absolute top-full mt-2 w-full bg-white dark:bg-[#1e2122] text-white rounded-md shadow-lg border-2 border-[#1C6B1C]"
        >
          {combinedActions.map((action, idx) => (
            <button
              key={idx}
              className={`block w-full justify-center text-center px-4 py-2 text-sm ${
                action.disabled 
                  ? 'opacity-50 cursor-not-allowed text-gray-400' // Disabled styling
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700' // Normal styling
              }`}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}