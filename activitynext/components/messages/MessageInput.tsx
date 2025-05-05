// Input-feltet til ChatPage og ChatDropdown. Er text-area for å utvide seg
"use client";

import React, { useRef, RefObject, useEffect } from "react";
import SimpleTextButton from "../common/SimpleTextButton";
import { ArrowLeft } from "lucide-react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  disabled?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement>; // Endret til textarea-ref
  isMobile?: boolean; 
  onBack?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  inputRef,
  isMobile,
  onBack
}) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const refToUse = inputRef ?? internalRef;

  // Håndterer automatisk høyde
  useEffect(() => {
    const el = refToUse.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value, refToUse]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex gap-2 items-end mt-4">
        {isMobile && onBack && (
      <SimpleTextButton
        text=""
        onClick={onBack}
        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
      >
        <ArrowLeft className="w-4 h-4" />
      </SimpleTextButton>
    )}
      <textarea
        ref={refToUse}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Skriv en melding..."
        rows={1}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[300px]"
      />
      <button
        onClick={onSend}
        disabled={loading || !value.trim() || disabled}
        className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
};

export default MessageInput;
