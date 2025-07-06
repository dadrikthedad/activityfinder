"use client";
import React, { useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface EmojiPickerWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
  className?: string;
}

export const EmojiPickerWrapper: React.FC<EmojiPickerWrapperProps> = ({
  isOpen,
  onClose,
  onEmojiSelect,
  position = 'bottom-right',
  className = ''
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onClose();
  };

  if (!isOpen) return null;

  // Position styles
  const getPositionStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      zIndex: 1000,
    };

    switch (position) {
      case 'bottom-right':
        return {
          ...baseStyles,
          bottom: '100%',
          right: '0',
          marginBottom: '8px'
        };
      case 'top-right':
        return {
          ...baseStyles,
          top: '100%',
          right: '0',
          marginTop: '8px'
        };
      case 'bottom-left':
        return {
          ...baseStyles,
          bottom: '100%',
          left: '0',
          marginBottom: '8px'
        };
      case 'top-left':
        return {
          ...baseStyles,
          top: '100%',
          left: '0',
          marginTop: '8px'
        };
      default:
        return baseStyles;
    }
  };

  return (
    <div
      ref={pickerRef}
      style={getPositionStyles()}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        width={350}
        height={400}
        previewConfig={{ showPreview: false }}
        searchDisabled={false}
        skinTonesDisabled={false}
        lazyLoadEmojis={true}
        theme={Theme.AUTO}
        style={{
          '--epr-bg-color': '#1e2122',
          '--epr-category-label-bg-color': '#334155',
          '--epr-search-input-bg-color': '#334155',
          '--epr-search-input-color': '#ffffff',
          '--epr-highlight-color': '#1C6B1C',
          '--epr-hover-bg-color': '#1C6B1C',
          '--epr-focus-bg-color': '#1C6B1C',
          '--epr-text-color': '#ffffff',
          '--epr-category-navigation-button-color': '#94a3b8',
          '--epr-category-navigation-button-color-active': '#1C6B1C',
          '--epr-category-navigation-button-color-hover': '#1C6B1C',
          border: '2px solid #1C6B1C',
          borderRadius: '12px',
        } as React.CSSProperties}
      />
    </div>
  );
};