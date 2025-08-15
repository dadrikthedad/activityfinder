export const getDecodedFileName = (fileName: string | undefined): string => {
  if (!fileName) return 'Unnamed file';
  
  try {
    // Prøv å dekode URL-encodede tegn
    return decodeURIComponent(fileName);
  } catch (error) {
    // Hvis decoding feiler, returner original navn
    console.warn('Failed to decode filename:', fileName, error);
    return fileName;
  }
};