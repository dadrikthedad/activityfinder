// Select field til dropdown på gender i profilesettings
"use client";
import { useState } from "react";
import { FieldName, validateSingleField } from "@/utils/validators";
import EditableButtons from "./EditableButtons";

interface EditableSelectFieldProps {
    name: FieldName;
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onSave: (newValue: string) => Promise<void>;
  }

export default function EditableSelectField({
  name,
  label,
  value,
  options,
  onSave,
}: EditableSelectFieldProps) {
  const [editing, setEditing] = useState(false); // Styrer om vi er i redigeringsmodus eller ikke (brukes for å vise input-felt)
  const [selectedValue, setSelectedValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);  // Viser om komponenten holder på å lagre – brukes til å disable knapper, vise spinner osv.
  const [saved, setSaved] = useState(false); // Viser "✓ Saved" etter en vellykket lagring – resettes etter 2 sekunder
  const [error, setError] = useState<string | null>(null); // Eventuell feilmelding som vises under inputfeltene, hvis validering feiler eller backend gir feil

  const handleSave = async () => { // Håndterer alt som skjer når man trykker på Save-knappen
    const validationError = validateSingleField(name, selectedValue);
    if (validationError) {
      setError(validationError);
      return;
    }
  
    setIsSaving(true);
    try {
      await onSave(selectedValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (err) {
      console.error("❌ Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };
  // Håndtere hvis vi avbryter
  const handleCancel = () => {
    setSelectedValue(value);
    setEditing(false);
    setError(null); // ← nullstill også error ved avbryt
  };

  return (
    <div className="py-4">
    <div className="grid grid-cols-3 gap-4 items-center">
      {/* Grid 1: Label */}
      <div className="font-medium text-right pr-2">{label}</div>
  
      {/* Grid 2: Select eller tekst */}
      <div className="text-left">
  {editing ? (
    <>
      <select
        className={`w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white text-center ${
          error ? "border-red-500" : "border-gray-500"
        }`}
        value={selectedValue}
        onChange={(e) => {
          setSelectedValue(e.target.value);
          setError(null); // nullstill error ved endring
        }}
        disabled={isSaving}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-red-500 text-sm mt-1 text-center w-full">{error}</p>
      )}
    </>
  ) : (
    <span className="block w-[280px] text-center">{value}</span>
  )}
</div>

  
      {/* Grid 3: Edit eller Save/Cancel */}
      <EditableButtons
        editing={editing}
        saved={saved}
        isSaving={isSaving}
        onEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
        />
    </div>
    </div>
  );
}
