import { useState, useEffect } from "react";
import { formatFileSize } from "@/services/files/fileServiceHelperFunctions";
import EnlargeableImage from "../common/EnlargeableImage"; // Adjust path as needed

// ===================================
// 🎨 FILE TYPE UTILITIES
// ===================================

const getFileTypeInfo = (file: File) => {
  const type = file.type.toLowerCase();
  
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
// 🖼️ IMAGE PREVIEW HOOK
// ===================================

const useImagePreview = (file: File) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!file.type.startsWith('image/')) {
      setIsLoading(false);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    
    // Test if image loads successfully
    const img = new Image();
    img.onload = () => setIsLoading(false);
    img.onerror = () => {
      setError(true);
      setIsLoading(false);
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return { imageUrl, isLoading, error };
};

// ===================================
// 📎 FILE PREVIEW ITEM COMPONENT
// ===================================

interface FilePreviewItemProps {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}

const FilePreviewItem = ({ file, index, onRemove }: FilePreviewItemProps) => {
  const { imageUrl, isLoading, error } = useImagePreview(file);
  const fileInfo = getFileTypeInfo(file);
  const isImage = fileInfo.category === 'image';

  return (
    <div className="relative group">
      {isImage ? (
        // Image Preview with EnlargeableImage
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <span className="text-red-500 text-xs">Error</span>
            </div>
          ) : (
            <EnlargeableImage
              src={imageUrl}
              alt={file.name}
              size={96} // 24 * 4 = 96px
              className="w-full h-full rounded-none border-none shadow-none" // Override default styles
              useOverlaySystem={true}
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
        </div>
      ) : (
        // Non-image files
        <div className="w-24 h-24 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center p-2">
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
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-lg transition-colors"
        title="Fjern fil"
        aria-label={`Fjern ${file.name}`}
      >
        ×
      </button>

      {/* Hover overlay for non-images */}
      {!isImage && (
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg pointer-events-none"></div>
      )}
    </div>
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
  const imageCount = files.filter(f => f.type.startsWith('image/')).length;
  const otherCount = files.length - imageCount;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {files.length} fil{files.length !== 1 ? 'er' : ''} valgt
          </span>
          {imageCount > 0 && otherCount > 0 && (
            <span className="text-xs text-gray-500">
              ({imageCount} bilde{imageCount !== 1 ? 'r' : ''}, {otherCount} andre)
            </span>
          )}
        </div>
        
        <button
          onClick={onClearAll}
          className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline transition-colors"
        >
          Fjern alle
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
          />
        ))}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500">
          Total størrelse: {formatFileSize(totalSize)}
        </div>
        
        <div className="text-xs text-gray-400">
          Maks 10 filer, 20MB totalt
        </div>
      </div>
    </div>
  );
};

// ===================================
// 🔄 USAGE IN MessageInput.tsx
// ===================================

// Replace your existing file preview section with:
/*
{selectedFiles.length > 0 && (
  <FilePreview
    files={selectedFiles}
    onRemoveFile={handleRemoveFile}
    onClearAll={() => setSelectedFiles([])}
  />
)}
*/