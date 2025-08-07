import { useState } from "react";
import { AttachmentDto } from "@shared/types/MessageDTO";
import { DocumentPreview } from "../files/DocumentPreview";
import { getFileTypeInfo, createFileFromUrl } from "../files/FileFunctions";
import Image from "next/image";

interface MessageAttachmentsProps {
  attachments: AttachmentDto[];
  className?: string;
  isLocked?: boolean; // NY: Om samtalen er låst
}

interface AttachmentItemProps {
  attachment: AttachmentDto;
  index: number;
  totalCount: number;
  onPreview: (attachment: AttachmentDto) => void;
  imageGallery?: Array<{ src: string; alt?: string; fileName?: string }>;
  isLocked?: boolean;
  isBlurred?: boolean;
  onToggleBlur?: () => void;
}

const AttachmentItem = ({ 
  attachment, 
  index, 
  onPreview, 
  imageGallery, 
  isLocked = false,
  isBlurred = false,
  onToggleBlur
}: AttachmentItemProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';

  const handleClick = () => {
    if (isBlurred) {
      onToggleBlur?.();
    } else {
      onPreview(attachment);
    }
  };

  if (isImage) {
    return (
      <div className="relative group cursor-pointer" onClick={handleClick}>
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-[#1C6B1C]">
          <Image
            src={attachment.fileUrl}
            alt={attachment.fileName || `Image ${index + 1}`}
            fill
            className={`object-cover transition-all duration-300 ${
              isBlurred 
                ? 'blur-xl' 
                : 'hover:scale-105 transition-transform duration-200'
            }`}
          />
        </div>
        
        {/* Blur overlay med "Click to view" */}
        {isBlurred && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
            <div className="text-white text-center p-2">
              <div className="text-xs font-medium">Click to view</div>
            </div>
          </div>
        )}

        {/* File info overlay on hover */}
        {attachment.fileName && !isBlurred && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="truncate" title={attachment.fileName}>
              {attachment.fileName}
            </div>
          </div>
        )}
        
        {/* Gallery indicator */}
        {imageGallery && imageGallery.length > 1 && !isBlurred && (
          <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {(imageGallery.findIndex(img => img.src === attachment.fileUrl) || 0) + 1}/{imageGallery.length}
          </div>
        )}

        {/* Unblur knapp når bildet er vist */}
        {isLocked && !isBlurred && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBlur?.();
            }}
            className="absolute top-1 left-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded text-xs transition-all opacity-0 group-hover:opacity-100"
            title="Blur image"
          >
            🙈
          </button>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative group cursor-pointer" onClick={handleClick}>
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-[#1C6B1C] relative">
          <video
            src={attachment.fileUrl}
            className={`w-full h-full object-cover transition-all duration-300 ${
              isBlurred ? 'blur-xl' : ''
            }`}
            muted
            preload="metadata"
            onError={() => {
              // Fallback til ikon hvis video ikke kan lastes
              const container = document.querySelector(`[data-video-thumb="${attachment.fileUrl}"]`);
              if (container) {
                container.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center text-2xl">
                    🎬
                  </div>
                `;
              }
            }}
          />
          
          {/* Blur overlay for videos */}
          {isBlurred && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
              <div className="text-white text-center p-2">
                <div className="text-lg mb-1">🎥</div>
                <div className="text-xs font-medium">Click to view</div>
              </div>
            </div>
          )}

          {/* Video play overlay */}
          {!isBlurred && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
              <div className="bg-white/90 rounded-full p-2">
                <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          )}
          
          {/* Video duration overlay (if we can get it) */}
          {!isBlurred && (
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
              🎬
            </div>
          )}

          {/* Unblur knapp for video */}
          {isLocked && !isBlurred && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBlur?.();
              }}
              className="absolute top-1 left-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded text-xs transition-all opacity-0 group-hover:opacity-100"
              title="Blur video"
            >
              🙈
            </button>
          )}
        </div>
        
        {/* File info overlay on hover */}
        {attachment.fileName && !isBlurred && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="truncate" title={attachment.fileName}>
              {attachment.fileName}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Non-image, non-video files - use PreviewModal inspired styling
  return (
    <div 
      className="flex items-center gap-3 bg-gray-50 dark:bg-[#2E2E2E] p-3 rounded-lg border border-gray-200 dark:border-[#1C6B1C] hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer group"
      onClick={() => onPreview(attachment)}
    >
      {fileInfo.icon}
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" title={attachment.fileName}>
          {attachment.fileName || 'Unnamed file'}
        </div>
        <div className="text-xs text-gray-500">
          {attachment.fileType}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-400 group-hover:text-[#1C6B1C] transition-colors">
          📎
        </div>
      </div>
    </div>
  );
};

// ===================================
// 📁 MAIN ATTACHMENTS COMPONENT
// ===================================

export const MessageAttachments = ({ 
  attachments, 
  className = "",
  isLocked = false 
}: MessageAttachmentsProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<Array<{ file: File; attachment: AttachmentDto }>>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [blurredAttachments, setBlurredAttachments] = useState<Set<string>>(new Set()); // Track hvilke filer som er blurret

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Toggle blur for et spesifikt attachment
  const toggleBlur = (fileUrl: string) => {
    setBlurredAttachments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileUrl)) {
        newSet.delete(fileUrl); // Fjern blur
      } else {
        newSet.add(fileUrl); // Legg til blur
      }
      return newSet;
    });
  };

  const images = attachments.filter(att => getFileTypeInfo(att.fileType, att.fileName).category === 'image');
  const videos = attachments.filter(att => getFileTypeInfo(att.fileType, att.fileName).category === 'video');
  const nonMediaFiles = attachments.filter(att => {
    const category = getFileTypeInfo(att.fileType, att.fileName).category;
    return category !== 'image' && category !== 'video';
  });

  // Create gallery data for image navigation
  const imageGallery = images.map(img => ({
    src: img.fileUrl,
    alt: img.fileName || 'Image',
    fileName: img.fileName
  }));

  const handlePreview = async (attachment: AttachmentDto) => {
    try {  
      // Always create gallery with all files for navigation
      const allAttachments = attachments;
      const galleryPromises = allAttachments.map(async (att) => {
        const attFile = await createFileFromUrl(
          att.fileUrl, 
          att.fileName || 'unknown-file', 
          att.fileType
        );
        return { attachment: att, file: attFile };
      });
      
      const gallery = await Promise.all(galleryPromises);
      setPreviewGallery(gallery);
      
      // Find current attachment index in all attachments
      const currentIndex = attachments.findIndex(att => att.fileUrl === attachment.fileUrl);
      setCurrentPreviewIndex(currentIndex >= 0 ? currentIndex : 0);
      setSelectedFile(gallery[currentIndex >= 0 ? currentIndex : 0].file);
      
      setShowPreview(true);
    } catch (error) {
      console.error('Error creating file for preview:', error);
      // Fallback: open in new tab
      window.open(attachment.fileUrl, '_blank');
    }
  };

  const handleNavigate = (index: number) => {
    if (index >= 0 && index < previewGallery.length) {
      setCurrentPreviewIndex(index);
      setSelectedFile(previewGallery[index].file);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedFile(null);
    setPreviewGallery([]);
    setCurrentPreviewIndex(0);
  };

  const getFileTypesSummary = () => {
    const imageCount = images.length;
    const videoCount = videos.length;
    const pdfCount = attachments.filter(att => att.fileType === 'application/pdf').length;
    const docCount = attachments.filter(att => 
      att.fileType.includes('word') || 
      att.fileName?.toLowerCase().endsWith('.docx') || 
      att.fileName?.toLowerCase().endsWith('.doc')
    ).length;
    const otherCount = attachments.length - imageCount - videoCount - pdfCount - docCount;

    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} bilde${imageCount !== 1 ? 'r' : ''}`);
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 'er' : ''}`);
    if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? 'er' : ''}`);
    if (docCount > 0) parts.push(`${docCount} dokument${docCount !== 1 ? 'er' : ''}`);
    if (otherCount > 0) parts.push(`${otherCount} andre`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  };

  return (
    <>
      <div className={`mt-2 ${className}`}>
        {/* Images Grid */}
        {images.length > 0 && (
          <div className="mb-2">
            <div className={`grid gap-2 ${
              images.length === 1 ? 'grid-cols-1 max-w-[200px]' :
              images.length === 2 ? 'grid-cols-2 max-w-[200px]' :
              images.length === 3 ? 'grid-cols-2 max-w-[200px]' :
              'grid-cols-2 max-w-[200px]'
            }`}>
              {images.slice(0, 4).map((attachment, index) => {
                // For låste samtaler: Start med blur på bilder
                const shouldBlur = isLocked;
                const isCurrentlyBlurred = shouldBlur && !blurredAttachments.has(attachment.fileUrl);

                return (
                  <AttachmentItem
                    key={`${attachment.fileUrl}-${index}`}
                    attachment={attachment}
                    index={index}
                    totalCount={images.length}
                    onPreview={handlePreview}
                    imageGallery={imageGallery}
                    isLocked={isLocked}
                    isBlurred={isCurrentlyBlurred}
                    onToggleBlur={() => toggleBlur(attachment.fileUrl)}
                  />
                );
              })}
              
              {/* Show +X more overlay for extra images */}
              {images.length > 4 && (
                <div 
                  className="w-24 h-24 rounded-lg bg-black/60 flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:bg-black/70 transition-colors"
                  onClick={() => handlePreview(images[4])} // Open gallery starting from 5th image
                >
                  +{images.length - 4} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Videos Grid */}
        {videos.length > 0 && (
          <div className="mb-2">
            <div className={`grid gap-2 ${
              videos.length === 1 ? 'grid-cols-1 max-w-[200px]' :
              videos.length === 2 ? 'grid-cols-2 max-w-[200px]' :
              'grid-cols-2 max-w-[200px]'
            }`}>
              {videos.map((attachment, index) => {
                // For låste samtaler: Start med blur på videoer
                const shouldBlur = isLocked;
                const isCurrentlyBlurred = shouldBlur && !blurredAttachments.has(attachment.fileUrl);

                return (
                  <AttachmentItem
                    key={`${attachment.fileUrl}-video-${index}`}
                    attachment={attachment}
                    index={index}
                    totalCount={videos.length}
                    onPreview={handlePreview}
                    isLocked={isLocked}
                    isBlurred={isCurrentlyBlurred}
                    onToggleBlur={() => toggleBlur(attachment.fileUrl)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Non-media files */}
        {nonMediaFiles.length > 0 && (
          <div className="space-y-2">
            {nonMediaFiles.map((attachment, index) => (
              <AttachmentItem
                key={`${attachment.fileUrl}-file-${index}`}
                attachment={attachment}
                index={index}
                totalCount={nonMediaFiles.length}
                onPreview={handlePreview}
              />
            ))}
          </div>
        )}

        {/* Summary for many files */}
        {attachments.length > 5 && (
          <div className="mt-2 text-xs text-gray-500">
            {attachments.length} files total {getFileTypesSummary()}
            <br />
            Click any file to preview or download
            {images.length > 1 && ` • ${images.length} images can be browsed with arrow keys`}
          </div>
        )}
      </div>

      {/* Document Preview Modal with Gallery Support */}
      {selectedFile && (
        <DocumentPreview
          file={selectedFile}
          isOpen={showPreview}
          onClose={handleClosePreview}
          gallery={previewGallery}
          initialIndex={currentPreviewIndex}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
};