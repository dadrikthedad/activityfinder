export const generateCacheKey = (url: string): string => {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  
  const baseName = filename.replace('.enc', '');
  const nameParts = baseName.split('_');
  
  if (nameParts.length >= 2) {
    return `${nameParts[0]}_${nameParts[1]}`;
  }
  
  return baseName;
};