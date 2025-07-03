"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import Image from "next/image";

interface ImageGalleryItem {
  src: string;
  alt?: string;
  fileName?: string;
}

interface EnlargeableImageProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  useOverlaySystem?: boolean;
  // 🆕 Gallery props
  gallery?: ImageGalleryItem[];
  initialIndex?: number;
}

export default function EnlargeableImage({
  src,
  alt = "Profile image",
  size = 80,
  className = "",
  useOverlaySystem = true,
  gallery = [],
  initialIndex = 0
}: EnlargeableImageProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const overlay = useOverlay();

  // Determine if we're in gallery mode
  const isGalleryMode = gallery.length > 0;
  const currentImage = isGalleryMode ? gallery[currentIndex] : { src, alt };
  const hasMultiple = gallery.length > 1;

  // Navigation functions
  const goToNext = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev + 1) % gallery.length);
  }, [hasMultiple, gallery.length]);

  const goToPrevious = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  }, [hasMultiple, gallery.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < gallery.length) {
      setCurrentIndex(index);
    }
  }, [gallery.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 🔧 Only handle events when the modal is actually open and focused
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation(); // 🆕 Prevent bubbling
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation(); // 🆕 Prevent bubbling
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation(); // 🆕 Prevent bubbling to parent
          handleClose();
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
          const index = parseInt(e.key) - 1;
          if (index < gallery.length) {
            e.preventDefault();
            e.stopPropagation(); // 🆕 Prevent bubbling
            goToIndex(index);
          }
          break;
      }
    };

    // 🔧 Add event listener with capture: true to catch events early
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, hasMultiple, goToPrevious, goToNext, goToIndex, gallery.length]);

  // Sync overlay state
  useEffect(() => {
    if (!useOverlaySystem) return;
    
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close, useOverlaySystem]);

  useOverlayAutoClose(() => {
    setIsOpen(false);
  }, overlay.level ?? undefined);

  const handleOpen = useCallback(() => {
    // If gallery mode, find the index of current src
    if (isGalleryMode) {
      const index = gallery.findIndex(item => item.src === src);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
    
    setIsOpen(true);
    
    if (useOverlaySystem) {
      setTimeout(() => {
        overlay.open();
      }, 0);
    }
  }, [useOverlaySystem, overlay, isGalleryMode, gallery, src]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (useOverlaySystem && !isOpen && overlay.level !== null) {
      overlay.close();
    }
  }, [isOpen, useOverlaySystem, overlay]);

  return (
    <>
      {/* Clickable thumbnail image */}
      <div
        onClick={handleOpen}
        className={`cursor-pointer rounded-full border-1 border-[#1C6B1C] shadow-md overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-cover w-full h-full rounded-full"
        />
      </div>
     
      {/* Enlarged image modal */}
      {isOpen && createPortal(
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
            className="fixed inset-0 bg-black/90 cursor-pointer"
            onClick={handleClose}
            aria-hidden="true" 
          />
          
          {/* Centered modal content */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={overlay.ref}
              className="bg-white dark:bg-zinc-900 p-6 rounded-lg max-w-[90vw] max-h-[90vh] w-auto h-auto text-center overflow-auto pointer-events-auto shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }
              }}
              tabIndex={-1}
              style={{ outline: 'none' }}
            >
              {/* 🆕 Gallery navigation arrows - inside modal */}
              {hasMultiple && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPrevious();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10"
                    aria-label="Previous image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10"
                    aria-label="Next image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Gallery counter */}
              {hasMultiple && (
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {currentIndex + 1} of {gallery.length}
                </div>
              )}

              <Image
                src={currentImage.src}
                alt={currentImage.alt || `Image ${currentIndex + 1}`}
                width={1000}
                height={1000}
                className="rounded-xl mx-auto object-contain max-w-full max-h-[70vh]"
              />
              
              {/* Image filename if available */}
              {currentImage.fileName && (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {currentImage.fileName}
                </div>
              )}

              {/* Thumbnail navigation for galleries */}
              {hasMultiple && gallery.length <= 10 && (
                <div className="mt-4 flex justify-center gap-2 flex-wrap">
                  {gallery.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => goToIndex(index)}
                      className={`w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                        index === currentIndex 
                          ? 'border-blue-500 ring-2 ring-blue-300' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={item.src}
                        alt={item.alt || `Thumbnail ${index + 1}`}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => window.open(currentImage.src, '_blank')}
                  className="px-6 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors"
                >
                  Open in New Tab
                </button>
              </div>
              
              {/* Keyboard shortcuts help */}
              {hasMultiple && (
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Use ← → arrow keys or click arrows to navigate • Press 1-9 for quick navigation • ESC to close
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}