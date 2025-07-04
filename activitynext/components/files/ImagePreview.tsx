import { useState, useEffect, useRef } from "react";
import { DocumentPreview } from "./DocumentPreview";
import { 
  getFileTypeInfo, 
  useImagePreview, 
  canPreviewFile, 
  formatFileSize,
  getFileTypesSummary,
  createFileGallery
} from "./FileFunctions";
import Image from "next/image";

interface FilePreviewItemProps {
  file: File;
  index: number;
  onRemove: (index: number) => void;
  fileGallery?: Array<{ file: File; src: string; alt?: string; fileName?: string }>;
}

const FilePreviewItem = ({ file, index, onRemove, fileGallery }: FilePreviewItemProps) => {
  const { imageUrl, isLoading, error } = useImagePreview(file);
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video' || file.type.startsWith('video/');
  
  // State for document preview
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string>('');

  // Generate video thumbnail
  useEffect(() => {
    if (!isVideo) return;

    const generateThumbnail = () => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadedmetadata = () => {
        canvas.width = 96;
        canvas.height = 96;
        video.currentTime = Math.min(video.duration * 0.1, 1); // 10% into video or 1 second
      };
      
      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, 96, 96);
          const thumbnailUrl = canvas.toDataURL();
          setVideoThumbnail(thumbnailUrl);
        }
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
      video.load();
    };

    generateThumbnail();
  }, [file, isVideo]);

  // 🆕 Handle preview (både for bilder, videoer og andre filer)
  const handleFileClick = () => {
    if (isImage || isVideo || canPreviewFile(file)) {
      setShowDocumentPreview(true);
    }
  };

  return (
    <>
      <div className="relative group w-24 h-24">
        {isImage ? (
          // Image Preview with Gallery
          <div 
            className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 cursor-pointer"
            onClick={handleFileClick} // 🆕 Legg til click handler
          >
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : error ? (
              <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                <span className="text-red-500 text-xs">Error</span>
              </div>
            ) : (
               <Image
                  src={imageUrl}
                  alt={file.name}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-200"
                />
            )}
            
            {/* File info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2">
              <div className="truncate font-medium" title={file.name}>
                {file.name}
              </div>
              <div className="text-gray-300">
                {formatFileSize(file.size)}
              </div>
            </div>
            
            {/* Gallery indicator for files */}
            {fileGallery && fileGallery.length > 1 && (
              <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {(fileGallery.findIndex(item => item.file === file) || 0) + 1}/{fileGallery.length}
              </div>
            )}
          </div>
        ) : isVideo ? (
          // Video Preview - 🆕 Med click handler
          <div 
            className="w-24 h-24 rounded-lg bg-black border-2 border-gray-200 dark:border-gray-500 flex flex-col items-center justify-center p-1 cursor-pointer hover:border-[#1C6B1C] hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors relative overflow-hidden"
            onClick={handleFileClick} // 🆕 Legg til click handler
          >
            {videoThumbnail ? (
              <Image
                src={videoThumbnail}
                alt={file.name}
                width={500} // legg til ønsket bredde
                height={300} // legg til ønsket høyde
                className="w-full h-full object-cover rounded"
                layout="responsive" // eller "fill" hvis du vil fylle containeren
              />
            ) : (
              <span className="text-2xl text-purple-600" role="img" aria-label="video icon">
                {fileInfo.icon}
              </span>
            )}
            
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-[#1C6B1C] rounded-full p-2">
                <span className="text-white text-lg">Play</span>
              </div>
            </div>
            
            {/* File info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2">
              <div className="truncate font-medium" title={file.name}>
                {file.name.length > 12 ? `${file.name.substring(0, 12)}...` : file.name}
              </div>
              <div className="text-gray-300">
                {formatFileSize(file.size)}
              </div>
            </div>
            
            {/* File type badge */}
            <div className="absolute top-1 right-1 bg-[#1C6B1C] text-white text-xs px-1 rounded">
              {file.name.split('.').pop()?.toUpperCase() || 'VIDEO'}
            </div>
          </div>
        ) : (
          // Non-image, non-video files
          <div 
            className={`w-24 h-24 rounded-lg border-2 border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center p-2 ${
              canPreviewFile(file) ? 'cursor-pointer hover:border-[#1C6B1C] hover:bg-gray-50 dark:hover:bg-gray-500/20' : ''
            } transition-colors`}
            onClick={handleFileClick}
          >
            <span className={`text-2xl ${fileInfo.color}`} role="img" aria-label="file icon">
              {fileInfo.icon}
            </span>
            <div className="text-xs text-center mt-1">
              <div className="truncate max-w-full font-medium" title={file.name}>
                {file.name.length > 12 ? `${file.name.substring(0, 12)}...` : file.name}
              </div>
              <div className="text-gray-500 text-xs">
                {formatFileSize(file.size)}
              </div>
            </div>
            
            {/* File type badge */}
            <div className="absolute top-1 right-1 bg-gray-500 text-white text-xs px-1 rounded">
              {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
            </div>
          </div>
        )}

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // 🆕 Forhindre at preview åpnes når man fjerner
            onRemove(index);
          }}
          className="absolute inset-y-0 inset-x-0 bg-gray-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-lg transition-colors z-10"
          title="Remove"
          aria-label={`Remove ${file.name}`}
        >
          ×
        </button>

        {/* Hover overlay for non-images */}
        {!isImage && !isVideo && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg pointer-events-none"></div>
        )}
      </div>
      
      {/* 🆕 Document Preview Modal - støtter nå alle filtyper inkludert video */}
      <DocumentPreview
        file={file}
        isOpen={showDocumentPreview}
        onClose={() => setShowDocumentPreview(false)}
        gallery={fileGallery?.map(item => ({ file: item.file }))} // 🆕 Konverter til riktig format
        initialIndex={fileGallery?.findIndex(item => item.file === file) || 0}
      />
    </>
  );
};

