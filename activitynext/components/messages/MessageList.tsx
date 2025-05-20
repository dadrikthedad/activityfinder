// Listen med meldinger som vises i MessageDropdownen, viser både samtaler mde og uten godkjente meldingsforespørsler. 
// Vi har med paginerering, og kontroll på scrollbaren, samt en knapp som kjører oss til bunn ved ny melding hvis ønskelig
"use client";

import { usePaginatedMessages } from "@/hooks/messages/getMessagesForConversation";
import { useEffect, useRef, useMemo, useState } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore"; // Bruker useChatStore til å lagre og hente meldinger
import MiniAvatar from "../common/MiniAvatar";
import { formatSentDate } from "@/utils/date/chatDate";
import { ReactionHandler } from "../reactions/ReactionHandler";
import { groupReactionsDetailed } from "@/utils/messages/emoji";
import { addReaction } from "@/services/messages/reactionService";
import { useSearchMessages } from "@/hooks/messages/useSearchMessages";
import { debounce } from "lodash";
import Spinner from "../common/Spinner";



interface MessageListProps {
    currentUser: UserSummaryDTO | null;
    onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
    conversationVisible: boolean;
    onScrollPositionChange?: (atBottom: boolean) => void; // Sier ifra når vi ikke er i bunn

  }
