// components/common/DocumentPreview.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { PreviewModal } from "./PreviewModal";
import { 
  getFileTypeInfo, 
  getFileIcon, 
  getSyntaxClass, 
  canPreviewAsText,
  formatFileSize 
} from "./PreviewHelperFunctions";

interface GalleryItem {
  file: File;
  attachment?: {
    fileUrl: string;
    fileName?: string;
    fileType: string;
  };
}

interface DocumentPreviewProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  gallery?: GalleryItem[];
  initialIndex?: number;
  onNavigate?: (index: number) => void;
}

export const DocumentPreview = ({ 
  file, 
  isOpen, 
  onClose, 
  gallery = [], 
  initialIndex = 0, 
  onNavigate 
}: DocumentPreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Gallery navigation
  const isGalleryMode = gallery.length > 1;
  const currentFile = isGalleryMode ? gallery[currentIndex]?.file || file : file;
  
  // Navigation functions
  const goToNext = useCallback(() => {
    if (!isGalleryMode) return;
    const newIndex = (currentIndex + 1) % gallery.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [isGalleryMode, currentIndex, gallery.length, onNavigate]);

  const goToPrevious = useCallback(() => {
    if (!isGalleryMode) return;
    const newIndex = (currentIndex - 1 + gallery.length) % gallery.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [isGalleryMode, currentIndex, gallery.length, onNavigate]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < gallery.length) {
      setCurrentIndex(index);
      onNavigate?.(index);
    }
  }, [gallery.length, onNavigate]);

  // Read file content - now using currentFile
  useEffect(() => {
    if (!isOpen || !currentFile) return;

    console.log('DocumentPreview: Processing file:', {
      name: currentFile.name,
      type: currentFile.type,
      size: currentFile.size,
      category: getFileTypeInfo(currentFile.type, currentFile.name).category
    });

    setIsLoading(true);
    setError('');
    setContent('');
    setPdfUrl('');

    const fileName = currentFile.name.toLowerCase();
    const fileType = currentFile.type.toLowerCase();
    const fileCategory = getFileTypeInfo(currentFile.type, currentFile.name).category;

    // Handle images first
    if (fileCategory === 'image' || fileType.startsWith('image/')) {
      console.log('DocumentPreview: Handling as image');
      setIsLoading(false);
      return;
    }

    // Handle PDF files
    if (fileType === 'application/pdf') {
      console.log('DocumentPreview: Handling as PDF');
      const url = URL.createObjectURL(currentFile);
      setPdfUrl(url);
      setIsLoading(false);
      return () => URL.revokeObjectURL(url);
    }

    // Handle Word documents
    if (fileType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      setError('Word-filer kan ikke forhåndsvises i nettleseren. Word-dokumenter krever Microsoft Word eller kompatibel programvare for å vises korrekt.');
      setIsLoading(false);
      return;
    }

    // Handle Excel files
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
        fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      setError('Excel-filer kan ikke forhåndsvises i nettleseren. Regneark krever Microsoft Excel eller kompatibel programvare for å vises korrekt.');
      setIsLoading(false);
      return;
    }

    // Handle PowerPoint files
    if (fileType.includes('powerpoint') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      setError('PowerPoint-filer kan ikke forhåndsvises i nettleseren. Presentasjoner krever Microsoft PowerPoint eller kompatibel programvare for å vises korrekt.');
      setIsLoading(false);
      return;
    }

    // Check file size limit (5MB for better performance)
    if (currentFile.size > 5 * 1024 * 1024) {
      setError('Filen er for stor for forhåndsvisning (maks 5MB). Klikk "Last ned" for å åpne filen.');
      setIsLoading(false);
      return;
    }

    // Try to read as text for supported files
    if (canPreviewAsText(currentFile)) {
      console.log('DocumentPreview: Handling as text file');
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result as string;
        setContent(result);
        setIsLoading(false);
      };

      reader.onerror = () => {
        setError('Kunne ikke lese filen. Klikk "Last ned" for å åpne filen.');
        setIsLoading(false);
      };

      // Try UTF-8 first
      try {
        reader.readAsText(currentFile, 'UTF-8');
      } catch (err) {
        console.error('Error reading file:', err);
        setError('Filen kan ikke forhåndsvises. Klikk "Last ned" for å åpne filen.');
        setIsLoading(false);
      }
    } else {
      console.log('DocumentPreview: File type not supported for preview');
      setError('Denne filtypen støttes ikke for forhåndsvisning. Klikk "Last ned" for å åpne filen.');
      setIsLoading(false);
    }
  }, [currentFile, isOpen]);

  const handleDownload = () => {
    // Check if this is an attachment file
    const currentGalleryItem = isGalleryMode ? gallery[currentIndex] : null;
    const isAttachmentFile = currentGalleryItem?.attachment;

    if (isAttachmentFile) {
      // For attachment files, create download link from URL
      const attachment = currentGalleryItem.attachment!;
      const a = document.createElement('a');
      a.href = attachment.fileUrl;
      a.download = attachment.fileName || 'download';
      a.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // For regular File objects, use blob URL
      const url = URL.createObjectURL(currentFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenInNewTab = () => {
    // Check if this is an attachment file
    const currentGalleryItem = isGalleryMode ? gallery[currentIndex] : null;
    const isAttachmentFile = currentGalleryItem?.attachment;

    if (isAttachmentFile) {
      // For attachment files, open URL directly
      window.open(currentGalleryItem.attachment!.fileUrl, '_blank');
    } else {
      // For regular File objects, use blob URL
      const url = URL.createObjectURL(currentFile);
      window.open(url, '_blank');
      // Note: URL will be cleaned up when the tab is closed
    }
  };

  // Gallery thumbnails component
  const thumbnails = isGalleryMode && gallery.length <= 10 && gallery.some(item => getFileTypeInfo(item.file.type, item.file.name).category === 'image') ? (
    <div className="flex justify-center gap-2 flex-wrap">
      {gallery.map((item, index) => {
        const isImage = getFileTypeInfo(item.file.type, item.file.name).category === 'image';
        return (
          <button
            key={index}
            onClick={() => goToIndex(index)}
            className={`w-12 h-12 rounded border-2 overflow-hidden transition-all flex items-center justify-center ${
              index === currentIndex 
                ? 'border-blue-500 ring-2 ring-blue-300' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {isImage ? (
              <Image
                src={URL.createObjectURL(item.file)}
                alt={item.file.name}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-xs">
                {getFileIcon(item.file.name, item.file.type)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  // Content renderer
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Laster innhold...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-16 px-4">
          <div className="text-red-500 mb-4 text-4xl">⚠️</div>
          <p className="text-red-600 dark:text-red-400 mb-6 text-lg">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors"
            >
              Last ned fil
            </button>
            {currentFile.type === 'application/pdf' && (
              <button
                onClick={handleOpenInNewTab}
                className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Åpne PDF i ny fane
              </button>
            )}
          </div>
        </div>
      );
    }

    if (pdfUrl) {
      // PDF Viewer
      return (
        <div className="w-full h-full min-h-[600px] p-4">
          <iframe
            src={pdfUrl}
            className="w-full h-full min-h-[600px] border-0 rounded"
            title={`PDF viewer: ${currentFile.name}`}
            onError={() => {
              setError('PDF kan ikke vises i nettleseren. Klikk "Åpne i ny fane" eller "Last ned".');
            }}
          />
        </div>
      );
    }

    if (content) {
      // Text content
      return (
        <div className="p-4">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            <pre className={`whitespace-pre-wrap font-mono text-xs leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded border overflow-x-auto ${getSyntaxClass(currentFile.name)}`}>
              {content}
            </pre>
            
            {/* File info */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">Fil info:</span>
                <span>{content.split('\n').length} linjer • {content.length} tegn</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (getFileTypeInfo(currentFile.type, currentFile.name).category === 'image') {
      // Image viewer
      return (
        <div className={`flex items-center justify-center custom-scrollbar ${
          thumbnails ? 'p-4 pb-8' : 'p-4 pb-16'
        }`}>
          {(() => {
            const currentGalleryItem = isGalleryMode ? gallery[currentIndex] : null;
            const isAttachmentFile = currentGalleryItem?.attachment;
            const imageSrc = isAttachmentFile 
              ? currentGalleryItem.attachment!.fileUrl 
              : URL.createObjectURL(currentFile);

            return (
              <Image
                src={imageSrc}
                alt={currentFile.name}
                width={800}
                height={600}
                className={`max-w-full object-contain rounded ${
                  thumbnails ? 'max-h-[75vh]' : 'max-h-[80vh]'
                }`}
                unoptimized
                onLoad={(e) => {
                  // Only clean up blob URLs for File objects
                  if (!isAttachmentFile) {
                    setTimeout(() => {
                      URL.revokeObjectURL((e.target as HTMLImageElement).src);
                    }, 100);
                  }
                }}
              />
            );
          })()}
        </div>
      );
    }

    return null;
  };

  return (
    <PreviewModal
      isOpen={isOpen}
      onClose={onClose}
      title={currentFile.name}
      subtitle={`${currentFile.type || 'Unknown type'} • ${formatFileSize(currentFile.size)}`}
      icon={getFileIcon(currentFile.name, currentFile.type)}
      showDownload={true}
      showOpenInNewTab={pdfUrl ? true : false}
      onDownload={handleDownload}
      onOpenInNewTab={handleOpenInNewTab}
      hasGallery={isGalleryMode}
      currentIndex={currentIndex}
      totalItems={gallery.length}
      onNext={goToNext}
      onPrevious={goToPrevious}
      onGoToIndex={goToIndex}
      thumbnails={thumbnails}
    >
      {renderContent()}
    </PreviewModal>
  );
};