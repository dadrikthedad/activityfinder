// hooks/useEmojiInput.ts
import { useState } from 'react';

interface UseEmojiInputReturn {
  showEmojiPicker: boolean;
  toggleEmojiPicker: () => void;
  closeEmojiPicker: () => void;
  insertEmoji: (emoji: string, text: string, setText: (text: string) => void, inputRef: React.RefObject<HTMLTextAreaElement>) => void;
}

export const useEmojiInput = (): UseEmojiInputReturn => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const closeEmojiPicker = () => {
    setShowEmojiPicker(false);
  };

  const insertEmoji = (
    emoji: string, 
    text: string, 
    setText: (text: string) => void, 
    inputRef: React.RefObject<HTMLTextAreaElement>
  ) => {
    const textArea = inputRef.current;
    
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      
      // Restore cursor position after emoji
      setTimeout(() => {
        textArea.selectionStart = textArea.selectionEnd = start + emoji.length;
        textArea.focus();
      }, 0);
    } else {
      setText(text + emoji);
    }
  };

  return {
    showEmojiPicker,
    toggleEmojiPicker,
    closeEmojiPicker,
    insertEmoji
  };
};