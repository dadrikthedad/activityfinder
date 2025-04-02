"use client";
import { useState } from "react";
import { FieldName, validateSingleField } from "@/utils/validators";
import EditableButtons from "./EditableButtons";

interface EditableFieldProps {
  name: FieldName; 
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
}

export default function EditableField({ name, label, value, onSave }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const validationError = validateSingleField(name, inputValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(inputValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (err) {
      console.error("❌ Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value);
    setEditing(false);
    setError(null); // Nullstill feilmelding
  };

  return  (
    <>
      <div className="grid grid-cols-3 gap-4 items-center py-4">
  {/* 1. Label */}
  <div className="font-medium text-right pr-2">{label}</div>

  {/* 2. Value or input */}
  <div>
    {editing ? (
      <>
        <input
          type="text"
          className={`border rounded px-2 py-1 w-full text-center ${error ? "border-red-500" : "border-gray-500"} bg-gray-700 text-white`}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          disabled={isSaving}
        />
        {error && (
            <p className="text-red-500 text-sm mt-1 text-center w-full">{error}</p>
            )}
      </>
    ) : (
        <span className="block w-[280px] text-center">{value}</span>
    )}
  </div>

  {/* 3. Buttons */}
  <EditableButtons
    editing={editing}
    saved={saved}
    isSaving={isSaving}
    onEdit={() => setEditing(true)}
    onSave={handleSave}
    onCancel={handleCancel}
    />
</div>
    </>
  );
}