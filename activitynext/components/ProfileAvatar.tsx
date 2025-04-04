"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog } from "@headlessui/react";
import { useAuth } from "@/context/AuthContext";
import { updateProfileImage } from "@/services/profile"; // 👈 Lag denne under
import { cn } from "../lib/utils"; // hvis du bruker tailwind-helpers
import FormButton from "@/components/FormButton";
import ProfileNavButton from "@/components/settings/ProfileNavButton";

interface Props {
  imageUrl: string;
  size?: number;
  isEditable?: boolean;
  refetchProfile?: () => Promise<void>;
}

export default function ProfileAvatar({
  imageUrl,
  isEditable = false,
  refetchProfile,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const file = e.target.files[0];
        setSelectedFile(file);
        setSelectedFileName(file.name);
        setPreviewUrl(URL.createObjectURL(file)); // 👈 SET PREVIEW
      };

      const uploadImage = async () => {
        if (!selectedFile || !token) return;
        const formData = new FormData();
        formData.append("image", selectedFile);
      
        try {
          setUploading(true);
          await updateProfileImage(formData, token);
          await refetchProfile?.();
          setIsOpen(false);
          setSelectedFile(null);
          setSelectedFileName("");
          setPreviewUrl(null);
        } catch (err) {
          console.error("❌ Failed to upload image:", err);
        } finally {
          setUploading(false);
        }
      };

      const handleCancelUpload = () => {
        setSelectedFile(null);
        setSelectedFileName("");
        setPreviewUrl(null);
      };

  return (
    <>
      <div
  onClick={() => setIsOpen(true)}
  className={cn(
    "cursor-pointer rounded-full border-4 border-green-700 shadow-md overflow-hidden",
    "w-48 h-48" // 👈 FIKSET: fast kvadratisk størrelse
  )}
>
  <Image
    src={imageUrl}
    alt="Profile"
    width={192}
    height={192}
    className="object-cover w-full h-full rounded-full" // 👈 FIKSET: rund form
  />
</div>


            {isEditable && (
            <div className="w-full flex justify-center">
                <ProfileNavButton
                    text="Edit Profile Picture"
                    variant="long"
                    onClick={() => setIsOpen(true)}
                    />
            </div>
            )}

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="fixed z-50 inset-0">
        <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-zinc-900 p-6 rounded-lg max-w-[90vw] max-h-[90vh] w-auto h-auto text-center overflow-auto">
            <Image
                src={previewUrl || imageUrl}
                alt="Enlarged profile"
                width={1000}
                height={1000}
                className="rounded-xl mx-auto object-contain max-w-full max-h-[80vh]"
            />

            {isEditable && (
                <div className="mt-6">
                {/* Hidden file input */}
                <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {/* Styled label that opens file picker */}
                <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-sm text-white bg-green-700 hover:bg-green-800 px-4 py-2 rounded inline-block"
                >
                    Upload New Profile Picture
                </label>

                {/* Show filename if selected */}
                {selectedFileName && (
                    <p className="text-sm mt-4 text-white">{selectedFileName}</p>
                )}
                </div>
            )}

            {/* Buttons */}
            <div className="mt-6 flex justify-center gap-4">
                {selectedFile ? (
                <>
                    <FormButton
                    text={uploading ? "Saving..." : "Save"}
                    type="button"
                    onClick={uploadImage}
                    disabled={uploading}
                    className="px-6 py-2"
                    />
                    <FormButton
                    text="Cancel"
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-6 py-2 bg-gray-500 hover:bg-gray-600"
                    />
                </>
                ) : (
                <FormButton
                    text="Close"
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-2"
                />
                )}
            </div>
        </Dialog.Panel>

        </div>
      </Dialog>
    </>
  );
}
