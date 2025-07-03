// utils/fileUtils.ts
import { useState, useEffect } from "react";

// ===================================
// 🎯 CONSTANTS & TYPES
// ===================================

// Tillatte filtyper
export const ALLOWED_FILE_TYPES = {
  images: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  documents: [
    "application/pdf", 
    "text/plain", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ],
  videos: ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"]
} as const;

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.videos
] as const;

// Konstanter for begrensninger
export const FILE_LIMITS = {
  MAX_FILES: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_SIZE: 20 * 1024 * 1024, // 20MB
  PREVIEW_SIZE_LIMIT: 5 * 1024 * 1024, // 5MB for preview
} as const;

// Type definitions
type AllowedFileType = typeof ALL_ALLOWED_TYPES[number];

export interface FileTypeInfo {
  category: 'image' | 'video' | 'pdf' | 'code' | 'data' | 'web' | 'style' | 'database' | 'log' | 'config' | 'document' | 'spreadsheet' | 'presentation' | 'other';
  icon: string;
  color: string;
  validationCategory?: 'image' | 'document' | 'video' | 'unknown';
}

// ===================================
// 🔍 FILE TYPE DETECTION
// ===================================

/**
 * Get comprehensive file type information (combines MIME-type and extension detection)
 */
export const getFileTypeInfo = (fileType: string, fileName?: string): FileTypeInfo => {
  const type = fileType.toLowerCase();
  const name = fileName?.toLowerCase() || '';
  
  // Images (MIME-type based - most reliable)
  if (type.startsWith('image/')) {
    return { 
      category: 'image', 
      icon: '🖼️', 
      color: 'text-blue-600',
      validationCategory: 'image'
    };
  }
  
  // Videos (MIME-type based)
  if (type.startsWith('video/')) {
    return { 
      category: 'video', 
      icon: '🎥', 
      color: 'text-purple-600',
      validationCategory: 'video'
    };
  }
  
  // PDF (MIME-type based)
  if (type === 'application/pdf') {
    return { 
      category: 'pdf', 
      icon: '📄', 
      color: 'text-red-600',
      validationCategory: 'document'
    };
  }
  
  // Enhanced detection by file extension (for when MIME-type is generic)
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
    return { 
      category: 'document', 
      icon: '📝', 
      color: 'text-blue-600',
      validationCategory: 'document'
    };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return { category: 'spreadsheet', icon: '📊', color: 'text-green-600' };
  }
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
    return { category: 'presentation', icon: '📊', color: 'text-orange-600' };
  }
  if (name.endsWith('.yaml') || name.endsWith('.yml')) {
    return { category: 'config', icon: '⚙️', color: 'text-gray-600' };
  }
  if (name.endsWith('.xml')) {
    return { category: 'data', icon: '📰', color: 'text-orange-600' };
  }
  if (name.endsWith('.csv')) {
    return { category: 'data', icon: '📊', color: 'text-green-600' };
  }
  if (name.endsWith('.gitignore')) {
    return { category: 'config', icon: '🚫', color: 'text-gray-600' };
  }
  if (name.endsWith('.cpp') || name.endsWith('.c')) {
    return { category: 'code', icon: '⚙️', color: 'text-blue-600' };
  }
  if (name.endsWith('.php')) {
    return { category: 'code', icon: '🐘', color: 'text-purple-600' };
  }
  
  // MIME type fallbacks for validation categories
  if (type.includes('document') || type.includes('word') || type.includes('text')) {
    return { 
      category: 'document', 
      icon: '📝', 
      color: 'text-green-600',
      validationCategory: 'document'
    };
  }
  if (type.includes('spreadsheet') || type.includes('excel')) {
    return { category: 'spreadsheet', icon: '📊', color: 'text-green-600' };
  }
  if (type.includes('presentation') || type.includes('powerpoint')) {
    return { category: 'presentation', icon: '📊', color: 'text-orange-600' };
  }
  
  return { 
    category: 'other', 
    icon: '📎', 
    color: 'text-gray-600',
    validationCategory: 'unknown'
  };
};

