// components/common/DocumentPreview.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";

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

// File type info function
const getFileTypeInfo = (fileType: string, fileName?: string) => {
  const type = fileType.toLowerCase();
  const name = fileName?.toLowerCase() || '';
  
  if (type.startsWith('image/')) {
    return { category: 'image', icon: '🖼️', color: 'text-blue-600' };
  }
  if (type.startsWith('video/')) {
    return { category: 'video', icon: '🎥', color: 'text-purple-600' };
  }
  if (type === 'application/pdf') {
    return { category: 'pdf', icon: '📄', color: 'text-red-600' };
  }
  
  // Enhanced file type detection
  if (name.endsWith('.js') || name.endsWith('.jsx')) {
    return { category: 'code', icon: '🟨', color: 'text-yellow-600' };
  }
  if (name.endsWith('.ts') || name.endsWith('.tsx')) {
    return { category: 'code', icon: '🔷', color: 'text-blue-600' };
  }
  if (name.endsWith('.json')) {
    return { category: 'data', icon: '📋', color: 'text-orange-600' };
  }
  if (name.endsWith('.html')) {
    return { category: 'web', icon: '🌐', color: 'text-orange-600' };
  }
  if (name.endsWith('.css') || name.endsWith('.scss')) {
    return { category: 'style', icon: '🎨', color: 'text-pink-600' };
  }
  if (name.endsWith('.py')) {
    return { category: 'code', icon: '🐍', color: 'text-green-600' };
  }
  if (name.endsWith('.java')) {
    return { category: 'code', icon: '☕', color: 'text-red-600' };
  }
  if (name.endsWith('.md')) {
    return { category: 'document', icon: '📝', color: 'text-blue-600' };
  }
  if (name.endsWith('.sql')) {
    return { category: 'database', icon: '🗃️', color: 'text-blue-600' };
  }
  if (name.endsWith('.log')) {
    return { category: 'log', icon: '📊', color: 'text-gray-600' };
  }
  if (name.endsWith('.env')) {
    return { category: 'config', icon: '🔐', color: 'text-green-600' };
  }
  if (name.endsWith('.dockerfile')) {
    return { category: 'config', icon: '🐳', color: 'text-blue-600' };
  }
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    return { category: 'document', icon: '📝', color: 'text-blue-600' };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return { category: 'spreadsheet', icon: '📊', color: 'text-green-600' };
  }
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
    return { category: 'presentation', icon: '📊', color: 'text-orange-600' };
  }
  
  if (type.includes('document') || type.includes('word') || type.includes('text')) {
    return { category: 'document', icon: '📝', color: 'text-green-600' };
  }
  
  return { category: 'other', icon: '📎', color: 'text-gray-600' };
};

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
  const overlay = useOverlay();

  // Gallery navigation
  const isGalleryMode = gallery.length > 1;
  const currentFile = isGalleryMode ? gallery[currentIndex]?.file || file : file;
  
  // Navigation functions
  const goToNext = () => {
    if (!isGalleryMode) return;
    const newIndex = (currentIndex + 1) % gallery.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  };

  const goToPrevious = () => {
    if (!isGalleryMode) return;
    const newIndex = (currentIndex - 1 + gallery.length) % gallery.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  };

  const goToIndex = (index: number) => {
    if (index >= 0 && index < gallery.length) {
      setCurrentIndex(index);
      onNavigate?.(index);
    }
  };

  // Get syntax highlighting class based on file extension
  const getSyntaxClass = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return 'language-javascript';
      case 'json':
        return 'language-json';
      case 'html':
        return 'language-html';
      case 'css':
      case 'scss':
        return 'language-css';
      case 'py':
        return 'language-python';
      case 'java':
        return 'language-java';
      case 'cpp':
      case 'c':
        return 'language-cpp';
      case 'php':
        return 'language-php';
      case 'sql':
        return 'language-sql';
      case 'xml':
        return 'language-xml';
      case 'yaml':
      case 'yml':
        return 'language-yaml';
      case 'md':
        return 'language-markdown';
      default:
        return 'language-text';
    }
  };

  // Get appropriate file icon
  const getFileIcon = (fileName: string, fileType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word')) return '📝';
    
    switch (ext) {
      case 'js':
      case 'jsx': return '🟨';
      case 'ts':
      case 'tsx': return '🔷';
      case 'json': return '📋';
      case 'html': return '🌐';
      case 'css':
      case 'scss': return '🎨';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'cpp':
      case 'c': return '⚙️';
      case 'php': return '🐘';
      case 'sql': return '🗃️';
      case 'xml': return '📰';
      case 'yaml':
      case 'yml': return '⚙️';
      case 'md': return '📝';
      case 'log': return '📊';
      case 'env': return '🔐';
      case 'gitignore': return '🚫';
      case 'dockerfile': return '🐳';
      default: return '📄';
    }
  };

  // Check if file can be previewed as text
  const canPreviewAsText = (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    // Text files that can be read directly
    return fileType === 'text/plain' || 
           fileName.endsWith('.txt') ||
           fileName.endsWith('.md') ||
           fileName.endsWith('.json') ||
           fileName.endsWith('.csv') ||
           fileName.endsWith('.xml') ||
           fileName.endsWith('.js') ||
           fileName.endsWith('.jsx') ||
           fileName.endsWith('.ts') ||
           fileName.endsWith('.tsx') ||
           fileName.endsWith('.css') ||
           fileName.endsWith('.scss') ||
           fileName.endsWith('.html') ||
           fileName.endsWith('.py') ||
           fileName.endsWith('.java') ||
           fileName.endsWith('.cpp') ||
           fileName.endsWith('.c') ||
           fileName.endsWith('.php') ||
           fileName.endsWith('.sql') ||
           fileName.endsWith('.log') ||
           fileName.endsWith('.yaml') ||
           fileName.endsWith('.yml') ||
           fileName.endsWith('.env') ||
           fileName.endsWith('.gitignore') ||
           fileName.endsWith('.dockerfile');
  };

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

  // Sync overlay state
  useEffect(() => {
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close]);

  useOverlayAutoClose(() => {
    onClose();
  }, overlay.level ?? undefined);

  // Keyboard handling with gallery navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case 'ArrowLeft':
          if (isGalleryMode) {
            e.preventDefault();
            e.stopPropagation();
            goToPrevious();
          }
          break;
        case 'ArrowRight':
          if (isGalleryMode) {
            e.preventDefault();
            e.stopPropagation();
            goToNext();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (isGalleryMode) {
            const index = parseInt(e.key) - 1;
            if (index < gallery.length) {
              e.preventDefault();
              e.stopPropagation();
              goToIndex(index);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isGalleryMode, gallery.length, goToPrevious, goToNext, goToIndex, onClose]);

  const handleDownload = () => {
    const url = URL.createObjectURL(currentFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const url = URL.createObjectURL(currentFile);
    window.open(url, '_blank');
    // Note: URL will be cleaned up when the tab is closed
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: overlay.zIndex,
        pointerEvents: 'auto'
      }}
    >
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/80 cursor-pointer"
        onClick={onClose}
        aria-hidden="true" 
      />
      
      {/* Modal content */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={overlay.ref}
          className="bg-white dark:bg-zinc-900 rounded-lg max-w-6xl max-h-[95vh] w-full h-auto overflow-hidden pointer-events-auto shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          {/* Gallery navigation arrows - outside content area */}
          {isGalleryMode && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                aria-label="Previous file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-20"
                aria-label="Next file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(currentFile.name, currentFile.type)}</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {currentFile.name}
                  {/* Gallery counter */}
                  {isGalleryMode && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({currentIndex + 1} of {gallery.length})
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {currentFile.type || 'Unknown type'} • {(currentFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <button
                  onClick={handleOpenInNewTab}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  Åpne i ny fane
                </button>
              )}
              <button
                onClick={handleDownload}
                className="px-3 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors text-sm"
              >
                Last ned
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Lukk
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Laster innhold...</span>
              </div>
            ) : error ? (
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
            ) : pdfUrl ? (
              // PDF Viewer
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
            ) : content ? (
              // Text content
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
            ) : getFileTypeInfo(currentFile.type, currentFile.name).category === 'image' ? (
              // Image viewer
              <div className="p-4 flex items-center justify-center">
                <img
                  src={URL.createObjectURL(currentFile)}
                  alt={currentFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                  onLoad={(e) => {
                    // Clean up the blob URL after image loads
                    setTimeout(() => {
                      URL.revokeObjectURL((e.target as HTMLImageElement).src);
                    }, 100);
                  }}
                />
              </div>
            ) : null}
          </div>

          {/* Gallery thumbnails for images */}
          {isGalleryMode && gallery.length <= 10 && gallery.some(item => getFileTypeInfo(item.file.type, item.file.name).category === 'image') && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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
                        <img
                          src={URL.createObjectURL(item.file)}
                          alt={item.file.name}
                          className="object-cover w-full h-full"
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
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="text-xs text-gray-500 text-center">
              Press ESC to close • Click Download to download file
              {pdfUrl && ' • PDF opens in browser viewer'}
              {isGalleryMode && ` • Use ← → arrow keys to navigate • Press 1-9 for quick navigation`}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};