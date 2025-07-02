// hooks/useUploadGroupImage.ts
"use client";
import { useState } from "react";
import { uploadGroupImage } from "@/services/common/imageService";

export function useUploadGroupImage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, groupId?: number): Promise<string | null> => {
    setUploading(true);
    setError(null);
    
    try {
      const uploadedUrl = await uploadGroupImage(file, groupId);
      return uploadedUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return { 
    upload, 
    uploading, 
    error, 
    reset 
  };
}