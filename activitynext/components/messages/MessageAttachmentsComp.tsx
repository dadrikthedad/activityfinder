// components/messages/MessageAttachments.tsx
import { useState } from "react";
import { AttachmentDto } from "@/types/MessageDTO";
import { DocumentPreview } from "../files/DocumentPreview";
import { getFileTypeInfo, createFileFromUrl } from "../files/PreviewHelperFunctions";

interface MessageAttachmentsProps {
  attachments: AttachmentDto[];
  className?: string;
}

interface AttachmentItemProps {
  attachment: AttachmentDto;
  index: number;
  totalCount: number;
  onPreview: (attachment: AttachmentDto) => void;
  imageGallery?: Array<{ src: string; alt?: string; fileName?: string }>;
}

const AttachmentItem = ({ attachment, index, onPreview, imageGallery }: AttachmentItemProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isImage = fileInfo.category === 'image';

  if (isImage) {
    return (
      <div className="relative group cursor-pointer" onClick={() => onPreview(attachment)}>
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName || `Image ${index + 1}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        </div>
        
        {/* File info overlay on hover */}
        {attachment.fileName && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="truncate" title={attachment.fileName}>
              {attachment.fileName}
            </div>
          </div>
        )}
        
        {/* Gallery indicator */}
        {imageGallery && imageGallery.length > 1 && (
          <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {(imageGallery.findIndex(img => img.src === attachment.fileUrl) || 0) + 1}/{imageGallery.length}
          </div>
        )}

        {/* Preview indicator */}
        <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          👁️
        </div>
      </div>
    );
  }

  // Non-image files
  return (
    <div 
      className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer group"
      onClick={() => onPreview(attachment)}
    >
      <span className={`text-2xl ${fileInfo.color}`} role="img" aria-label="file icon">
        {fileInfo.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" title={attachment.fileName}>
          {attachment.fileName || 'Unnamed file'}
        </div>
        <div className="text-xs text-gray-500">
          {attachment.fileType}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Preview indicator */}
        <div className="text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          👁️
        </div>
        <div className="text-xs text-gray-400">
          📎
        </div>
      </div>
    </div>
  );
};

// ===================================
// 📁 MAIN ATTACHMENTS COMPONENT
// ===================================

export const MessageAttachments = ({ attachments, className = "" }: MessageAttachmentsProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<Array<{ file: File; attachment: AttachmentDto }>>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter(att => getFileTypeInfo(att.fileType, att.fileName).category === 'image');
  const nonImages = attachments.filter(att => getFileTypeInfo(att.fileType, att.fileName).category !== 'image');

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
    const pdfCount = attachments.filter(att => att.fileType === 'application/pdf').length;
    const docCount = attachments.filter(att => 
      att.fileType.includes('word') || 
      att.fileName?.toLowerCase().endsWith('.docx') || 
      att.fileName?.toLowerCase().endsWith('.doc')
    ).length;
    const otherCount = attachments.length - imageCount - pdfCount - docCount;

    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} bilde${imageCount !== 1 ? 'r' : ''}`);
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
              {images.slice(0, 4).map((attachment, index) => (
                <AttachmentItem
                  key={`${attachment.fileUrl}-${index}`}
                  attachment={attachment}
                  index={index}
                  totalCount={images.length}
                  onPreview={handlePreview}
                  imageGallery={imageGallery}
                />
              ))}
              
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

        {/* Non-image files */}
        {nonImages.length > 0 && (
          <div className="space-y-2">
            {nonImages.map((attachment, index) => (
              <AttachmentItem
                key={`${attachment.fileUrl}-${index}`}
                attachment={attachment}
                index={index}
                totalCount={nonImages.length}
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