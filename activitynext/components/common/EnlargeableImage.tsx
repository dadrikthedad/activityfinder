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
  // Gallery props
  gallery?: ImageGalleryItem[];
  initialIndex?: number;
  // Action buttons control
  showDownload?: boolean;
  showOpenInNewTab?: boolean;
}

export default function EnlargeableImage({
  src,
  alt = "Profile image",
  size = 80,
  className = "",
  useOverlaySystem = true,
  gallery = [],
  initialIndex = 0,
  showDownload = false,
  showOpenInNewTab = false
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
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          handleClose();
          break;
        case 'ArrowLeft':
          if (hasMultiple) {
            e.preventDefault();
            e.stopPropagation();
            goToPrevious();
          }
          break;
        case 'ArrowRight':
          if (hasMultiple) {
            e.preventDefault();
            e.stopPropagation();
            goToNext();
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
          if (hasMultiple) {
            const index = parseInt(e.key) - 1;
            if (index < gallery.length) {
              e.preventDefault();
              e.stopPropagation();
              goToIndex(index);
            }
          }
          break;
      }
    };

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

  const handleOpenInNewTab = () => {
    window.open(currentImage.src, '_blank');
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentImage.src;
    a.download = currentImage.fileName || 'image';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
            className="fixed inset-0 bg-black/80 cursor-pointer"
            onClick={handleClose}
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
                  handleClose();
                }
              }}
              tabIndex={-1}
              style={{ outline: 'none' }}
            >
              {/* Gallery navigation arrows - outside content area */}
              {hasMultiple && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                    aria-label="Previous image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                    aria-label="Next image"
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
                  <span className="text-2xl">🖼️</span>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {currentImage.fileName || currentImage.alt || 'Image'}
                      {/* Gallery counter */}
                      {hasMultiple && (
                        <span className="ml-2 text-sm text-gray-500">
                          ({currentIndex + 1} of {gallery.length})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Image
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {showOpenInNewTab && (
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-3 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors text-sm"
                    >
                      Open in new tab
                    </button>
                  )}
                  {showDownload && (
                    <button
                      onClick={handleDownload}
                      className="px-3 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors text-sm"
                    >
                      Download
                    </button>
                  )}
                  <button
                    onClick={handleClose}
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
                  maxHeight: hasMultiple && gallery.length <= 10 
                    ? 'calc(95vh - 120px)' 
                    : 'calc(95vh - 80px)' 
                }}
              >
                {/* Image viewer */}
                <div className={`flex items-center justify-center custom-scrollbar ${
                  hasMultiple && gallery.length <= 10 ? 'p-4 pb-8' : 'p-4 pb-16'
                }`}>
                  <Image
                    src={currentImage.src}
                    alt={currentImage.alt || `Image ${currentIndex + 1}`}
                    width={800}
                    height={600}
                    className={`max-w-full object-contain rounded ${
                      hasMultiple && gallery.length <= 10 ? 'max-h-[75vh]' : 'max-h-[80vh]'
                    }`}
                    unoptimized
                  />
                </div>
              </div>

              {/* Gallery thumbnails */}
              {hasMultiple && gallery.length <= 10 && (
                <div className="p-4">
                  <div className="flex justify-center gap-2 flex-wrap">
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
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
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