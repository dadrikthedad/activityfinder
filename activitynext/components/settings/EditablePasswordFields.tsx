// Endre passord i securitycred, bruker editableButtons her og.
"use client";
import { useState } from "react";
import PasswordField from "@/components/PasswordField";
import EditableButtons from "./EditableButtons";
import { validateSingleField } from "@shared/utils/validators";
import { updatePassword } from "@/services/security";
import { useAuth } from "@/context/AuthContext";

export default function EditablePasswordFields() {
  const [editing, setEditing] = useState(false); // Styrer om vi er i redigeringsmodus eller ikke (brukes for å vise input-felt)
  const [currentPassword, setCurrentPassword] = useState(""); // Current passord
  const [newPassword, setNewPassword] = useState(""); // Nytt passord
  const [confirmPassword, setConfirmPassword] = useState(""); // Bekrefte at passord stemmer
  const [isSaving, setIsSaving] = useState(false); // Viser om komponenten holder på å lagre – brukes til å disable knapper, vise spinner osv.
  const [saved, setSaved] = useState(false); // Viser "✓ Saved" etter en vellykket lagring – resettes etter 2 sekunder
  const [error, setError] = useState<string | null>(null); // Eventuell feilmelding som vises under inputfeltene, hvis validering feiler eller backend gir feil

  const { token } = useAuth();
  // Validerer inputfeltene og kaller updatePassword hvis alt er OK. Viser evt. feil fra backend.
  const handleSave = async () => {
    if (!token) {
      setError("Not authenticated");
      return;
    }

    const passwordError = validateSingleField("password", newPassword); // Validerer passord
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) { // Hvis passord ikke matcher
      setError("Passwords do not match.");
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(currentPassword, newPassword, confirmPassword, token); //Oppdaterer passord til backend her
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setCurrentPassword(""); // Resetter feltene etter vi har lagret passordet
      setError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
        if (err instanceof Error) {
          try {
            const parsed = JSON.parse(err.message);
            if (
              typeof parsed === "object" &&
              parsed !== null &&
              "message" in parsed &&
              typeof (parsed as { message: unknown }).message === "string"
            ) {
              setError((parsed as { message: string }).message);
            } else {
              setError(err.message);
            }
          } catch {
            setError(err.message);
          }
        } else {
          setError("Something went wrong.");
        }
      } finally {
        setIsSaving(false); // 👉 dette kjøres uansett hva som skjer
      }
    };

  const handleCancel = () => { // Hvis vi avbryter
    setEditing(false);
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex flex-col items-center py-4">
      {!editing ? (
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="font-medium text-right pr-2 text-white">Password:</div>
          <span className="block w-[280px] text-center text-white">********</span>
          <EditableButtons
            editing={editing}
            saved={saved}
            isSaving={isSaving}
            onEdit={() => setEditing(true)}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="text-white text-center font-medium">Current Password:</div>
          <PasswordField
            id="currentPassword"
            label=""
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            placeholder="Current password"
          />
  
          <div className="text-white text-center font-medium">New Password:</div>
          <PasswordField
            id="newPassword"
            label=""
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            placeholder="New password"
          />
  
          <div className="text-white text-center font-medium">Confirm Password:</div>
          <PasswordField
            id="confirmPassword"
            label=""
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            placeholder="Repeat password"
          />
  
          {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
  
          {/* Buttons are now centered under all fields */}
          <EditableButtons
            editing={editing}
            saved={saved}
            isSaving={isSaving}
            onEdit={() => setEditing(true)}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
}