/**
 * Get legacy validation category (for backward compatibility)
 */
export function getFileTypeCategory(fileType: string): 'image' | 'document' | 'video' | 'unknown' {
  if ((ALLOWED_FILE_TYPES.images as readonly string[]).includes(fileType)) return 'image';
  if ((ALLOWED_FILE_TYPES.documents as readonly string[]).includes(fileType)) return 'document';
  if ((ALLOWED_FILE_TYPES.videos as readonly string[]).includes(fileType)) return 'video';
  return 'unknown';
}

// ===================================
// 🔧 UTILITY FUNCTIONS
// ===================================

/**
 * Get appropriate file icon based on filename and file type
 */
export const getFileIcon = (fileName: string, fileType: string): string => {
  return getFileTypeInfo(fileType, fileName).icon;
};

/**
 * Get syntax highlighting class for code files
 */
export const getSyntaxClass = (fileName: string): string => {
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

/**
 * Format file size in a human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ===================================
// ✅ VALIDATION FUNCTIONS
// ===================================

/**
 * Check if file type is allowed for upload
 */
export function isFileTypeAllowed(fileType: string): fileType is AllowedFileType {
  return (ALL_ALLOWED_TYPES as readonly string[]).includes(fileType);
}

/**
 * Validate files before upload
 */
export function validateFiles(files: File[]): { isValid: boolean; error?: string } {
  if (files.length === 0) {
    return { isValid: false, error: "Ingen filer valgt" };
  }

  if (files.length > FILE_LIMITS.MAX_FILES) {
    return { isValid: false, error: `Maksimalt ${FILE_LIMITS.MAX_FILES} filer per melding` };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
    return {
      isValid: false,
      error: `Total størrelse (${formatFileSize(totalSize)}) overstiger ${formatFileSize(FILE_LIMITS.MAX_TOTAL_SIZE)}`
    };
  }

  for (const file of files) {
    if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `${file.name} (${formatFileSize(file.size)}) er større enn ${formatFileSize(FILE_LIMITS.MAX_FILE_SIZE)}`
      };
    }

    if (!isFileTypeAllowed(file.type)) {
      return {
        isValid: false,
        error: `Filtypen ${file.type} er ikke tillatt for ${file.name}`
      };
    }
  }

  return { isValid: true };
}

/**
 * Get detailed validation errors for each file
 */
export function getDetailedValidationErrors(files: File[]): Array<{
  file: File;
  errors: string[];
}> {
  return files.map(file => {
    const errors: string[] = [];
    
    if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
      errors.push(`Filen er for stor (${formatFileSize(file.size)} > ${formatFileSize(FILE_LIMITS.MAX_FILE_SIZE)})`);
    }
    
    if (!isFileTypeAllowed(file.type)) {
      errors.push(`Filtypen '${file.type}' er ikke tillatt`);
    }
    
    if (file.name.length > 255) {
      errors.push('Filnavnet er for langt (maks 255 tegn)');
    }
    
    return { file, errors };
  });
}

// ===================================
// 🎨 PREVIEW FUNCTIONS
// ===================================

/**
 * Check if file can be previewed as text
 */