// conversationId henter vi fra MessageDropdown slik at vi har kontroll på hvem samtale vi er i og currentUser brukes til å se egent bilde
export default function MessageList({ 
  currentUser,  
  onShowUserPopover,
  conversationVisible,
  onScrollPositionChange,
}: MessageListProps) { 
    const { liveMessages } = useChatStore(); // Hvis melding kommer inn fra signalr
    const rawConversationId = useChatStore((state) => state.currentConversationId);
    const conversationId = rawConversationId ?? -1;
    

    const {
      messages,
      loadMore,
      loading,
      hasMore,
    } = usePaginatedMessages(conversationId, conversationVisible);     // Her her vi kontroll på meldinger som lastes inn og kommer i sanntid over signalr

    console.log("📥 Rendering messages for", conversationId, messages.length);

    const scrollPosition = useRef<number>(0); // Lagre midltertid
    const { scrollPositions } = useChatStore(); // hentet ved ny mount
    const { setScrollPosition } = useChatStore();
    
    const live = useMemo(() => {
      return liveMessages[conversationId] || [];
    }, [liveMessages, conversationId]);

    // Tøm live-meldinger for forrige samtale
  
    
    // Disse under er for kontroll på hvor vi er i scrollingen
    const scrollRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const isFetching = useRef(false);
    const isBottomVisible = useRef(true);
    const lastLiveMessageId = useRef<number | null>(null);
    // Sporer samtaler når vi bytter samtaler
    const activeConversationRef = useRef<number>(conversationId);
    // venter på samtalebytte
    const [initializingConversation, setInitializingConversation] = useState(false);
      // Id for å skille mellom sist hentete meldinger
    const lastFetchedId = useRef<number | null>(null);

    

    useEffect(() => {
        activeConversationRef.current = conversationId;
      }, [conversationId, messages.length]);

    // Ved første last
    const [showNewMessageButton, setShowNewMessageButton] = useState(false);

    // For søkefeltet
      const [query, setQuery] = useState("");
      const { search, resetSearch, loading: searchLoading } = useSearchMessages();
      const searchResults = useChatStore((s) => s.searchResults);
      const isSearching = useChatStore((s) => s.searchMode);
    
    const displayedMessages = useMemo(() => {
      if (isSearching) return searchResults;
      const all = [...messages, ...live];
      const seen = new Set();
      console.log("📦 All messages to render", all);
      return all
        .filter((msg) => {
          if (seen.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
        })
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    }, [messages, live, isSearching, searchResults]);
    // Her sikrer vi at New Message Button bare kommer ved ny melding, og ikke samtalebytte eller paginering

      useEffect(() => {
        if (initializingConversation || live.length === 0) return;

        const latest = live.at(-1);
        if (!latest || latest.id === lastLiveMessageId.current) return;

        lastLiveMessageId.current = latest.id;

        // Fjern kravet om lastFetchedId for å håndtere første melding
        if (!isBottomVisible.current) {
          setShowNewMessageButton(true);
        }
      }, [liveMessages, initializingConversation, live]);
    
  // Scroll til bunn (visuelt) når vi bytter samtale og Gjenopprett scrollposisjon (flex-col-reverse)
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;

      if (!conversationVisible || displayedMessages.length === 0 || isSearching) return;

      // 🔒 Hvis meldinger nylig er lagt til via SignalR, ikke gjør noe – da har vi allerede riktig scroll
      if (live.length > 0) return;

      setInitializingConversation(true);

      requestAnimationFrame(() => {
        const saved = scrollPositions[conversationId] ?? 0;
        container.scrollTop = saved;

        lastFetchedId.current = displayedMessages.at(0)?.id ?? null;

        // 🛑 Ikke nullstill ny melding-knappen her – det gjøres i andre effekter
        // setShowNewMessageButton(false);

        setTimeout(() => {
          setInitializingConversation(false);
        }, 50);
      });
    }, [conversationId, conversationVisible, displayedMessages.length]);
    
    
  

    // Dette sikrer at scrollingen fungerer perfekt med pagineringen. Har kontroll på hvor scrollbaren er og lar oss ikke laste inn for mye om gangen
    // Paginering ved scroll nær "visuell topp" med flex-col-reverse
      useEffect(() => {
        const container = scrollRef.current;
        const topEl = topRef.current;
        if (!container || !topEl || !hasMore || loading || isSearching) return;

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && !isFetching.current) {
              console.log("[Paginate] Top is visible — fetching older messages.");
              isFetching.current = true;
              loadMore().finally(() => {
                isFetching.current = false;
              });
            }
          },
          {
            root: container,
            threshold: 1.0,
          }
        );

        observer.observe(topEl);
        return () => observer.disconnect();
      }, [loadMore, hasMore, loading]);


    // Gjør at knappen som viser ny melding hvis man har scrollet opp forsvinner
    useEffect(() => {
        const container = scrollRef.current;
        const observer = new IntersectionObserver(
          ([entry]) => {
              const isAtBottom = entry.isIntersecting;
              isBottomVisible.current = isAtBottom;

              // Informer parent
            if (onScrollPositionChange) {
              onScrollPositionChange(isAtBottom);
            }

            if (isAtBottom) {
              // 👉 forsink skjuling for å unngå "blink"
              setTimeout(() => {
                setShowNewMessageButton(false);
              }, 200); // du kan justere f.eks. til 300ms
            }
          },
          { root: container, threshold: 1.0 }
        );

        if (bottomRef.current) observer.observe(bottomRef.current);
        return () => observer.disconnect();
      }, [onScrollPositionChange]);

    // Lagre scrollposisjon når komponenten unmountes (dropdown lukkes)
        
      useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const handleScroll = () => {
          const pos = container.scrollTop; // i flex-col-reverse, scrollTop øker når du går NED
          setScrollPosition(conversationId, pos);
          console.log(`[Scroll] Lagret scrollposisjon (flex-reverse): ${pos}`); //Hvis vi trenger å logge hva scrollposisjonen er
        };

        if (!isSearching) {
          container.addEventListener("scroll", handleScroll);
        }
        return () => container.removeEventListener("scroll", handleScroll);
      }, [conversationId, setScrollPosition, isSearching ]);

       

      // For å se hvor scrollen er og lagre den til å hente fram ved åpning av chat
      const handleScroll = () => {
        if (scrollRef.current) {
          scrollPosition.current = scrollRef.current.scrollTop;
          console.log(`[Scroll] Oppdatert scrollposisjon: ${scrollRef.current.scrollTop}`); // Hvis vi trenger å vite hva scrollposisjonen er
        }
      };

      console.log("🧪 Rendering MessageList", {
        conversationId,
        messagesInView: liveMessages[conversationId],
      });
      
      

      const debouncedSearch = useMemo(() => {
        return debounce((convId: number, q: string) => {
          resetSearch();
          search(convId, q);
        }, 300);
      }, [resetSearch, search]);

      // Søk når query oppdateres
      useEffect(() => {
        if (query.length < 1) {
          resetSearch();
          return;
        }

        debouncedSearch(conversationId, query);
      }, [query, conversationId]);

      if (rawConversationId === null) {
        return <div className="text-center text-gray-500">No conversation chosen</div>;
      }

  return (
          <div className="flex flex-col h-full">
            {isSearching && (
              <div className="flex items-center gap-2 p-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
                <button
                  onClick={() => {
                    resetSearch();
                    setQuery("");
                    useChatStore.getState().setSearchMode(false);
                  }}
                  className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            )}
            {isSearching && query.length >= 1 && (
              <div className="px-2 pb-1 text-xs text-gray-500">
                {searchResults.length} message{searchResults.length === 1 ? "" : "s"} found
              </div>
            )}{isSearching && searchLoading && (
              <div className="flex justify-center p-4">
                <Spinner size={24} borderSize={3} text="Searching..." />
              </div>
            )}
    <div
      ref={scrollRef} onScroll={handleScroll} data-message-scroll-container 
      className="flex flex-col-reverse overflow-y-auto pr-2 rounded-lg p-4 custom-scrollbar h-full"
      >
      {showNewMessageButton && (
        <div className="sticky bottom-4 flex justify-start pointer-events-auto">
          <div className="bg-[#1C6B1C]/30 text-white/30 px-6 py-2 rounded shadow text-sm backdrop-blur-sm flex items-center gap-2">
            <span>New messages. Press the downward-arrow button</span>
            <button
              onClick={() => setShowNewMessageButton(false)}
              className="text-white/30 text-xs hover:text-gray-300 px-2"
            >
              X
            </button>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    {!searchLoading && displayedMessages.map((msg) => {
        const isMine = currentUser?.id === msg.sender?.id;
  
        return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <ReactionHandler targetId={msg.id} userId={currentUser?.id ?? -1}  existingReactions={msg.reactions}>
            <div
                className={`p-2 w-full break-words whitespace-pre-wrap overflow-visible ${
                    isMine ? "text-right ml-auto" : "text-left"
                }`}
                >
              {/* Topptekst: Avsender */}
              <div className={`flex items-center gap-2 mb-2 ${isMine ? "justify-end" : ""}`}>
                {!isMine && msg.sender ? (
                     <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const pos = {
                        x: rect.left + window.scrollX,
                        y: rect.bottom + window.scrollY,
                      };
                      onShowUserPopover(msg.sender!, pos);
                    }}
                    className="flex-shrink-0"
                  >
                    <MiniAvatar
                      imageUrl={msg.sender.profileImageUrl ?? "/default-avatar.png"}
                      size={30}
                    />
                  </button>
                ) : !isMine ? (
                    <MiniAvatar imageUrl="/default-avatar.png" size={30} />
                ) : null}

                <span className={`text-sm font-medium ${isMine ? "italic text-[#1C6B1C]" : ""}`}>
                    {isMine
                    ? ""
                    : msg.sender?.fullName ?? <span className="italic text-gray-400">(Ukjent bruker)</span>}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                {formatSentDate(msg.sentAt)}
                </p>

                {isMine && (
                    <MiniAvatar imageUrl={currentUser?.profileImageUrl ?? "/default-avatar.png"} size={30} />
                )}
                </div>
          
              {/* Innhold */}
              {msg.parentMessageText && (
                <div className="text-xs italic text-gray-500 mb-2">↳ {msg.parentMessageText}</div>
              )}
              {msg.text?.trim() && (
                <div className="text-sm mb-2 break-words break-all whitespace-pre-line">{msg.text}</div>
              )}

              {msg.reactions?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1 text-sm">
                  {Object.entries(groupReactionsDetailed(msg.reactions)).map(([emoji, { count, userIds, userNames }]) => {
                    const userHasReacted = userIds.includes(currentUser?.id ?? -1);

                    return (
                      <div
                        key={emoji}
                        title={`Reagert av: ${userNames.join(", ")}`} // 👈 Tooltip med navneliste
                        className="bg-gray-700 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-600 transition"
                        onClick={() => {
                          if (userHasReacted) {
                            addReaction({ messageId: msg.id, emoji }); // toggle-fjerning
                          }
                        }}
                      >
                        <span>{emoji}</span>
                        <span>x{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
          
              {/* Vedlegg og tidspunkt */}
              {msg.attachments?.length > 0 && (
                <div className="text-xs text-gray-400 mb-1">📎 {msg.attachments.length} attachment(s)</div>
              )}
            </div>
            </ReactionHandler>
          </div>
        );
      })}
        <div ref={topRef} />
          </div>
  
      
    </div>
  );
}