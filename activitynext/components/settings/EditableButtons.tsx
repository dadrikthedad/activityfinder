// Editable knapper, brukes til alle komponentene med Editable i components/settings. Er knappene Save og Cancel i profilesettings og kanskje i Edit About Me og Edit Websites
"use client";
import React from "react";

interface EditableButtonsProps {
  editing: boolean;
  saved?: boolean;
  isSaving: boolean;
  disableSave?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function EditableButtons({
  editing,
  saved,
  isSaving,
  disableSave,
  onEdit,
  onSave,
  onCancel,
}: EditableButtonsProps) {
  return (
    <div className="flex gap-2 items-center justify-start">
      {editing ? (
        <>
          <button // Lagre knappen
            onClick={onSave}
            className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white font-semibold px-5 py-2 rounded text-sm w-[80px]"
            disabled={isSaving || disableSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button // Avbryt knappen
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-5 py-2 rounded text-sm"
            disabled={isSaving}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button //Edit knappen
            onClick={onEdit}
            className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white font-semibold px-5 py-2 rounded text-sm w-[160px]"
          >
            Edit
          </button>
          {saved && <span className="text-green-500 font-medium ml-2">✓ Saved</span>}
        </>
      )}
    </div>
  );
}