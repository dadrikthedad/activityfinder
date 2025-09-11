export interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

export interface ThumbnailResult {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface ProcessedFileWithThumbnail {
  original: {
    buffer: ArrayBuffer;
    metadata: {
      name: string;
      type: string;
      size: number;
      uri: string;
    };
  };
  thumbnail?: ThumbnailResult;
}