"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadProfileImage } from "@/services/profile";

export function useUploadProfileImage() {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const upload = async (file: File): Promise<string | null> => {
    if (!token) {
      setError("Not authenticated");
      return null;
    }

    setUploading(true);
    setError(null);
    setImageUrl(null);

    try {
      const uploadedUrl = await uploadProfileImage(file, token);
      setImageUrl(uploadedUrl);
      return uploadedUrl;
    } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error occurred");
        }
        return null;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setImageUrl(null);
    setError(null);
  };

  return {
    upload,
    uploading,
    error,
    imageUrl,
    reset,
  };
}
