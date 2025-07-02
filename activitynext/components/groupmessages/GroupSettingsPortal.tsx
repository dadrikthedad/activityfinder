"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useGroupSettingsStore } from "./useGroupSettingsStore";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import GroupSettingsPopover from "./GroupSettingsPopover";

export default function GroupSettingsPortal() {
  const { data, hide } = useGroupSettingsStore();
  const overlay = useOverlay();

  // Sync data with overlay opening/closing
  React.useEffect(() => {  
    if (data && !overlay.isOpen) {
      overlay.open();
    } else if (!data && overlay.isOpen) {
      overlay.close();
    }
  }, [data, overlay]);

  // Auto-close when overlay level drops
  useOverlayAutoClose(() => {
    hide();
  }, overlay.level ?? undefined);

  // Don't render if no data
  if (!data) {
    return null;
  }

  return createPortal(
    <GroupSettingsPopover
      key={`group-settings-${data.conversationId}`}
      user={data.user}
      conversationId={data.conversationId}
      position={data.position}
      onClose={hide}
      zIndex={overlay.zIndex}
      overlayRef={overlay.ref}
    />,
    document.body
  );
}