// ===================================
// 📁 MAIN FILE PREVIEW COMPONENT
// ===================================

interface FilePreviewProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export const FilePreview = ({ files, onRemoveFile, onClearAll }: FilePreviewProps) => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  // Create gallery data for File objects with blob URLs
  const [imageGallery, setImageGallery] = useState<Array<{ file: File; src: string; alt?: string; fileName?: string }>>([]);
  
  // Use ref to track current URLs for cleanup
  const currentUrlsRef = useRef<string[]>([]);
  
  useEffect(() => {
    const setupGallery = async () => {
      // Cleanup previous URLs
      currentUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      currentUrlsRef.current = [];
      
      const gallery = await createFileGallery(files);
      
      // Track new URLs
      currentUrlsRef.current = gallery.map(item => item.src);
      setImageGallery(gallery);
    };
    
    setupGallery();
    
    // Cleanup function
    return () => {
      currentUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      currentUrlsRef.current = [];
    };
  }, [files]);

  return (
    <div className="p-4 rounded-lg border border-bg-[#1C6B1C] dark:border-[#1C6B1C]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {files.length} file{files.length !== 1 ? 's' : ''} chosen
          </span>
          {files.length > 1 && (
            <span className="text-xs text-gray-500">
              {getFileTypesSummary(files)}
            </span>
          )}
        </div>
        
        <button
          onClick={onClearAll}
          className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline transition-colors"
        >
         Remove all
        </button>
      </div>
      
      {/* File Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {files.map((file, index) => (
          <FilePreviewItem
            key={`${file.name}-${file.size}-${index}`}
            file={file}
            index={index}
            onRemove={onRemoveFile}
            fileGallery={imageGallery}
          />
        ))}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500">
          <div>Total size: {formatFileSize(totalSize)}</div>
        </div>
        
        <div className="text-xs text-gray-400">
          Max 10 files, 20MB total or 100MB for videos
        </div>
      </div>
    </div>
  );
};