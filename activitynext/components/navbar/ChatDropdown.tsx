// Dropdownen som brukes til Chat i Navbaren
"use client";

import { Popover, Transition } from "@headlessui/react";
import { Fragment, useState, ReactNode } from "react";
import ChatWindow from "@/components/messages/ChatWindow";
import { useChatDropdownState } from "@/hooks/conversations/useChatDropdownState";
import { useChatState } from "@/hooks/conversations/useChatState";

interface ChatDropdownProps {
  children: ReactNode;
}

export default function ChatDropdown({ children }: ChatDropdownProps) {
  const dropdownState = useChatDropdownState();
  const [mode, setMode] = useState<"list" | "chat">("list");

  const chat = useChatState({
    ...dropdownState,
    autoSelectFirstConversation: false,
  });

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button as="div" className="cursor-pointer">
            {children}
          </Popover.Button>

          <Transition
            show={open}
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Popover.Panel className="absolute right-0 mt-2 z-50 w-auto">
              <div
                className={`
                  rounded-lg shadow-xl border-2 border-[#1C6B1C] dark:border-[#1C6B1C] bg-white dark:bg-[#1e2122]
                  transition duration-300 ease-in-out overflow-hidden
                  ${mode === "list" ? "w-[405px]" : "w-[90vw] max-w-5xl"}
                `}
              >
                <ChatWindow showSidebar={false} {...chat} onModeChange={setMode} />
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
