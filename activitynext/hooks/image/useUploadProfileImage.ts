// hooken for å oppdatere profilbilde, brukes i editprofile og profileavatar
// sjekker autentisering, setter loading-state, kaller uploadProfileImage (fra services/profile.ts), lagrer bilde-URL og returnerer den. fanger og viser feil og stopper uploading til slutt
"use client";
import { useState } from "react";
import { uploadProfileImage } from "@/services/common/imageService";

export function useUploadProfileImage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);
    setImageUrl(null);

    try {
      const uploadedUrl = await uploadProfileImage(file); // 👈 Ingen token lenger
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
