"use client";

import { useUserSearch } from "@/hooks/useUserSearch";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useState, useRef, useEffect } from "react";
import NewMessageInput from "./NewMessageInput";
import { useModal } from "@/context/ModalContext";
import Card from "../common/Card";
import MiniAvatar from "../common/MiniAvatar";
import { useAuth } from "@/context/AuthContext";
import OverflowDropdown from "./NewMessageDropdown";
import { useKeyboardNavigableList } from "@/hooks/mouseAndKeyboard/useKeyboardForDropdown";

interface NewMessageModalProps {
  initialReceiver?: UserSummaryDTO;
}

export default function NewMessageModal({ initialReceiver }: NewMessageModalProps) {
  const { hideModal } = useModal();
  const { query, setQuery, results, loading } = useUserSearch();
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const { userId } = useAuth();

  // Hvis vi sender inn med en bruker via UserActionPopover eller Profilsiden så har vi en egen visning
  const hasInitialReceiver = !!initialReceiver;

  const [showDropdown, setShowDropdown] = useState(false);

  // Dra og slipp-posisjon
  const modalRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const [size] = useState({ width: 700, height: 500 });

  const filteredResults = results.filter(
    (user) =>
      user.id !== userId &&
      !selectedUsers.some((u) => u.id === user.id)
  );

  const defaultWidth = 700;
  const defaultHeight = 500;

  const [position, setPosition] = useState(() => ({
    x: (window.innerWidth - defaultWidth) / 2,
    y: (window.innerHeight - defaultHeight) / 2,
  }));

  const MAX_VISIBLE = 5;
  const visibleUsers = selectedUsers.slice(0, MAX_VISIBLE - 1);
  const overflowUsers = selectedUsers.slice(MAX_VISIBLE - 1);
  
  const keyboardNav = useKeyboardNavigableList(
    filteredResults,
    (user) => {
      if (!selectedUsers.find((u) => u.id === user.id)) {
        setSelectedUsers([...selectedUsers, user]);
      }
      setQuery("");
    },
    !!query
  );

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 200); // gir litt tid til å bevege musepekeren inn i dropdownen
  };


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;

    const modal = modalRef.current;
    const width = modal?.offsetWidth || 300;
    const height = modal?.offsetHeight || 200;

    const clampedX = Math.max(0, Math.min(window.innerWidth - width, newX));
    const clampedY = Math.max(0, Math.min(window.innerHeight - height, newY));

    setPosition({ x: clampedX, y: clampedY });
  };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

const triggerRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  if (initialReceiver && !selectedUsers.find((u) => u.id === initialReceiver.id)) {
    setSelectedUsers([initialReceiver]);
    setQuery(""); // tøm søkefeltet
  }
}, [initialReceiver, selectedUsers, setQuery]);





return (
       <Card
      ref={modalRef}
      className="fixed z-[9999] max-w-[100vw] w-full min-w-[300px] min-h-[200px] border-2 border-[#1C6B1C] bg-white dark:bg-[#1e2122] text-black dark:text-white shadow-md rounded-xl resize overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        minWidth: 500,
        minHeight: 300,
        maxWidth: window.innerWidth - 40,
        maxHeight: window.innerHeight - 40,
      }}
    >
  {/* Dra-linje - alltid øverst */}
  <div
    className="bg-[#1C6B1C] text-white px-4 py-2 flex justify-between items-center cursor-move select-none"
    onMouseDown={(e) => {
      const rect = modalRef.current?.getBoundingClientRect();
      if (rect) {
        offset.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        setIsDragging(true);
      }
    }}
  >
    <div className="font-semibold">New conversation</div>
    <div className="flex gap-4">
      <button onClick={() => setPosition({ x: 200, y: 200 })} title="Reset">⟳</button>
      <button onClick={hideModal} title="Close">✕</button>
    </div>
  </div>
    <div className="flex-1 min-h-0 overflow-hidden">
      {/* søkefelt + resultater + melding */}
      <div className="p-4 pt-0 mt-3 flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-hidden">
       {!hasInitialReceiver && (
        <>
       <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value); // viktig: null -> []
          }}
          placeholder="Search users..."
          className="w-full p-2 mb-2 border-1 rounded dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none"
        />

        {query && (
          <ul className="w-full border border-[#1C6B1C] rounded bg-white dark:bg-[#1e2122] max-h-60 overflow-auto mb-4">
            {loading && <li className="p-2 text-center">Loading...</li>}
            {!loading && results.length === 0 && (
              <li className="p-2 text-center text-gray-500">No users found</li>
            )}
            {!loading &&
              filteredResults.map((user, index) => (
                <li
                  key={user.id}
                  ref={keyboardNav.setItemRef(index)}
                  className={`p-2 cursor-pointer flex gap-3 items-center 
                      hover:bg-gray-100 dark:hover:bg-[#2a2e31] 
                      ${keyboardNav.activeIndex === index ? "bg-gray-100 dark:bg-[#2a2e31]" : ""}
                    `}
                  onClick={() => {
                    if (!selectedUsers.find((u) => u.id === user.id)) {
                      setSelectedUsers([...selectedUsers, user]);
                    }
                    setQuery("");
                    keyboardNav.setActiveIndex(0); 
                  }}
                >
                  <MiniAvatar
                    imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
                    alt={user.fullName}
                    size={40}
                    withBorder={true}
                  />
                  <span>{user.fullName}</span>
                </li>
              ))}
          </ul>
        )}
        </>
        )}

         {selectedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 relative">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 font-medium mr-2">
                To:
              </div>
            {visibleUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 border border-[#1C6B1C] rounded-full px-2 py-1 bg-white dark:bg-[#2a2e31]"
              >
                <MiniAvatar
                  imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
                  alt={user.fullName}
                  size={30}
                  withBorder={false}
                />
                <span className="text-sm">{user.fullName}</span>
                 {!hasInitialReceiver && (
                <button
                  onClick={() =>
                    setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id))
                  }
                  className="text-gray-500 hover:text-red-500 ml-1"
                >
                  ✕
                </button>
                )}
              </div>
            ))}

            {overflowUsers.length > 0 && (
             <div>
                <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="px-3 py-1 border border-[#1C6B1C] rounded-full text-sm bg-white dark:bg-[#2a2e31] cursor-pointer select-none relative"
              >
                +{overflowUsers.length} more
                {showDropdown && (
                  <OverflowDropdown
                    anchorRef={triggerRef}
                    users={overflowUsers}
                    onRemove={(id) =>
                      setSelectedUsers((prev) => prev.filter((u) => u.id !== id))
                    }
                  />
                )}
              </div>
                </div>
                            )}
                            
                          </div>
                          
                        )}

                    
                    </div>
                    {selectedUsers.length > 0 && (
                    <div className="shrink-0 mt-4">
                      <NewMessageInput
                        receiverId={selectedUsers[0].id}
                        onMessageSent={(message) => {
                          console.log("Melding sendt!", message);
                          hideModal();
                        }}
                        
                      />
                      
                    </div>
                    
                  )}
                </div>
          </div>
  </Card>
    
  );
}



