// components/common/DocumentPreview.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";

interface DocumentPreviewProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentPreview = ({ file, isOpen, onClose }: DocumentPreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const overlay = useOverlay();

  // 🆕 Get syntax highlighting class based on file extension
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

  // 🆕 Get appropriate file icon
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

  // Read file content
  useEffect(() => {
    if (!isOpen || !file) return;

    setIsLoading(true);
    setError('');

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as string;
      setContent(result);
      setIsLoading(false);
    };

    reader.onerror = () => {
      setError('Kunne ikke lese filen');
      setIsLoading(false);
    };

    // 🆕 Handle different file types with better logic
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    if (fileType.includes('word') || fileName.endsWith('.docx')) {
      setError('Word-filer kan ikke forhåndsvises. Klikk "Last ned" for å åpne filen.');
      setIsLoading(false);
    } else if (fileType === 'application/pdf') {
      setError('PDF-filer kan ikke forhåndsvises direkte. Klikk "Last ned" for å åpne filen.');
      setIsLoading(false);
    } else if (file.size > 1024 * 1024) { // 1MB limit
      setError('Filen er for stor for forhåndsvisning (maks 1MB). Klikk "Last ned" for å åpne filen.');
      setIsLoading(false);
    } else {
      // Try to read as text for all other supported files
      reader.readAsText(file);
    }
  }, [file, isOpen]);

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

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          className="bg-white dark:bg-zinc-900 rounded-lg max-w-4xl max-h-[90vh] w-full h-auto overflow-hidden pointer-events-auto shadow-2xl"
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
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(file.name, file.type)}</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {file.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {file.type || 'Unknown type'} • {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
          <div className="p-4 overflow-auto max-h-[70vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Laster innhold...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">⚠️</div>
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-[#1C6B1C] text-white rounded hover:bg-[#0F3D0F] transition-colors"
                >
                  Last ned fil
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-800 dark:text-gray-200">
                <pre className={`whitespace-pre-wrap font-mono text-xs leading-relaxed bg-gray-50 dark:bg-gray-800 p-4 rounded border overflow-x-auto ${getSyntaxClass(file.name)}`}>
                  {content}
                </pre>
                
                {/* 🆕 File info */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Fil info:</span>
                    <span>{content.split('\n').length} linjer • {content.length} tegn</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="text-xs text-gray-500 text-center">
              Press ESC to close • Click Download to download file
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};