// Dropdown til ved besøk av en bruker, gir en meny med feks block, ignore osv. Brukes i profile/[id]
// DropdownNavButton.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
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
  useOverlaySystem?: boolean; // ✅ NEW: Support for nested usage
}

export default function DropdownNavButton({
  text,
  actions,
  isFriend = false,
  variant = "long",
  className = "",
  useOverlaySystem = true // ✅ Default to true for backwards compatibility
}: DropdownNavButtonProps) {
  console.log('🔽 OVERLAY DropdownNavButton props received:', { useOverlaySystem, text });

  const [isOpen, setIsOpen] = useState(false);
  const overlay = useOverlay();

  // ✅ Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) {
      // When not using overlay system, register only when opening
      if (isOpen && !overlay.isOpen) {
        console.log('🔽 OVERLAY DropdownNavButton opening without overlay state management, but registering for outside clicks:', { text });
        overlay.open();
      }
      return;
    }

    // Normal overlay state management
    if (isOpen && !overlay.isOpen) {
      console.log('🔽 OVERLAY DropdownNavButton opening:', { text });
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      console.log('❌ OVERLAY DropdownNavButton closing:', { text });
      overlay.close();
    }
  }, [isOpen, overlay, text, useOverlaySystem]);

  // ✅ Auto-close when overlay system closes us externally
  useOverlayAutoClose(() => {
    console.log('🔽 OVERLAY DropdownNavButton auto-close triggered:', { text });
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  }, overlay.level ?? undefined);

  const handleToggle = useCallback(() => {
    console.log('🔽 OVERLAY DropdownNavButton toggle:', { text, currentlyOpen: isOpen });
    setIsOpen(prev => !prev);
  }, [isOpen, text]);

  const handleClose = useCallback(() => {
    console.log('❌ OVERLAY DropdownNavButton manual close:', { text });
    setIsOpen(false);
  }, [text]);

  const handleActionClick = useCallback((action: Action) => {
    console.log('🎯 OVERLAY DropdownNavButton action clicked:', { text, action: action.label });
    action.onClick();
    handleClose();
  }, [handleClose, text]);

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