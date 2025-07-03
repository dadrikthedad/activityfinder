// components/common/PreviewModal.tsx
"use client";

import { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Header props
  title: string;
  subtitle?: string;
  icon?: string;
  
  // Action buttons
  showDownload?: boolean;
  showOpenInNewTab?: boolean;
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
  
  // Gallery navigation
  hasGallery?: boolean;
  currentIndex?: number;
  totalItems?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onGoToIndex?: (index: number) => void;
  
  // Content
  children: ReactNode;
  
  // Thumbnails (optional)
  thumbnails?: ReactNode;
  
  // Custom keyboard handling
  onKeyDown?: (e: KeyboardEvent) => void;
}

export const PreviewModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon = "📄",
  showDownload = false,
  showOpenInNewTab = false,
  onDownload,
  onOpenInNewTab,
  hasGallery = false,
  currentIndex = 0,
  totalItems = 0,
  onNext,
  onPrevious,
  onGoToIndex,
  children,
  thumbnails,
  onKeyDown
}: PreviewModalProps) => {
  const overlay = useOverlay();

  // Sync overlay state
  useEffect(() => {
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close]);

  useOverlayAutoClose(() => {
    onClose();
  }, overlay.level ?? undefined);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Custom keyboard handler first
      if (onKeyDown) {
        onKeyDown(e);
        return;
      }

      // Default keyboard handling
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case 'ArrowLeft':
          if (hasGallery && onPrevious) {
            e.preventDefault();
            e.stopPropagation();
            onPrevious();
          }
          break;
        case 'ArrowRight':
          if (hasGallery && onNext) {
            e.preventDefault();
            e.stopPropagation();
            onNext();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (hasGallery && onGoToIndex) {
            const index = parseInt(e.key) - 1;
            if (index < totalItems) {
              e.preventDefault();
              e.stopPropagation();
              onGoToIndex(index);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, hasGallery, onNext, onPrevious, onGoToIndex, totalItems, onClose, onKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: overlay.zIndex,
        pointerEvents: 'auto'
      }}
    >
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/80 cursor-pointer"
        onClick={onClose}
        aria-hidden="true" 
      />
      
      {/* Modal content */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={overlay.ref}
          className="bg-white dark:bg-[#1e2122] rounded-lg max-w-6xl max-h-[95vh] w-full h-auto overflow-hidden pointer-events-auto shadow-2xl relative border-2 border-[#1C6B1C]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          {/* Gallery navigation arrows - outside content area */}
          {hasGallery && totalItems > 1 && (
            <>
              <button
                onClick={onPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                aria-label="Previous item"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={onNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                aria-label="Next item"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {title}
                  {/* Gallery counter */}
                  {hasGallery && totalItems > 1 && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({currentIndex + 1} of {totalItems})
                    </span>
                  )}
                </h3>
                {subtitle && (
                  <p className="text-sm text-gray-500">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {showOpenInNewTab && onOpenInNewTab && (
                <button
                  onClick={onOpenInNewTab}
                  className="px-3 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors text-sm"
                >
                  Open in new tab
                </button>
              )}
              {showDownload && onDownload && (
                <button
                  onClick={onDownload}
                  className="px-3 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors text-sm"
                >
                  Download
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>

          {/* Content */}
          <div 
            className="overflow-auto custom-scrollbar" 
            style={{ 
              maxHeight: thumbnails 
                ? 'calc(95vh - 120px)' 
                : 'calc(95vh - 80px)' 
            }}
          >
            {children}
          </div>

          {/* Thumbnails */}
          {thumbnails && (
            <div className="p-4">
              {thumbnails}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};