import React, { useRef, useState, useLayoutEffect, ReactElement } from "react";
import { createPortal } from "react-dom";
import MiniAvatar from "../common/MiniAvatar";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

interface OverflowDropdownProps {
  anchorRef: React.RefObject<HTMLElement> | React.MutableRefObject<HTMLElement | null>;
  users: UserSummaryDTO[];
  onRemove: (id: number) => void;
}

export default function OverflowDropdown({ anchorRef, users, onRemove }: OverflowDropdownProps): ReactElement {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldFlipUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;

    setPos({
      top: shouldFlipUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      left: rect.left,
    });
  }, [anchorRef, users.length]);

  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed z-[99999] w-64 max-h-48 overflow-y-auto bg-white dark:bg-[#1e2122] border border-[#1C6B1C] rounded shadow-md p-2"
      style={{ top: pos.top, left: pos.left }}
    >
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center justify-between p-1 hover:bg-gray-100 dark:hover:bg-[#2a2e31] rounded"
        >
          <div className="flex items-center gap-2">
            <MiniAvatar
              imageUrl={u.profileImageUrl ?? "/default-avatar.png"}
              alt={u.fullName}
              size={24}
              withBorder={false}
            />
            <span className="text-sm">{u.fullName}</span>
          </div>
          <button
            onClick={() => onRemove(u.id)}
            className="text-gray-500 hover:text-red-500 text-sm"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  return createPortal(dropdown, document.body);
}
