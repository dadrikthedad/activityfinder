// NavbarSettingsDropdown.tsx - Standalone settings dropdown for Navbar
"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import { useAuth } from "@/context/AuthContext";

interface NavbarSettingsDropdownProps {
  useOverlaySystem?: boolean; // ✅ Support for nested usage
}

export default function NavbarSettingsDropdown({
  useOverlaySystem = true // ✅ Default to true for standalone usage
}: NavbarSettingsDropdownProps) {

  const [isOpen, setIsOpen] = useState(false);
  const overlay = useOverlay();
  const router = useRouter();
  const { logout } = useAuth();

  // ✅ Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) {
      // When not using overlay system, register only when opening
      if (isOpen && !overlay.isOpen) {
        overlay.open();
      }
      return;
    }

    // Normal overlay state management
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay, useOverlaySystem]);

  // ✅ Auto-close when overlay system closes us externally
  useOverlayAutoClose(() => {
    setIsOpen(false);
  }, overlay.level ?? undefined);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleEditProfile = useCallback(() => {
    handleClose();
    router.push("/editprofile");
  }, [handleClose, router]);

  const handleSettings = useCallback(() => {
    handleClose();
    router.push("/profilesettings");
  }, [handleClose, router]);

  const handleLogout = useCallback(() => {
    handleClose();
    logout();
  }, [handleClose, logout]);

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="hover:bg-[#0F3D0F] p-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Settings"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div
          ref={overlay.ref}
          style={{ zIndex: overlay.zIndex }}
          className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-2 w-32 border-2 border-[#1C6B1C]"
        > 
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            onClick={handleEditProfile}
          >
            Edit Profile
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            onClick={handleSettings}
          >
            Settings
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}