"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog } from "@headlessui/react";
import { cn } from "../lib/utils";
import FormButton from "@/components/FormButton";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { useUploadProfileImage } from "@/hooks/useUploadProfileImage";

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const {
        upload,
        uploading,
        error,
        reset: resetUpload,
      } = useUploadProfileImage();
    
      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const file = e.target.files[0];
        setSelectedFile(file);
        setSelectedFileName(file.name);
        setPreviewUrl(URL.createObjectURL(file));
      };
    
      const handleUpload = async () => {
        if (!selectedFile) return;
        const uploadedUrl = await upload(selectedFile);
        if (uploadedUrl) {
          await refetchProfile?.();
          handleClose();
        }
      };
    
      const handleClose = () => {
        setIsOpen(false);
        setSelectedFile(null);
        setSelectedFileName("");
        setPreviewUrl(null);
        resetUpload();
      };

      return (
        <>
          <div
            onClick={() => setIsOpen(true)}
            className={cn(
              "cursor-pointer rounded-full border-4 border-green-700 shadow-md overflow-hidden",
              "w-48 h-48"
            )}
          >
            <Image
              src={imageUrl}
              alt="Profile"
              width={192}
              height={192}
              className="object-cover w-full h-full rounded-full"
            />
          </div>
    
          {isEditable && (
            <div className="flex justify-center mt-4">
              <ProfileNavButton
                text="Edit Profile Picture"
                variant="long"
                onClick={() => setIsOpen(true)}
              />
            </div>
          )}
    
          <Dialog open={isOpen} onClose={handleClose} className="fixed z-50 inset-0">
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
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer text-sm text-white bg-green-700 hover:bg-green-800 px-4 py-2 rounded inline-block"
                    >
                      Upload New Profile Picture
                    </label>
                    {selectedFileName && (
                      <p className="text-sm mt-4 text-white">{selectedFileName}</p>
                    )}
                    {error && (
                      <p className="text-red-500 text-sm mt-2">{error}</p>
                    )}
                  </div>
                )}
    
                <div className="mt-6 flex justify-center gap-4">
                  {selectedFile ? (
                    <>
                      <FormButton
                        text={uploading ? "Saving..." : "Save"}
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="px-6 py-2"
                      />
                      <FormButton
                        text="Cancel"
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-2 bg-gray-500 hover:bg-gray-600"
                      />
                    </>
                  ) : (
                    <FormButton
                      text="Close"
                      type="button"
                      onClick={handleClose}
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
