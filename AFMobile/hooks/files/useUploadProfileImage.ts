import { useState } from "react";
import { uploadProfileImage, removeProfileImage } from "@/services/files/fileService";
import { RNFile } from "@/utils/files/FileFunctions";
import { useUserCacheStore } from "@/store/useUserCacheStore";

export function useUploadProfileImage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, setCurrentUser } = useUserCacheStore();

  const upload = async (file: RNFile | "delete"): Promise<string | null> => {
    setUploading(true);
    setError(null);

    try {
      if (file === "delete") {
        await removeProfileImage();
        if (currentUser) {
          setCurrentUser({ ...currentUser, profileImageUrl: null });
        }
        return null;
      }

      const url = await uploadProfileImage(file);
      if (currentUser && url) {
        setCurrentUser({ ...currentUser, profileImageUrl: url });
      }
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => setError(null);

  return { upload, uploading, error, reset };
}
