// Dropdown til ved besøk av en bruker, gir en meny med feks block, ignore osv. Brukes i profile/[id]
// DropdownNavButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
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
}

export default function DropdownNavButton({ text, actions, isFriend = false, variant = "long", className = "" ,}: DropdownNavButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        onClick={() => setOpen((prev) => !prev)}
        variant={variant}
        className={className || "bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"}
      />

      {open && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#1e2122] text-white rounded-md shadow-lg z-30 border-2 border-[#1C6B1C]">
          {combinedActions.map((action, idx) => (
            <button
              key={idx}
              className="block w-full justify-center text-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
