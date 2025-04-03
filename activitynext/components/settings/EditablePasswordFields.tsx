"use client";
import { useState } from "react";
import PasswordField from "@/components/PasswordField";
import EditableButtons from "./EditableButtons";
import { validateSingleField } from "@/utils/validators";
import { updatePassword } from "@/services/security";
import { useAuth } from "@/context/AuthContext";

export default function EditablePasswordFields() {
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAuth();

  const handleSave = async () => {
    if (!token) {
      setError("Not authenticated");
      return;
    }

    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(currentPassword, newPassword, confirmPassword, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
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

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4">
      <div className="font-medium text-right pr-2 pt-2 text-white">Password:</div>

      <div className="flex flex-col items-center gap-4 col-span-1">
        {editing ? (
          <>
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
          </>
        ) : (
          <span className="block w-[280px] text-center text-white">********</span>
        )}
      </div>

      <EditableButtons
        editing={editing}
        saved={saved}
        isSaving={isSaving}
        onEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
