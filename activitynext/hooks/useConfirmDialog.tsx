"use client";

import { useCallback, useState, useEffect } from "react";
import { useOverlay } from "@/context/OverlayProvider";// Adjust path as needed
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import Card from "@/components/common/Card";
import { ReactNode } from "react";
import { createPortal } from "react-dom";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
};

export function useConfirmDialog() {
  const { ref, isOpen, open, close, zIndex } = useOverlay();
  const [currentOptions, setCurrentOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((result: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setCurrentOptions(options);
        setResolvePromise(() => resolve);
        open();
      });
    },
    [open]
  );

  const handleClose = useCallback((result: boolean) => {
    if (resolvePromise) {
      resolvePromise(result);
      setResolvePromise(null);
    }
    setCurrentOptions(null);
    close();
  }, [close, resolvePromise]);

  // Handle escape key - close with false result
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  const ConfirmDialog = useCallback(() => {
    if (!isOpen || !currentOptions) return null;

    const dialog = (
      <div
        ref={ref}
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex }}
      >
        {/* Backdrop with blur */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        />
        
        {/* Dialog content */}
        <div className="relative z-10">
          <Card className="max-w-md w-full text-center space-y-6 border-2 border-[#1C6B1C] bg-white dark:bg-[#1e2122] shadow-md p-6">
            <h2 className="text-2xl font-bold text-[#1C6B1C]">
              {currentOptions.title || "Confirm"}
            </h2>
            <div className="text-gray-800 dark:text-gray-200">
              {currentOptions.message}
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <ProfileNavButton
                text="Cancel"
                onClick={() => handleClose(false)}
                variant="small"
                className="bg-gray-500 hover:bg-gray-600 text-white"
              />
              <ProfileNavButton
                text="Confirm"
                onClick={() => handleClose(true)}
                variant="small"
                className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
              />
            </div>
          </Card>
        </div>
      </div>
    );

    // Render to portal to ensure it's at the top level
    return typeof window !== 'undefined' 
      ? createPortal(dialog, document.body)
      : null;
  }, [isOpen, currentOptions, ref, zIndex, handleClose]);

  return { 
    confirm,
    ConfirmDialog
  };
}