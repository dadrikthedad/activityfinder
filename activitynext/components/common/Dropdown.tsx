// En dropdown som bruker ProfileNavButton med likt card og utseende. Kan brukes overalt, brukes nå i chat til options til samtaler
"use client";

import { useState, useRef, useEffect } from "react";
import SimpleTextButton from "./SimpleTextButton";

export interface DropdownAction {
  label: string;
  onClick: () => void;
}

interface ReusableDropdownButtonProps {
  text: string;
  actions: DropdownAction[];
  variant?: "default" | "small" | "large" | "long" | "normal" | "iconOnly" | "usual";
  className?: string;
}

export default function ReusableDropdownButton({
  text,
  actions,
  className = "",
}: ReusableDropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Beregn posisjon når dropdown åpnes

  // Lukk når man klikker utenfor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <SimpleTextButton
        ref={buttonRef}
        text={text}
        onClick={() => setOpen((prev) => !prev)}
        className={className}
        />

        {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-white dark:bg-[#1e2122] text-white rounded-md shadow-lg border-2 border-[#1C6B1C] min-w-[140px]"
        >
          {actions.map((action, idx) => (
            <button
              key={idx}
              className="block w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
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
    </>
  );
}