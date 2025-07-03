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
} as const;

// Frontend validering (kjører før API-kall)
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

// Type for alle tillatte filtyper
type AllowedFileType = typeof ALL_ALLOWED_TYPES[number];

// Sjekk om filtype er tillatt
export function isFileTypeAllowed(fileType: string): fileType is AllowedFileType {
  return (ALL_ALLOWED_TYPES as readonly string[]).includes(fileType);
}

// Formatér filstørrelse til lesbar tekst
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Identifiser filkategori basert på MIME-type
export function getFileTypeCategory(fileType: string): 'image' | 'document' | 'video' | 'unknown' {
  if ((ALLOWED_FILE_TYPES.images as readonly string[]).includes(fileType)) return 'image';
  if ((ALLOWED_FILE_TYPES.documents as readonly string[]).includes(fileType)) return 'document';
  if ((ALLOWED_FILE_TYPES.videos as readonly string[]).includes(fileType)) return 'video';
  return 'unknown';
}

// Sjekk om filen er et bilde
export function isImageFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.images as readonly string[]).includes(fileType);
}

// Sjekk om filen er et dokument
export function isDocumentFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.documents as readonly string[]).includes(fileType);
}

// Sjekk om filen er en video
export function isVideoFile(fileType: string): boolean {
  return (ALLOWED_FILE_TYPES.videos as readonly string[]).includes(fileType);
}

// Få ikon-navn basert på filtype (for UI)
export function getFileIcon(fileType: string): string {
  const category = getFileTypeCategory(fileType);
  
  switch (category) {
    case 'image': return '🖼️';
    case 'document': return '📄';
    case 'video': return '🎥';
    default: return '📎';
  }
}

// Konverter File array til accept string for input
export function getAcceptString(): string {
  return (ALL_ALLOWED_TYPES as readonly string[]).join(',');
}

// Få filstatistikk for en liste med filer (type-safe versjon)
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

// 🚨 Få detaljerte valideringsfeil for hver fil
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