// components/files/FileFunctions.ts - React Native Version

// ===================================
// 🎯 CONSTANTS & TYPES
// ===================================

// React Native file interface
export interface RNFile {
  uri: string;
  type: string;
  name: string;
  size?: number; // Size in bytes
}

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
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB per fil
  MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50MB for videoer
  MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100MB total
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
  
  // Enhanced detection by file extension
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
 * Format file size in a human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
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
 * Validate files before upload (React Native version)
 */
export function validateFiles(files: RNFile[]): { isValid: boolean; error?: string } {
  if (files.length === 0) {
    return { isValid: false, error: "Ingen filer valgt" };
  }

  if (files.length > FILE_LIMITS.MAX_FILES) {
    return { isValid: false, error: `Maksimalt ${FILE_LIMITS.MAX_FILES} filer per melding` };
  }

  // Calculate total size (if size is available)
  const filesWithSize = files.filter(file => file.size !== undefined);
  if (filesWithSize.length > 0) {
    const totalSize = filesWithSize.reduce((sum, file) => sum + (file.size || 0), 0);
    
    if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
      return {
        isValid: false,
        error: `Total størrelse (${formatFileSize(totalSize)}) overstiger ${formatFileSize(FILE_LIMITS.MAX_TOTAL_SIZE)}`
      };
    }
  }

  for (const file of files) {
    // Check file size if available
    if (file.size !== undefined) {
      const isVideo = file.type.startsWith('video/');
      const maxFileSize = isVideo ? FILE_LIMITS.MAX_VIDEO_SIZE : FILE_LIMITS.MAX_FILE_SIZE;
      
      if (file.size > maxFileSize) {
        const fileType = isVideo ? 'Video' : 'Fil';
        return {
          isValid: false,
          error: `${fileType} "${file.name}" (${formatFileSize(file.size)}) er større enn ${formatFileSize(maxFileSize)}`
        };
      }
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
export function getDetailedValidationErrors(files: RNFile[]): Array<{
  file: RNFile;
  errors: string[];
}> {
  return files.map(file => {
    const errors: string[] = [];
    
    if (file.size !== undefined && file.size > FILE_LIMITS.MAX_FILE_SIZE) {
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
// 📊 STATISTICS & HELPER FUNCTIONS
// ===================================

/**
 * Get file types summary for display
 */
export const getFileTypesSummary = (files: RNFile[]): string => {
  const imageCount = files.filter(f => f.type.startsWith('image/')).length;
  const videoCount = files.filter(f => f.type.startsWith('video/')).length;
  const pdfCount = files.filter(f => f.type === 'application/pdf').length;
  const docCount = files.filter(f =>
    f.type.includes('word') ||
    f.name.toLowerCase().endsWith('.docx') ||
    f.name.toLowerCase().endsWith('.doc')
  ).length;
  const otherCount = files.length - imageCount - videoCount - pdfCount - docCount;

  const parts: string[] = []; // Eksplisitt type
  if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
  if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
  if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? 's' : ''}`);
  if (docCount > 0) parts.push(`${docCount} document${docCount !== 1 ? 's' : ''}`);
  if (otherCount > 0) parts.push(`${otherCount} other${otherCount !== 1 ? 's' : ''}`);

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
};

/**
 * Get comprehensive file statistics
 */
export function getFileStats(files: RNFile[]): {
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
  const filesWithSize = files.filter(file => file.size !== undefined);
  const totalSize = filesWithSize.reduce((sum, file) => sum + (file.size || 0), 0);
  
  const categories = {
    images: 0,
    documents: 0,
    videos: 0,
    unknown: 0
  };

  files.forEach(file => {
    const category = getFileTypeCategory(file.type);
    
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
 * Get accept string for file input (React Native doesn't use this, but kept for compatibility)
 */
export function getAcceptString(): string {
  return (ALL_ALLOWED_TYPES as readonly string[]).join(',');
}

// ===================================
// 📱 REACT NATIVE SPECIFIC FUNCTIONS
// ===================================

/**
 * Check if file can be displayed as image in React Native
 */
export const canDisplayAsImage = (file: RNFile): boolean => {
  return file.type.startsWith('image/');
};

/**
 * Check if file can be displayed as video in React Native
 */
export const canDisplayAsVideo = (file: RNFile): boolean => {
  return file.type.startsWith('video/');
};

/**
 * Get display name for file (truncated if too long)
 */
export const getDisplayFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName;
  
  const extension = getFileExtension(fileName);
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  const availableLength = maxLength - extension.length - 4; // -4 for "..." and "."
  
  return `${nameWithoutExt.substring(0, availableLength)}...${extension}`;
};