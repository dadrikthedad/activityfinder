// hooks/messages/useUpdateGroupName.ts
import { useState } from "react";
import { updateGroupName } from "@/services/messages/groupService";

export function useUpdateGroupName() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (groupId: number, newName: string): Promise<boolean> => {
    setUpdating(true);
    setError(null);
   
    try {
      const response = await updateGroupName(groupId, newName);
      if (response?.success) {
        return true;
      } else {
        setError("Failed to update group name");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    update,
    updating,
    error,
    reset
  };
}