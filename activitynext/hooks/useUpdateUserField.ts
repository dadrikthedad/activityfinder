// hooks/useUpdateUserField.ts
import { useState } from "react";
import { updateUser } from "../services/updateUser";
import { useAuth } from "../context/AuthContext";

export function useUpdateUserField() {
  const { token } = useAuth();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const updateField = async (
    field: keyof typeof updateUser,
    value: any
  ): Promise<boolean> => {
    if (!token) {
      setError("You are not authenticated.");
      return false;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      await updateUser[field](value, token);
      setSuccess(true);
      return true;
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { updateField, isSubmitting, error, success };
}