// Feltene som man endrer feks navnfeltene, phone, postalcode osv. i profilesettings. Bruker EditableButton.tsx som mal
"use client";
import { useState } from "react";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import EditableButtons from "./EditableButtons";

interface EditableFieldProps {
  name: FieldName; 
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
}

export default function EditableField({ name, label, value, onSave }: EditableFieldProps) {
  const [editing, setEditing] = useState(false); // redigerinsmodus
  const [inputValue, setInputValue] = useState(value); // Verdien brukeren skriver inn i input-feltet (starter med value)
  const [isSaving, setIsSaving] = useState(false); // Viser om feltet er i ferd med å lagres (viser f.eks. "Saving...")
  const [saved, setSaved] = useState(false);  // Midlertidig flagg som viser "✓ Saved" etter vellykket lagring
  const [error, setError] = useState<string | null>(null); // 	Feilmelding hvis validering mislykkes (f.eks. tomt felt)

  const handleSave = async () => {
    const validationError = validateSingleField(name, inputValue); //validerer først
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
  // Hvis man abryter
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