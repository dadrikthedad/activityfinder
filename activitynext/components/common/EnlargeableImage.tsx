// Her zoomer vi inn på bilde ved trykk. Brukes foreløpig kun i UserActionPopover.tsx
"use client";
import { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { useOverlay } from "@/context/OverlayProvider"; // NY IMPORT
import Image from "next/image";

interface EnlargeableImageProps {
  src: string;
  alt?: string;
  size?: number; // default visningsstørrelse
  className?: string;
}

export default function EnlargeableImage({
  src,
  alt = "Profile image",
  size = 80,
  className = "",
}: EnlargeableImageProps) {
  const [isOpen, setIsOpen] = useState(false);
 
  // NY: Auto-level overlay
  const overlay = useOverlay();

  // Sync overlay state with local state
  useEffect(() => {
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    overlay.close();
  };

  return (
    <>
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
     
      <Dialog open={isOpen} onClose={handleClose} style={{ zIndex: overlay.zIndex }}>
        <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel
            ref={overlay.ref}
            className="bg-white dark:bg-zinc-900 p-6 rounded-lg max-w-[90vw] max-h-[90vh] w-auto h-auto text-center overflow-auto"
          >
            <Image
              src={src}
              alt="Enlarged profile"
              width={1000}
              height={1000}
              className="rounded-xl mx-auto object-contain max-w-full max-h-[80vh]"
            />
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}