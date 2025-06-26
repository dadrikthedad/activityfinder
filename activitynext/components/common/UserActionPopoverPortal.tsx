// components/common/UserActionPopoverPortal.tsx
"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { useOverlay } from "@/context/OverlayProvider"; // NY IMPORT
import UserActionPopover from "./UserActionPopover";


export default function UserActionPopoverPortal() {
  const { data, hide } = useUserActionPopoverStore();
  
  // NY: Auto-level overlay - vil automatisk få riktig level basert på context
  const overlay = useOverlay();

  // Sync overlay state with store data
  React.useEffect(() => {
    console.log('🌐 UserActionPopoverPortal effect:', { hasData: !!data, overlayOpen: overlay.isOpen, userId: data?.user.id });
    
    if (data && !overlay.isOpen) {
      console.log('🌐 Opening portal overlay for:', data.user.fullName);
      overlay.open();
    } else if (!data && overlay.isOpen) {
      console.log('🌐 Closing portal overlay - no data');
      overlay.close();
    }
  }, [data]); // FJERNET overlay dependency for å unngå loops

  // Close store data when overlay closes externally (men kun hvis det ikke er pga re-render)
  React.useEffect(() => {
    console.log('🌐 Portal overlay state changed:', { overlayOpen: overlay.isOpen, hasData: !!data });
    
    // Kun lukk hvis vi faktisk har data OG overlay lukkes eksternt
    if (!overlay.isOpen && data) {
      // Legg til en liten delay for å la render-syklusen fullføres
      const timer = setTimeout(() => {
        // Dobbelsjekk at data fortsatt finnes og overlay fortsatt er lukket
        if (!overlay.isOpen && useUserActionPopoverStore.getState().data) {
          console.log('🌐 Overlay closed externally after delay, hiding store data');
          hide();
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [overlay.isOpen]);

  if (!data || !overlay.isOpen) return null;

  console.log('🌐 UserActionPopoverPortal rendering:', { 
    position: data.position, 
    zIndex: overlay.zIndex 
  });

  return createPortal(
    <UserActionPopover
        key={`global-${data.user.id}`}
        user={data.user}
        onCloseDropdown={hide}
        position={data.position}
        isGroup={data.isGroup}
        participants={data.participants || []}
        onLeaveGroup={data.onLeaveGroup}
        isPendingRequest={data.isPendingRequest}
        conversationId={data.conversationId}
        overlayRef={overlay.ref}
    />,
    document.body
    );
}