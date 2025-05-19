// Knappen i toolbaren med innstillinger til en chat
"use client";
import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";
import { useDropdown } from "@/context/DropdownContext"; //

export default function MessageSettingsDropdown() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
      const dropdownContext = useDropdown();

    useClickOutsideGroups({
        includeRefs: [containerRef],
        onOutsideClick: () => setOpen(false),
        isActive: open
    });

    // Registrer i context når åpen
    useEffect(() => {
        const id = "message-settings";
        const close = () => setOpen(false);

        if (open) {
            dropdownContext.register({ id, close });
        }

        return () => {
            dropdownContext.unregister(id);
        };
    }, [open, dropdownContext]);

    return (
        <div className="relative" ref={containerRef}>
        <ProfileNavButton
            variant="smallx" // matcher toolbar-stil
            text={<Settings size={18} />}
            onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
            }}
            aria-label="Innstillinger"
            className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white flex items-center justify-center"
        />

        {open && (
            <div
            className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#1e2122] shadow-lg border border-gray-200 dark:border-[#1C6B1C] rounded-md z-30"
            onClick={(e) => e.stopPropagation()}
            >
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e]">
                Valg 1
            </button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e]">
                Valg 2
            </button>
            </div>
        )}
        </div>
    );
}