// ResetPasswordFields.tsx - Spesielt for password reset (glemt passord)
"use client";
import { useState } from "react";
import PasswordField from "@/components/PasswordField";
import { validateSingleField } from "@shared/utils/validators";

interface ResetPasswordFieldsProps {
  onSubmit: (newPassword: string, confirmPassword: string) => Promise<void>;
  isLoading: boolean;
}

export default function ResetPasswordFields({ onSubmit, isLoading }: ResetPasswordFieldsProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validering
    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Kall parent component sin submit funksjon
    try {
      await onSubmit(newPassword, confirmPassword);
      setError(null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PasswordField
        id="newPassword"
        label="New Password"
        value={newPassword}
        onChange={(e) => {
          setNewPassword(e.target.value);
          setError(null);
        }}
        placeholder="Enter new password"
        error={error || undefined}
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          setError(null);
        }}
        placeholder="Confirm new password"
        error={error || undefined}
      />

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '15px',
          color: '#dc2626',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isLoading || !newPassword || !confirmPassword}
        style={{
          width: '100%',
          padding: '16px',
          background: isLoading || !newPassword || !confirmPassword ? '#9ca3af' : '#1C6B1C',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: isLoading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
          transition: 'background 0.3s'
        }}
      >
        {isLoading ? "Updating..." : "Update Password"}
      </button>
    </div>
  );
}