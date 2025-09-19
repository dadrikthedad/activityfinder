// features/crypto/storage/utils/cacheKeyUtils.ts

export const generateCacheKey = (url: string): string => {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  
  // Returner hele filnavnet minus .enc, med sanitizing
  const baseName = filename.replace('.enc', '');
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
};