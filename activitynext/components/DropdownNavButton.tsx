"use client";

import { useState, useRef, useEffect } from "react";

interface Action {
  label: string;
  onClick: () => void;
}

interface DropdownNavButtonProps {
  text: string;
  actions: Action[];
  isFriend?: boolean
}

export default function DropdownNavButton({ text, actions, isFriend = false }: DropdownNavButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Lukk hvis vi klikker utenfor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // TODO: Fjerner venn
  const combinedActions: Action[] = [
    ...actions,
    ...(isFriend
      ? [{ label: "Remove as Friend", onClick: () => alert("Friend removed") }]
      : []),
  ];

  return (
    <div ref={ref} className="relative w-full flex flex-col items-center">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-[#166016] hover:bg-green-800 text-white px-6 py-3 rounded-m w-[280px] font-semibold text-lg text-center"
      >
        {text}
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-[280px] bg-white text-black rounded-md shadow-lg z-30">
          {combinedActions.map((action, idx) => (
            <button
              key={idx}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
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