export const canPreviewAsText = (file: File): boolean => {
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

/**
 * Check if file can be previewed (either as text, image, or PDF)
 */
export const canPreviewFile = (file: File): boolean => {
  const fileInfo = getFileTypeInfo(file.type, file.name);
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  // Images and PDFs can always be previewed
  if (fileInfo.category === 'image' || fileType === 'application/pdf') {
    return true;
  }
  
  // Text files can be previewed
  if (canPreviewAsText(file)) {
    return true;
  }
  
  // Office documents can be "previewed" (with download message)
  if (fileType.includes('word') || 
      fileType.includes('excel') ||
      fileType.includes('powerpoint') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.ppt')) {
    return true;
  }
  
  return false;
};

// ===================================
// 🪝 REACT HOOKS
// ===================================

/**
 * Hook for creating and managing image preview URLs
 */
export const useImagePreview = (file: File) => {
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
// 📊 STATISTICS & HELPER FUNCTIONS
// ===================================

/**
 * Create a File object from URL (useful for attachments)
 */
export const createFileFromUrl = async (
  url: string, 
  fileName: string, 
  mimeType: string
): Promise<File> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Ensure correct MIME type - use provided mimeType if blob.type is empty
    const finalMimeType = blob.type || mimeType;
    
    return new File([blob], fileName, {
      type: finalMimeType
    });
  } catch (error) {
    console.error('Error creating file from URL:', error);
    // Create a dummy file as fallback but with correct type
    return new File([''], fileName, {
      type: mimeType
    });
  }
};

/**
 * Create gallery data from file array
 */
export const createFileGallery = async (files: File[]): Promise<Array<{ file: File; src: string; alt?: string; fileName?: string }>> => {
  const images = files.filter(f => f.type.startsWith('image/'));
  
  return images.map((file) => ({
    file,
    src: URL.createObjectURL(file),
    alt: file.name,
    fileName: file.name
  }));
};

/**
 * Get file types summary for display
 */
export const getFileTypesSummary = (files: File[]): string => {
  const imageCount = files.filter(f => f.type.startsWith('image/')).length;
  const pdfCount = files.filter(f => f.type === 'application/pdf').length;
  const docCount = files.filter(f => 
    f.type.includes('word') || 
    f.name.toLowerCase().endsWith('.docx') || 
    f.name.toLowerCase().endsWith('.doc')
  ).length;
  const otherCount = files.length - imageCount - pdfCount - docCount;

  const parts = [];
  if (imageCount > 0) parts.push(`${imageCount} bilde${imageCount !== 1 ? 'r' : ''}`);
  if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? 'er' : ''}`);
  if (docCount > 0) parts.push(`${docCount} dokument${docCount !== 1 ? 'er' : ''}`);
  if (otherCount > 0) parts.push(`${otherCount} andre`);
  
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
};

/**
 * Get comprehensive file statistics
 */
export function getFileStats(files: File[]): {
  totalSize: number;
  totalSizeFormatted: string;
  fileCount: number;
  categories: {
    images: number;
    documents: number;
    videos: number;
    unknown: number;
  };
} {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const categories = {
    images: 0,
    documents: 0,
    videos: 0,
    unknown: 0
  };

  files.forEach(file => {
    const category = getFileTypeCategory(file.type);
    
    // Type-safe increment basert på category
    switch (category) {
      case 'image':
        categories.images++;
        break;
      case 'document':
        categories.documents++;
        break;
      case 'video':
        categories.videos++;
        break;
      case 'unknown':
        categories.unknown++;
        break;
      default:
        // TypeScript vil klage hvis vi glemmer en case
        categories.unknown++;
    }
  });

  return {
    totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    fileCount: files.length,
    categories
  };
}

// ===================================
// 🔍 LEGACY COMPATIBILITY
// ===================================

/**
 * Legacy function - use getFileTypeInfo().validationCategory === 'image' instead
 */
export function isImageFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.images as readonly string[]).includes(fileType);
}

/**
 * Legacy function - use getFileTypeInfo().validationCategory === 'document' instead
 */
export function isDocumentFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.documents as readonly string[]).includes(fileType);
}

/**
 * Legacy function - use getFileTypeInfo().validationCategory === 'video' instead
 */
export function isVideoFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.videos as readonly string[]).includes(fileType);
}

/**
 * Get accept string for file input
 */
export function getAcceptString(): string {
  return (ALL_ALLOWED_TYPES as readonly string[]).join(',');
}

/**
 * Get file extension from filename
 */
export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};