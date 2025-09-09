export interface DecryptedAttachment {
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSize?: number;
  isEncrypted: boolean;
}

export interface EncryptedAttachmentData {
  keyInfo: { [userId: string]: string };
  iv: string;
  version?: number;
  encryptedFileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  uri: string;
}

export interface ProcessedFile {
  buffer: ArrayBuffer;
  metadata: FileMetadata;
}

export interface EncryptedFileResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
  encryptedFileData: string;
}


export interface EncryptionOptions {
  onProgress?: (progress: number) => void;
  onFileProgress?: (fileIndex: number, totalFiles: number, fileName: string) => void;
}

export interface EncryptedFile {
  encryptedData: string;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
}