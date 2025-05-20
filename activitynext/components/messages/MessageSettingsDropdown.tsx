// Knappen i toolbaren med innstillinger til en chat
"use client";
import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";
import { useDropdown } from "@/context/DropdownContext"; //
import { useChatStore } from "@/store/useChatStore";
import { useSearchMessages } from "@/hooks/messages/useSearchMessages";

export default function MessageSettingsDropdown() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownContext = useDropdown();
    const searchMode = useChatStore((s) => s.searchMode);
    const setSearchMode = useChatStore((s) => s.setSearchMode);
    const { resetSearch } = useSearchMessages();

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
            aria-label="Settings"
            className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white flex items-center justify-center"
        />

        {open && (
            <div
            className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#1e2122] shadow-lg border border-gray-200 dark:border-[#1C6B1C] rounded-md z-30"
            onClick={(e) => e.stopPropagation()}
            >
            <button
                onClick={() => {
                    if (searchMode) {
                    resetSearch();
                    setSearchMode(false);
                    useChatStore.getState().setSearchResults([]);
                    } else {
                    setSearchMode(true);
                    }
                    setOpen(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e]"
                >
                Search messages
                </button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e]">
                Show participants
            </button>
            </div>
        )}
        </div>
    );
}