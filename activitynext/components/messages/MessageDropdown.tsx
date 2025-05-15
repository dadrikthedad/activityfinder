// Dropdownen som finnes i navbaren, inneholder ConversatonList.tsx, MessageList.tsx og MessageInput.tsx. Sender samtaleid mellom disse samt at den bruker fra navbaren
"use client";

import MessageList from "./MessageList";
import ConversationList from "./ConversationList";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageInput from "./MessageInput";
import { useChatStore } from "@/store/useChatStore";
import PendingRequestsList from "./PendingMessageList";
import { useModal } from "@/context/ModalContext";
import NewMessageModal from "./NewMessageModal";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useEffect, useRef, useState } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";



interface MessageDropdownProps {
    currentUser: UserSummaryDTO | null;
    popoverRef: React.RefObject<HTMLDivElement | null>
    onCloseDropdown: () => void;
    initialPosition?: { x: number; y: number };
  }

function debounce<A extends unknown[], R>(
  fn: (...args: A) => R,
  delay: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function MessageDropdown({ currentUser, popoverRef, onCloseDropdown, initialPosition }: MessageDropdownProps) {
  const { currentConversationId, setCurrentConversationId } = useChatStore();
  const { requests: pending, loading: pendingLoading } = usePendingMessageRequests();
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === currentConversationId)
  );
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  // Til dropdownen
  const DROPDOWN_SIZE_KEY = "messageDropdownSize";
  const dropdownRef = useRef<HTMLDivElement>(null);
  const DEFAULT_SIZE = { width: 1200, height: 600 };

  // For å dra den rundt
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const DROPDOWN_POSITION_KEY = "messageDropdownPosition";

  // På første render: sett størrelse fra localStorage
useEffect(() => {
  const el = dropdownRef.current;
  if (!el) return;

  try {
    const saved = localStorage.getItem(DROPDOWN_SIZE_KEY);
    const size = saved ? JSON.parse(saved) : DEFAULT_SIZE;
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
  } catch (e) {
    console.warn("Kunne ikke laste lagret størrelse:", e);
  }
}, []);

  // Lytt til manuell resize og lagre den med debounce
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    const rawHandleResize = (width: number, height: number) => {
    localStorage.setItem(DROPDOWN_SIZE_KEY, JSON.stringify({ width, height }));
  };

    const handleResize = debounce(rawHandleResize, 300);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        handleResize(width, height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

    // tilhørende bevegelse av dropdownen
    // Mousedown på en topbar
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      offsetRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y,
      };
    };
    // Mouseup/move
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - offsetRef.current.x;
        const newY = e.clientY - offsetRef.current.y;
        positionRef.current = { x: newX, y: newY };

        const el = dropdownRef.current;
        if (el) {
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
         localStorage.setItem(DROPDOWN_POSITION_KEY, JSON.stringify(positionRef.current));
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging]);

    // Sett og hent posisjon ved mount
    useEffect(() => {
      const el = dropdownRef.current;
      if (!el) return;

      try {
        const saved = localStorage.getItem(DROPDOWN_POSITION_KEY);
        const pos = saved ? JSON.parse(saved) : initialPosition || { x: 0, y: 0 };

        positionRef.current = pos;
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
      } catch (e) {
        console.warn("Kunne ikke laste lagret posisjon:", e);
      }
    }, []);

    // Oppdater state lokalt + globalt
    const handleSelect = (id: number) => {
      const pendingRequest = pending.find((r) => r.conversationId === id);
      if (pendingRequest) {
        useChatStore.getState().setPendingLockedConversationId(id);
      } else {
        useChatStore.getState().setPendingLockedConversationId(null);
      }
      setCurrentConversationId(id);
    };

    // Rydd bare når man bytter til en annen samtale
    useEffect(() => {
      return () => {
        if (currentConversationId !== null) {
          const state = useChatStore.getState();
          const live = state.liveMessages[currentConversationId] ?? [];
          const cached = state.cachedMessages[currentConversationId] ?? [];

          const combined = [
            ...cached,
            ...live.filter(m => !cached.some(c => c.id === m.id))
          ];

          console.log("💾 Cacher meldinger før unmount", {
            conversationId: currentConversationId,
            cachedCount: cached.length,
            liveCount: live.length,
            newTotal: combined.length
          });

          // 👉 Lagre dem før vi tømmer
          state.setCachedMessages(currentConversationId, combined);
          state.clearLiveMessages(currentConversationId);
        }
      };
    }, [currentConversationId]);

    console.log("🧭 Bytter samtale til", currentConversationId);

    const { showModal } = useModal(); // Viser ny meldingsmodalen
    

  return (
    <div   ref={dropdownRef}
      className="fixed right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md z-10 max-w-[100vw] border-2 border-[#1C6B1C] overflow-hidden resize"
        style={{
          minWidth: 600, // valgfritt: sett min-grenser
          minHeight: 400,
          left: positionRef.current.x,
          top: positionRef.current.y,
        }}
      >
        <div  className="bg-[#1C6B1C] text-white px-4 py-2 flex justify-between items-center cursor-move select-none w-full"           
              onMouseDown={onMouseDown}>
          <div> Messages </div>
          <div className="flex gap-2">
            <button
              className="text-white hover:text-gray-200"
              onClick={() => {
                localStorage.removeItem("messageDropdownSize");
                localStorage.removeItem("messageDropdownPosition");
                window.location.reload(); // eller trigger ny render
              }}
              title="Tilbakestill størrelse og posisjon"
            >
              ⟳
            </button>
            <button
              className="text-white hover:text-gray-200"
              onClick={onCloseDropdown}
              title="Lukk"
            >
              ✕
            </button>
          </div>
        </div>
      <div className="p-4 flex h-full">
        {/* Venstre kolonne */}
        <div className="w-[250px] flex flex-col relative overflow-hidden">
          {/* Øverst: Pending + separator */}
          {(pendingLoading || pending.length > 0) && (
            <div className="shrink-0">
              <PendingRequestsList limit={2} onSelectConversation={handleSelect} showMoreLink={true} />
              <hr className="my-2 w-3/4 mx-auto border-y border-gray-300 dark:border-[#1C6B1C]" />
            </div>
          )}

          {/* Midten: ConversationList som eneste som vokser */}
          <div className="flex-1 overflow-y-auto pr-2">
            <ConversationList
              selectedId={currentConversationId}
              onSelect={handleSelect}
              currentUser={currentUser}
            />
          </div>

          {/* Bunn: Fast knapp */}
          <div className="shrink-0 p-4 mb-5">
            <ProfileNavButton
              text="✚"
              variant="iconOnly"
              onClick={() => showModal(<NewMessageModal />)}
            />
          </div>
        </div>


        {/* Høyre kolonne */}
        <div className="flex-1 flex flex-col px-4 h-full">
          {currentConversation?.isPendingApproval && currentConversationId !== pendingLockedConversationId && (
            <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
              Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
            </div>
          )}

          {currentConversationId === pendingLockedConversationId && (
            <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                Approve the conversation to start sending messages.
            </div>
          )}

          {currentConversationId ? (
            <>
              <div className="flex-1 min-h-0 overflow-auto">
                <MessageList
                  currentUser={currentUser}
                  popoverRef={popoverRef}
                  onCloseDropdown={onCloseDropdown}
                />
              </div>

              <div className="shrink-0 mt-2 mb-10">
                <MessageInput
                  receiverId={undefined}
                  onMessageSent={(message) => {
                    console.log("Ny melding sendt:", message);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 flex-1 flex items-center justify-center">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}