"use client"

import { useEffect, useRef } from "react";
import { MessageDTO } from "@/types/MessageDTO";
import UserActionPopover from "../common/UserActionPopover";
import MiniAvatar from "../common/MiniAvatar";

interface Props {
    messages: MessageDTO[];
    currentUserId: number | undefined;
    userAvatar?: string | null;
    isCompact?: boolean;
  }
  
  
export default function MessageList({ messages, currentUserId, userAvatar, isCompact }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const el = containerRef.current;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}, [messages]);


  return (
    <div
    ref={containerRef}
        className={`${
            isCompact
            ? "max-h-full p-4"
            : "max-h-[70vh] p-6 border border-[#1C6B1C] rounded-xl shadow-md"
        } bg-white dark:bg-[#1e2122] overflow-y-auto space-y-6`}
>
      {messages.map((msg) => {
        const isOwnMessage = msg.senderId === currentUserId;

        return (
          <div
            key={msg.id}
            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex items-start gap-3 max-w-[80%] ${
                isOwnMessage ? "flex-row-reverse text-right" : "flex-row"
              }`}
            >
              {/* Avatar */}
              {isOwnMessage ? (
                userAvatar && <MiniAvatar imageUrl={userAvatar} size={40} />
              ) : (
                msg.sender && <UserActionPopover user={msg.sender} avatarSize={40} />
              )}

              {/* Meldingsinnhold */}
              <div>
                <p className="text-sm font-semibold text-[#1C6B1C] mb-1">
                  {isOwnMessage ? "You said:" : `${msg.sender?.fullName} says:`}
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                  {msg.text || <i>(Tom melding)</i>}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(msg.sentAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
  