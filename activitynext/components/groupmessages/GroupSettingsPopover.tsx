"use client";
import React from "react";
import { createPortal } from "react-dom";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import ProfileNavButton from "../settings/ProfileNavButton";
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { useGroupSettingsPopover } from "./useGroupSettingsPopover";

interface GroupSettingsPopoverProps {
  user: UserSummaryDTO; // Group info
  conversationId: number;
  position: { x: number; y: number };
  onClose: () => void;
  zIndex?: number;
  overlayRef?: (element: HTMLElement | null) => void;
}

export default React.memo(function GroupSettingsPopover({
  user,
  conversationId,
  position,
  onClose,
  zIndex,
  overlayRef
}: GroupSettingsPopoverProps) {
  
  const {
    groupImageUrl,
    uploadingImage,
    uploadError,
    handleImageUpload,
    triggerImageUpload,
    isEditingGroupName,
    tempGroupName,
    updatingGroupName,
    handleStartEditGroupName,
    handleCancelEditGroupName,
    handleSaveGroupName,
    setTempGroupName,
    groupNameError,
    displayName,
  } = useGroupSettingsPopover({
    user,
    conversationId,
    onClose
  });

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        zIndex: zIndex || 1003, // Higher than UserActionPopover
      }}
    >
      <div className="w-80 bg-white dark:bg-[#1e2122] shadow-lg rounded-xl p-6 border-2 border-[#1C6B1C]">
        {/* Header */}
        <div className="relative mb-4">
          <h3 className="text-lg font-semibold text-center">Group Settings</h3>
          <ProfileNavButton
            onClick={onClose}
            text="X"
            variant="smallx"
            className="absolute -top-2 -right-2 text-gray-500 hover:text-gray-700 text-lg font-bold flex items-center justify-center"
            aria-label="Close"
          />
        </div>

        {/* Group Image and Name */}
        <div className="flex flex-col items-center mb-6">
          <EnlargeableImage 
            src={groupImageUrl || user.profileImageUrl || "/default-group.png"}
            size={100} 
          />
          <div className="mt-3 text-center">
            <p className="text-lg font-semibold break-words">{displayName}</p>
          </div>
        </div>

        {/* Settings Actions */}
        <div className="space-y-3">
          {/* Hidden file input for image upload */}
          <input
            id="group-image-upload-settings"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            disabled={uploadingImage}
          />

          {/* Change Image button */}
          <ProfileNavButton
            text={uploadingImage ? "Uploading..." : "Change Group Image"}
            onClick={triggerImageUpload}
            variant="small"
            className="w-full bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
            disabled={uploadingImage}
          />

          {uploadError && (
            <p className="text-red-500 text-xs mt-2">{uploadError}</p>
          )}

          {/* Group name editing */}
          {isEditingGroupName ? (
            <div className="space-y-3">
              <input
                type="text"
                value={tempGroupName}
                onChange={(e) => setTempGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={100}
                className="w-full p-3 border-1 rounded dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none"
                disabled={updatingGroupName}
                autoFocus
              />
              <div className="flex gap-2">
                <ProfileNavButton
                  text={updatingGroupName ? "Saving..." : "Save"}
                  onClick={handleSaveGroupName}
                  variant="small"
                  className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white flex-1"
                  disabled={updatingGroupName || !tempGroupName?.trim()}
                />
                <ProfileNavButton
                  text="Cancel"
                  onClick={handleCancelEditGroupName}
                  variant="small"
                  className="bg-gray-500 hover:bg-gray-600 text-white flex-1"
                  disabled={updatingGroupName}
                />
              </div>
              {groupNameError && (
                <p className="text-red-500 text-xs mt-2">{groupNameError}</p>
              )}
            </div>
          ) : (
            <ProfileNavButton
              text="Change Group Name"
              onClick={handleStartEditGroupName}
              variant="small"
              className="w-full bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});