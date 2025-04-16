"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
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

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer rounded-full border-4 border-green-700 shadow-md overflow-hidden ${className}`}
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

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="fixed z-50 inset-0">
        <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-zinc-900 p-6 rounded-lg max-w-[90vw] max-h-[90vh] w-auto h-auto text-center overflow-auto">
            <Image
              src={src}
              alt="Enlarged profile"
              width={1000}
              height={1000}
              className="rounded-xl mx-auto object-contain max-w-full max-h-[80vh]"
            />
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setIsOpen(false)}
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
