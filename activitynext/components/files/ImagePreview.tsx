import { useState, useEffect } from "react";
import EnlargeableImage from "../common/EnlargeableImage";
import { DocumentPreview } from "./DocumentPreview";
import { 
  getFileTypeInfo, 
  useImagePreview, 
  canPreviewFile, 
  formatFileSize,
  getFileTypesSummary,
  createFileGallery
} from "./PreviewHelperFunctions";

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
  
  // State for document preview
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);

  const handleFileClick = () => {
    if (canPreviewFile(file)) {
      setShowDocumentPreview(true);
    }
  };

  return (
    <>
      <div className="relative group">
        {isImage ? (
          // Image Preview with Gallery
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
                size={96}
                className="w-full h-full rounded-none border-none shadow-none"
                useOverlaySystem={true}
                gallery={fileGallery?.map(item => ({
                  src: item.src,
                  alt: item.alt || item.file.name,
                  fileName: item.fileName || item.file.name
                }))}
                initialIndex={fileGallery?.findIndex(item => item.file === file) || 0}
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
        ) : (
          // Non-image files
          <div 
            className={`w-24 h-24 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center p-2 ${
              canPreviewFile(file) ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
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
            
            {/* Preview indicator */}
            {canPreviewFile(file) && (
              <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
                👁️
              </div>
            )}
            
            {/* File type badge */}
            <div className="absolute top-1 right-1 bg-gray-500 text-white text-xs px-1 rounded">
              {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
            </div>
          </div>
        )}

        {/* Remove button */}
        <button
          onClick={() => onRemove(index)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-lg transition-colors z-10"
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
      
      {/* Document Preview Modal */}
      {canPreviewFile(file) && (
        <DocumentPreview
          file={file}
          isOpen={showDocumentPreview}
          onClose={() => setShowDocumentPreview(false)}
        />
      )}
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
  const imageCount = files.filter(f => f.type.startsWith('image/')).length;
  const pdfCount = files.filter(f => f.type === 'application/pdf').length;
  const docCount = files.filter(f => 
    f.type.includes('word') || 
    f.name.toLowerCase().endsWith('.docx') || 
    f.name.toLowerCase().endsWith('.doc')
  ).length;

  // Create gallery data for File objects with blob URLs
  const [imageGallery, setImageGallery] = useState<Array<{ file: File; src: string; alt?: string; fileName?: string }>>([]);

  useEffect(() => {
    const setupGallery = async () => {
      const gallery = await createFileGallery(files);
      setImageGallery(gallery);
    };

    setupGallery();

    // Cleanup blob URLs when component unmounts or files change
    return () => {
      imageGallery.forEach(item => {
        URL.revokeObjectURL(item.src);
      });
    };
  }, [files]);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {files.length} fil{files.length !== 1 ? 'er' : ''} valgt
          </span>
          {files.length > 1 && (
            <span className="text-xs text-gray-500">
              {getFileTypesSummary(files)}
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
            fileGallery={imageGallery}
          />
        ))}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500">
          <div>Total størrelse: {formatFileSize(totalSize)}</div>
          {imageCount > 1 && (
            <div className="mt-1">
              📸 {imageCount} bilder kan blas gjennom med piltaster
            </div>
          )}
          {(pdfCount > 0 || docCount > 0) && (
            <div className="mt-1">
              👁️ Klikk på filer for forhåndsvisning
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-400">
          Maks 10 filer, 20MB totalt
        </div>
      </div>
    </div>
  );
};