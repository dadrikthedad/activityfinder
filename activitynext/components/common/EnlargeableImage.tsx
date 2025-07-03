"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { PreviewModal } from "../files/PreviewModal";

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
  gallery = [],
  initialIndex = 0,
  showDownload = false,
  showOpenInNewTab = false
}: EnlargeableImageProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

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

  const handleOpen = useCallback(() => {
    // If gallery mode, find the index of current src
    if (isGalleryMode) {
      const index = gallery.findIndex(item => item.src === src);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
    
    setIsOpen(true);
  }, [isGalleryMode, gallery, src]);

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

  // Thumbnails component
  const thumbnails = hasMultiple && gallery.length <= 10 ? (
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
  ) : null;

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
      <PreviewModal
        isOpen={isOpen}
        onClose={handleClose}
        title={currentImage.fileName || currentImage.alt || 'Image'}
        subtitle="Image"
        icon="🖼️"
        showDownload={showDownload}
        showOpenInNewTab={showOpenInNewTab}
        onDownload={handleDownload}
        onOpenInNewTab={handleOpenInNewTab}
        hasGallery={hasMultiple}
        currentIndex={currentIndex}
        totalItems={gallery.length}
        onNext={goToNext}
        onPrevious={goToPrevious}
        onGoToIndex={goToIndex}
        thumbnails={thumbnails}
      >
        {/* Image content */}
        <div className={`flex items-center justify-center custom-scrollbar ${
          thumbnails ? 'p-4 pb-8' : 'p-4 pb-16'
        }`}>
          <Image
            src={currentImage.src}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            width={800}
            height={600}
            className={`max-w-full object-contain rounded ${
              thumbnails ? 'max-h-[75vh]' : 'max-h-[80vh]'
            }`}
            unoptimized
          />
        </div>
      </PreviewModal>
    </>
  );
}