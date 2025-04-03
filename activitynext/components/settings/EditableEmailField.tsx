"use client";
import { useState } from "react";
import { FieldName, validateSingleField } from "@/utils/validators";
import EditableButtons from "./EditableButtons";
import { useAuth } from "@/context/AuthContext";
import { updateEmail } from "@/services/security";
import PasswordField from "@/components/PasswordField";

interface EditableEmailFieldProps {
  email: string;
}

export default function EditableEmailField({ email }: EditableEmailFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAuth();

  const handleSave = async () => {
    const validationError = validateSingleField("email" as FieldName, inputValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!currentPassword || currentPassword.length < 4) {
      setError("Current password is required.");
      return;
    }

    if (!token) {
      setError("Not authenticated");
      return;
    }

    setIsSaving(true);
    try {
      await updateEmail(inputValue, currentPassword, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setError(null);
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
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(email);
    setCurrentPassword("");
    setEditing(false);
    setError(null);
  };

  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4">
      <div className="font-medium text-right pr-2 text-white">Email:</div>

      <div className="flex flex-col items-center gap-4">
        {editing ? (
          <>
            <input
                type="email"
                className={`w-[280px] h-12 px-4 pr-16 border rounded-md text-center ${
                    error ? "border-red-500" : "border-gray-500"
                } bg-gray-700 text-white`}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
              }}
              disabled={isSaving}
              placeholder="New email"
            />

            <PasswordField
              id="currentPassword"
              label="Current Password:"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(null);
              }}
              error={error || undefined}
              placeholder="Confirm with password"
            />
          </>
        ) : (
          <span className="block w-[280px] text-center text-white">{email}</span>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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