// Listen med meldinger som vises i MessageDropdownen. Vi har med paginerering, og kontroll på scrollbaren, samt en knapp som kjører oss til bunn ved ny melding hvis ønskelig
"use client";

import { usePaginatedMessages } from "@/hooks/messages/getMessagesForConversation";
import { useEffect, useRef, useMemo, useState } from "react";
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
    // venter på samtalebytte
    const [initializingConversation, setInitializingConversation] = useState(false);

    useEffect(() => {
        activeConversationRef.current = conversationId;
      }, [conversationId, messages.length]);

    // Ved første last
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
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()); // Merk: nyeste først!
}, [messages, liveMessages]);

    // Her sikrer vi at New Message Button bare kommer ved ny melding, og ikke samtalebytte eller paginering

        useEffect(() => {
      if (initializingConversation || liveMessages.length === 0) return;

      const latest = liveMessages.at(-1);
      if (!latest || latest.id === lastLiveMessageId.current) return;

      lastLiveMessageId.current = latest.id;

      // Vis kun knapp hvis vi IKKE er i visuell bunn (dvs. DOM-toppen)
      if (!isBottomVisible.current) {
        setShowNewMessageButton(true);
      }
    }, [liveMessages, initializingConversation]);


  // Scroll til bunn (visuelt) når vi bytter samtale
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;

      setInitializingConversation(true);

      requestAnimationFrame(() => {
        container.scrollTop = 0;
        setShowNewMessageButton(false);

        // delay for å sikre at observer får ny posisjon
        setTimeout(() => {
          setInitializingConversation(false);
        }, 50);
      });
    }, [conversationId]);



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
  

    // Dette sikrer at scrollingen fungerer perfekt med pagineringen. Har kontroll på hvor scrollbaren er og lar oss ikke laste inn for mye om gangen
    // Paginering ved scroll nær "visuell topp" med flex-col-reverse
      useEffect(() => {
        const container = scrollRef.current;
        const topEl = topRef.current;
        if (!container || !topEl || !hasMore || loading) return;

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

  return (
    <div
  ref={scrollRef}
  className="flex flex-col-reverse overflow-y-auto pr-2 rounded-lg p-4"
>

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
      <div ref={bottomRef} />
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
        <div ref={topRef} className="h-1" />
  
      
    </div>
  );
}