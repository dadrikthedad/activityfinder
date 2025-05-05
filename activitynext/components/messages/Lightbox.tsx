"use client";

import { useEffect } from "react";
import Image from "next/image";

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Lightbox({ images, currentIndex, onClose, onNext, onPrev }: LightboxProps) {
  const imageUrl = images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50"
      onClick={onClose}
    >
      <Image
        src={imageUrl}
        alt="Vis bilde"
        className="max-h-[80vh] max-w-[90vw] rounded-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Kontrollknapper */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
        >
          ◀ Forrige
        </button>

        <a
          href={imageUrl}
          download
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          ⬇ Last ned
        </a>

        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
        >
          Neste ▶
        </button>
      </div>
    </div>
  );
}
