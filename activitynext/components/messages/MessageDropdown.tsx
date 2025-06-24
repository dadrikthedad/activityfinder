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
import UserActionPopover from "../common/UserActionPopover";
import { useDropdown } from "@/context/DropdownContext";
import { useConversationSearch } from "@/hooks/messages/useSearchConversations";
import Spinner from "../common/Spinner";
import NotificationsPanel from "@/components/messages/NotificationsPanel";


interface MessageDropdownProps {
    currentUser: UserSummaryDTO | null;
    onCloseDropdown: () => void;
    initialPosition?: { x: number; y: number };
    setUserPopoverRef: (ref: React.RefObject<HTMLDivElement>) => void;
    openUserPopoverId: number | null;
    toggleUserPopover: (id: number | null) => void;
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

export default function MessageDropdown({ currentUser, onCloseDropdown, initialPosition, setUserPopoverRef, openUserPopoverId, toggleUserPopover }: MessageDropdownProps) {
  const { currentConversationId, setCurrentConversationId } = useChatStore();
  const pending = useChatStore(state => state.pendingMessageRequests);
  const hasLoadedPending = useChatStore(state => state.hasLoadedPendingRequests);
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === currentConversationId)
  );
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  // Til dropdownen
  const DROPDOWN_SIZE_KEY = "messageDropdownSize";
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lukke dropdown med Esc
  const dropdownContext = useDropdown();

  const { isModalOpen } = useModal();


  const [popoverUser, setPopoverUser] = useState<UserSummaryDTO | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | null>(null);
  const [popoverGroupData, setPopoverGroupData] = useState<{
    isGroup: boolean;
    participants: UserSummaryDTO[];
    onLeaveGroup?: () => void;
    isPendingRequest?: boolean; // ✅ Legg til dette feltet
    conversationId?: number;
  } | null>(null);
  const userPopoverRef = useRef<HTMLDivElement | null>(null);
  // Skjule MessageList.tsx uten valgt samtale og at vi kan toggle en samtale av igjen
  const [conversationVisible, setConversationVisible] = useState(true);

  // Brukes for å hente userActionPopover til MessageDropdown
  const showUserPopover = (
    user: UserSummaryDTO, 
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    }
  ) => {
    setPopoverUser(user);
    setPopoverPosition(pos);
    setPopoverGroupData(groupData || null); // ✅ Enkelt! Ingen ekstra logikk
    toggleUserPopover(user.id);
  };

  // For å dra den rundt
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const DROPDOWN_POSITION_KEY = "messageDropdownPosition";

  // For å sjekke om vi er i bunn av en samtale
  const [atBottom, setAtBottom] = useState(true);

  // Bytte til en samtale fra NotificationsPanel

  const openConversationFromNotification = (id: number) => {
    setCurrentConversationId(id);
    setConversationVisible(true);
  };

  // Ha kontroll på søke av samtaler
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    loading: searchLoading,
  } = useConversationSearch();

  const shouldShowPendingSection = !hasLoadedPending || pending.length > 0;


  // Lukker dropdown ved klikk på Esc
  const handleClose = () => {
    onCloseDropdown(); // eller annen logikk for å lukke dropdown
  };

  // Sjekekr at vi koblet på DropdownContext
  useEffect(() => {
    if (!dropdownContext) return;

    dropdownContext.register({ id: "messageDropdown", close: handleClose });
    return () => dropdownContext.unregister("messageDropdown");
  }, []);

  // 
  useEffect(() => {
    const handler = () => toggleUserPopover(null);
    window.addEventListener("close-user-popovers", handler);
    return () => window.removeEventListener("close-user-popovers", handler);
  }, [toggleUserPopover]);

  // På første render: sett størrelse fra localStorage
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    try {
      const saved = localStorage.getItem(DROPDOWN_SIZE_KEY);
      const DEFAULT_SIZE = { width: 1200, height: 600 };
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
        const el = dropdownRef.current;
        if (!el) return;

        const dropdownWidth = el.offsetWidth;
        const dropdownHeight = el.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let newX = e.clientX - offsetRef.current.x;
        let newY = e.clientY - offsetRef.current.y;

        // Begrens så dropdownen ikke kan flyttes utenfor skjermen
        newX = Math.max(0, Math.min(newX, windowWidth - dropdownWidth));
        const minY = 48; // eks. navbarens høyde
        newY = Math.max(minY, Math.min(newY, windowHeight - dropdownHeight));

        positionRef.current = { x: newX, y: newY };
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
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
    }, [initialPosition]);

    // Oppdater state lokalt + globalt
    const handleSelect = (id: number) => {
      const isSame = id === currentConversationId;

      if (isSame) {
        setCurrentConversationId(null);
        setConversationVisible((prev) => !prev);
        return;
      }

      const state = useChatStore.getState();
      const isPending = state.pendingMessageRequests.some((r) => r.conversationId === id);

      // 🏷️ Merk samtalen som pending-locked hvis det er en forespørsel
      state.setPendingLockedConversationId(isPending ? id : null);

      // 🔁 Vis samtalen
      state.setCurrentConversationId(id);
      setConversationVisible(true);
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

    const handleLeaveGroup = async (conversationId: number) => {
    try {
      console.log("🚪 Leave group clicked for conversation:", conversationId);
      
      // ✅ Placeholder: Vis en alert eller console melding
      alert(`Leave group functionality will be implemented soon!\nConversation ID: ${conversationId}`);
      
      // ✅ Lukk popover
      toggleUserPopover(null);
      
      // TODO: Implementer faktisk leave group logikk senere:
      // - API kall til backend
      // - Oppdater useChatStore 
      // - Fjern samtalen fra listen
      // - Vis success melding
      
    } catch (error) {
      console.error("❌ Failed to leave group:", error);
    }
  };


    const { showModal } = useModal(); // Viser ny meldingsmodalen

  return (
    <div   ref={dropdownRef} data-dropdown-id="message-dropdown" onMouseDown={(e) => {
          const target = e.target as Node;
          const insideUserPopover = userPopoverRef?.current?.contains(target);
          const insideDropdown = dropdownRef?.current?.contains(target);
    
          if (openUserPopoverId !== null && insideDropdown && !insideUserPopover && !isModalOpen) {
          toggleUserPopover(null);
        }
        }}
      className="fixed right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md z-10 max-w-[100vw] border-2 border-[#1C6B1C] overflow-hidden resize"
        style={{
          minWidth: 600, // valgfritt: sett min-grenser
          minHeight: 400,
          maxWidth: 2000, // valgfritt: sett min-grenser
          maxHeight: 1000,
          left: positionRef.current.x,
          top: positionRef.current.y,
        }}
      >
        <div  className="bg-[#1C6B1C] text-white px-4 py-2 flex justify-between items-center cursor-move select-none w-full"           
              onMouseDown={onMouseDown}>
          <div className="font-semibold"> Messages </div>
          <div className="flex gap-6">
            <button
              className="text-white hover:text-gray-200"
              onClick={() => {
                localStorage.removeItem("messageDropdownSize");
                localStorage.removeItem("messageDropdownPosition");
                window.location.reload(); // eller trigger ny render
              }}
              title="Reset position and size"
            >
              ⟳
            </button>
            <button
              className="text-white hover:text-gray-200"
              onClick={onCloseDropdown}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      <div className="p-4 flex h-full overflow-hidden">
        {/* Venstre kolonne */}
        <div className="w-[275px] flex flex-col relative overflow-hidden">
          {/* Øverst: Pending + separator */}
          {shouldShowPendingSection && (
            <div className="shrink-0">
              <PendingRequestsList 
                limit={2} 
                onSelectConversation={handleSelect} 
                showMoreLink={true} 
                currentUser={currentUser}
                onShowUserPopover={(user, pos, groupData) => showUserPopover(user, pos, groupData)}   
              />
              <hr className="my-2 w-3/4 mx-auto border-y border-gray-300 dark:border-[#1C6B1C]" />
            </div>
          )}

          {/* Midten: ConversationList som eneste som vokser */}
          <div className="flex-1 min-h-0">
            {searchQuery.trim() && (
              <div className="px-2 py-1">
                {searchLoading ? (
                  <Spinner size={24} borderSize={3} text="Laster søkeresultater..." />
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2 text-center">No conversations found.</p>
                ) : null}
              </div>
            )}
            <ConversationList
              conversations={searchQuery.trim() ? searchResults : undefined}
              selectedId={currentConversationId}
              onSelect={handleSelect}
              currentUser={currentUser}
              onShowUserPopover={(user, pos, groupData) => showUserPopover(user, pos, groupData)}
              onLeaveGroup={handleLeaveGroup} // ✅ Send handleLeaveGroup som prop
            />
          </div>

           <div className="shrink-0 px-2 mt-3">
              <input
                type="text"
                className="w-full max-w-[250px] px-3 py-1 border border-[#1C6B1C] rounded text-sm focus:outline-none" 
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

          {/* Bunn: Fast knapp */}
          <div className="shrink-0 p-4 mb-4">
            <ProfileNavButton
              text="✚"
              variant="iconOnly"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = rect.right - 400;
                const y = rect.bottom + 10;
                showModal(<NewMessageModal />, { blurBackground: false, position: { x, y } });
              }}
            />
          </div>
        </div>


        {/* Høyre kolonne */}
        <div className="flex-1 flex flex-col h-full">
          {conversationVisible && currentConversationId ? (
            <div className="flex-1 flex flex-col h-full">
              {currentConversation?.isPendingApproval && currentConversationId !== pendingLockedConversationId && (
                <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                  Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
                </div>
              )}

              {pending.some((r) => r.conversationId === currentConversationId) &&
                currentConversationId === pendingLockedConversationId && (
                  <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                    Approve the conversation to start sending messages.
                  </div>
              )}

              <div className="flex-1 min-h-0 overflow-auto">
                <MessageList
                  key={`${currentConversationId}-${conversationVisible}`}
                  currentUser={currentUser}
                  onShowUserPopover={showUserPopover}
                  conversationVisible={conversationVisible}
                  onScrollPositionChange={setAtBottom}
                />
              </div>

              <div className="shrink-0 mt-2 mb-10">
                <MessageInput
                  receiverId={undefined}
                  onMessageSent={(message) => {
                    console.log("Ny melding sendt:", message);
                  }}
                  atBottom={atBottom} // ✅ send videre
                  onShowUserPopover={(user, pos, groupData) => showUserPopover(user, pos, groupData)}
                  onLeaveGroup={handleLeaveGroup}
                  userPopoverRef={userPopoverRef} 
                />
              </div>
            </div>
          ) : (
              <div className="flex-1 flex flex-col h-full pb-10 pr-2">
              <NotificationsPanel onOpenConversation={openConversationFromNotification} />
                </div>
          )}
        </div>
        
      </div>
      {popoverUser && popoverPosition && openUserPopoverId === popoverUser.id && (
        <UserActionPopover
          mode="dropdown"
          user={popoverUser}
          dropdownRef={dropdownRef}
          onCloseDropdown={onCloseDropdown}
          setUserPopoverRef={setUserPopoverRef}
          openUserPopoverId={openUserPopoverId}
          toggleUserPopover={toggleUserPopover}
          avatarSize={120}
          position={popoverPosition}
          // ✅ Pass gruppedata hvis det finnes
          isGroup={popoverGroupData?.isGroup || false}
          participants={popoverGroupData?.participants || []}
          onLeaveGroup={popoverGroupData?.onLeaveGroup}
          isPendingRequest={popoverGroupData?.isPendingRequest || false}
          conversationId={popoverGroupData?.conversationId}
        />
      )}
    </div>
  );
}