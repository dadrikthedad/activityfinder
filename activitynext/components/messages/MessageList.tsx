// Listen med meldinger som vises i MessageDropdownen. Vi har med paginerering, og kontroll på scrollbaren, samt en knapp som kjører oss til bunn ved ny melding hvis ønskelig
"use client";

import { usePaginatedMessages } from "@/hooks/messages/getMessagesForConversation";
import { useEffect, useRef, useMemo, useState, useLayoutEffect } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore"; // Bruker useChatStore til å lagre og hente meldinger
import { MessageDTO } from "@/types/MessageDTO"; // Hvordan en melding ser ut
import MiniAvatar from "../common/MiniAvatar";
import UserActionPopover from "../common/UserActionPopover";
import { formatSentDate } from "@/utils/date/chatDate";

interface MessageListProps {
    conversationId: number;
    currentUser: UserSummaryDTO | null;
  }
// conversationId henter vi fra MessageDropdown slik at vi har kontroll på hvem samtale vi er i og currentUser ER IKKE I BRUK ENDA TODO
export default function MessageList({ conversationId, currentUser }: MessageListProps) { 
    const {
        messagesByConversation,
        setScrollPosition,
        getScrollPosition,
        setMessagesForConversation,
      } = useChatStore();

    const cached = messagesByConversation[conversationId] || [];
    const shouldFetch = cached.length === 0;
    const { messages, loadMore, loading, hasMore } = usePaginatedMessages(conversationId);     // Her her vi kontroll på meldinger som lastes inn og kommer i sanntid over signalr
    

    const liveMessages = useMemo(() => {
        return messagesByConversation[conversationId] || [];
      }, [messagesByConversation, conversationId]);

    
    // Disse under er for kontroll på hvor vi er i scrollingen
    const scrollRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const isFetching = useRef(false);
    const isBottomVisible = useRef(true);
    const lastLiveMessageId = useRef<number | null>(null);
    // Sporer samtaler når vi bytter samtaler
    const activeConversationRef = useRef<number>(conversationId);

    useEffect(() => {
        activeConversationRef.current = conversationId;
      }, [conversationId, messages.length]);

    // Ved første last
    const [initialLoad, setInitialLoad] = useState(true);
    const [showNewMessageButton, setShowNewMessageButton] = useState(false);

    const combinedMessages = useMemo(() => { 
        const all = [...messages, ...liveMessages];
        const seen = new Set();
        return all
        .filter((msg) => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
        })
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    }, [messages, liveMessages]);

      // Lagre inn i cache etter første henting
      useEffect(() => {
        const alreadyCached = messagesByConversation[conversationId]?.length > 0;
        let cancelled = false;
      
        const timeout = setTimeout(() => {
          if (
            !cancelled &&
            messages.length > 0 &&
            shouldFetch &&
            !alreadyCached &&
            activeConversationRef.current === conversationId
          ) {
            console.log(`[Cache] Lagrer ${messages.length} meldinger for samtale ${conversationId}`);
            setMessagesForConversation(conversationId, messages);
          } else {
            console.log(`[Cache] Hopper over lagring for samtale ${conversationId}`, {
              messagesLength: messages.length,
              shouldFetch,
              alreadyCached,
              isCurrent: activeConversationRef.current === conversationId,
              cancelled,
            });
          }
        }, 100);
      
        return () => {
          cancelled = true;
          clearTimeout(timeout);
          console.log(`[Cache] Avbrøt lagring for samtale ${conversationId} ved samtalebytte`);
        };
      }, [messages, shouldFetch, conversationId, setMessagesForConversation, messagesByConversation]);
  
    // Scroll til bunn etter første lasting
    useLayoutEffect(() => {
        if (initialLoad && combinedMessages.length > 0) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
        setInitialLoad(false);
        }
    }, [combinedMessages, initialLoad]);

    // Lagrer scrollposisjonen vår ved samtalebytte
    useEffect(() => {
        return () => {
          const container = scrollRef.current;
          if (container) {
            setScrollPosition(conversationId, container.scrollTop);
          }
        };
      }, [conversationId, setScrollPosition]);

      // Henter hvor vi var i samtalen ved samtalebytte
      useLayoutEffect(() => {
        const saved = getScrollPosition(conversationId);
        if (scrollRef.current && saved != null) {
          scrollRef.current.scrollTop = saved;
          setInitialLoad(false); // Unngå autoscroll til bunn
        }
      }, [conversationId, getScrollPosition]);

  // Dette sikrer at scrollingen fungerer perfekt med pagineringen. Har kontroll på hvor scrollbaren er og lar oss ikke laste inn for mye om gangen
    // Paginering ved scroll nær toppen
    useEffect(() => {
        const container = scrollRef.current;
        if (!container || !hasMore || loading) return;
      
        const handleScroll = () => {
          if (container.scrollTop <= 100 && !isFetching.current) {
            isFetching.current = true;
            const prevHeight = container.scrollHeight;
      
            loadMore().finally(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const newHeight = container.scrollHeight;
                  const delta = newHeight - prevHeight;
      
                  // Juster scroll selv om delta er 0 for å unngå at observer trigger igjen
                  container.scrollTop += delta > 0 ? delta : 1;
      
                  setTimeout(() => {
                    isFetching.current = false;
                  }, 150); // debounce-tid
                });
              });
            });
          }
        };
      
        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
      }, [loadMore, hasMore, loading]);

    // Gjør at knappen som viser ny melding hvis man har scrollet opp forsvinner
    // Observer bunn for ny melding-knapp
    useEffect(() => {
        const container = scrollRef.current;
        const observer = new IntersectionObserver(
        ([entry]) => {
            isBottomVisible.current = entry.isIntersecting;
            if (entry.isIntersecting) setShowNewMessageButton(false);
        },
        { root: container, threshold: 1.0 }
        );

        if (bottomRef.current) observer.observe(bottomRef.current);
        return () => observer.disconnect();
    }, []);

    // Her sikrer vi at New Message Button bare kommer ved ny melding, og ikke samtalebytte eller paginering
    // Vis knapp for ny melding hvis ikke nederst
    useEffect(() => {
        if (liveMessages.length === 0) return;
    
        const latest = liveMessages.at(-1);
        if (!latest || latest.id === lastLiveMessageId.current) return;
    
        lastLiveMessageId.current = latest.id;
    
        if (!isBottomVisible.current) {
          setShowNewMessageButton(true);
        }
      }, [liveMessages]);

  return (
    <div
  ref={scrollRef}
  className="flex-1 overflow-y-auto pr-2 rounded-lg p-4"
>
      <div ref={topRef} className="h-1"/>
      {combinedMessages.map((msg: MessageDTO) => {
        const isMine = currentUser?.id === msg.sender?.id;
  
        return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
                className={`p-2 max-w-[250] break-words whitespace-pre-wrap overflow-hidden ${
                    isMine ? "text-right ml-auto" : "text-left"
                }`}
                >
              {/* Topptekst: Avsender */}
              <div className={`flex items-center gap-2 mb-2 ${isMine ? "justify-end" : ""}`}>
                {!isMine && msg.sender ? (
                    <UserActionPopover user={msg.sender} avatarSize={30} />
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
              <div className="text-sm mb-2 whitespace-pre-line">{msg.text}</div>
          
              {/* Vedlegg og tidspunkt */}
              {msg.attachments?.length > 0 && (
                <div className="text-xs text-gray-400 mb-1">📎 {msg.attachments.length} attachment(s)</div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
  
      {showNewMessageButton && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={() => {
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              setShowNewMessageButton(false);
            }}
            className="bg-[#1C6B1C] text-white px-4 py-2 rounded shadow hover:bg-[#145214] transition"
          >
            Se ny melding
          </button>
        </div>
      )}
    </div>
  );
}