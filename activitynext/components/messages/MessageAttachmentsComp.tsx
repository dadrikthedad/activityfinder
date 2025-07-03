// components/messages/MessageAttachments.tsx
import { AttachmentDto } from "@/types/MessageDTO";
import EnlargeableImage from "../common/EnlargeableImage"; // Adjust path as needed

interface MessageAttachmentsProps {
  attachments: AttachmentDto[];
  className?: string;
}

// ===================================
// 🎨 FILE TYPE UTILITIES
// ===================================

const getFileTypeInfo = (fileType: string) => {
  const type = fileType.toLowerCase();
  
  if (type.startsWith('image/')) {
    return { category: 'image', icon: '🖼️', color: 'text-blue-600' };
  }
  if (type.startsWith('video/')) {
    return { category: 'video', icon: '🎥', color: 'text-purple-600' };
  }
  if (type === 'application/pdf') {
    return { category: 'pdf', icon: '📄', color: 'text-red-600' };
  }
  if (type.includes('document') || type.includes('word') || type.includes('text')) {
    return { category: 'document', icon: '📝', color: 'text-green-600' };
  }
  
  return { category: 'other', icon: '📎', color: 'text-gray-600' };
};

// ===================================
// 📎 SINGLE ATTACHMENT COMPONENT
// ===================================

interface AttachmentItemProps {
  attachment: AttachmentDto;
  index: number;
  totalCount: number;
  // 🆕 Gallery props
  imageGallery?: Array<{ src: string; alt?: string; fileName?: string }>;
}

const AttachmentItem = ({ attachment, index, imageGallery }: AttachmentItemProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType);
  const isImage = fileInfo.category === 'image';

  if (isImage) {
    return (
      <div className="relative group">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
          <EnlargeableImage
            src={attachment.fileUrl}
            alt={attachment.fileName || `Image ${index + 1}`}
            size={96}
            className="w-full h-full rounded-none border-none shadow-none"
            useOverlaySystem={true}
            // 🆕 Pass gallery data for navigation
            gallery={imageGallery}
            initialIndex={imageGallery?.findIndex(img => img.src === attachment.fileUrl) || 0}
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
        
        {/* 🆕 Gallery indicator */}
        {imageGallery && imageGallery.length > 1 && (
          <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {(imageGallery.findIndex(img => img.src === attachment.fileUrl) || 0) + 1}/{imageGallery.length}
          </div>
        )}
      </div>
    );
  }

  // Non-image files
  return (
    <div 
      className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
      onClick={() => window.open(attachment.fileUrl, '_blank')}
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
      <div className="text-xs text-gray-400">
        📎
      </div>
    </div>
  );
};

// ===================================
// 📁 MAIN ATTACHMENTS COMPONENT
// ===================================

export const MessageAttachments = ({ attachments, className = "" }: MessageAttachmentsProps) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter(att => getFileTypeInfo(att.fileType).category === 'image');
  const nonImages = attachments.filter(att => getFileTypeInfo(att.fileType).category !== 'image');

  // 🆕 Create gallery data for image navigation
  const imageGallery = images.map(img => ({
    src: img.fileUrl,
    alt: img.fileName || 'Image',
    fileName: img.fileName
  }));

  return (
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
                imageGallery={imageGallery} // 🆕 Pass gallery to each image
              />
            ))}
            
            {/* Show +X more overlay for extra images */}
            {images.length > 4 && (
              <div 
                className="w-24 h-24 rounded-lg bg-black/60 flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:bg-black/70 transition-colors"
                onClick={() => {
                  // Open gallery starting from the 5th image
                  // You could create a separate EnlargeableImage for this overlay
                }}
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
            />
          ))}
        </div>
      )}

      {/* Summary for many files */}
      {attachments.length > 5 && (
        <div className="mt-2 text-xs text-gray-500">
          {attachments.length} files total • {images.length > 1 ? `${images.length} images can be browsed with arrow keys` : ''}
        </div>
      )}
    </div>
  );
};