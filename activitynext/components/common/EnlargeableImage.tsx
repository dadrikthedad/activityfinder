// EnlargeableImage.tsx - Updated to use overlay system instead of HeadlessUI Dialog
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import Image from "next/image";

interface EnlargeableImageProps {
  src: string;
  alt?: string;
  size?: number; // default visningsstørrelse
  className?: string;
  // Optional prop to disable overlay system when used as nested component
  useOverlaySystem?: boolean;
}

export default function EnlargeableImage({
  src,
  alt = "Profile image",
  size = 80,
  className = "",
  useOverlaySystem = true // Default to true for backwards compatibility
}: EnlargeableImageProps) {
  
  // Always call hooks - simplified approach
  const [isOpen, setIsOpen] = useState(() => {
    console.log('🖼️ OVERLAY EnlargeableImage initial state:', { useOverlaySystem, willBeOpen: !useOverlaySystem });
    return !useOverlaySystem; // If not using overlay, start open (though this won't be used much)
  });
  const overlay = useOverlay(); // Always call useOverlay - we'll always register for outside click detection
  console.log('🖼️ OVERLAY EnlargeableImage props received:', { useOverlaySystem, src: src.substring(0, 30) + '...', isOpen });

  // Auto-open when component mounts (only if using overlay system)
  useEffect(() => {
    if (useOverlaySystem) {
      console.log('🖼️ OVERLAY EnlargeableImage mounting, will use full overlay state management');
      // Component starts with isOpen: false normally, overlay will be opened manually
    } else {
      // Always register for outside click detection, even when not using overlay state management
      console.log('🖼️ OVERLAY EnlargeableImage mounting without overlay state management, but registering for outside clicks');
      overlay.open(); // Register as level, but don't use state management
    }
  }, [useOverlaySystem, overlay]);

  // Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) return;
    
    if (isOpen && !overlay.isOpen) {
      console.log('🖼️ OVERLAY EnlargeableImage opening overlay');
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      console.log('🖼️ OVERLAY EnlargeableImage closing overlay');
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close, useOverlaySystem]);

  // Always call useOverlayAutoClose to listen for external closing
  useOverlayAutoClose(() => {
    console.log('🖼️ OVERLAY EnlargeableImage auto-close triggered');
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      // If not using overlay system, just close directly
      console.log('🖼️ OVERLAY EnlargeableImage closing directly');
      setIsOpen(false);
    }
  }, overlay.level ?? undefined);

  const handleOpen = useCallback(() => {
    console.log('🖼️ OVERLAY EnlargeableImage opening');
    setIsOpen(true);
    
    // Force open overlay after state is set
    if (useOverlaySystem) {
      setTimeout(() => {
        overlay.open();
      }, 0);
    }
  }, [useOverlaySystem, overlay]);

  const handleClose = useCallback(() => {
    console.log('🖼️ OVERLAY EnlargeableImage manual close', { useOverlaySystem });
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  }, [useOverlaySystem]);

  // Auto-close on action completion (only if using overlay system)
  useEffect(() => {
    console.log('🖼️ OVERLAY EnlargeableImage effect check:', { useOverlaySystem, isOpen, shouldTriggerClose: useOverlaySystem && !isOpen });
    
    // Only when overlay system is used AND isOpen becomes false AFTER being true
    if (useOverlaySystem && !isOpen && overlay.level !== null) {
      console.log('🖼️ OVERLAY EnlargeableImage closed via overlay system');
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
     
      {/* Enlarged image modal - only render when open */}
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
          
          {/* Centered modal content */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={overlay.ref}
              className="bg-white dark:bg-zinc-900 p-6 rounded-lg max-w-[90vw] max-h-[90vh] w-auto h-auto text-center overflow-auto pointer-events-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the modal content
            >
              <Image
                src={src}
                alt="Enlarged profile"
                width={1000}
                height={1000}
                className="rounded-xl mx-auto object-contain max-w-full max-h-[80vh]"
              />
              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => window.open(src, '_blank')}
                  className="px-6 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}