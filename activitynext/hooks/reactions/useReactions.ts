import { useState } from "react";
import { addReaction, removeReaction, ReactionRequest } from "@/services/messages/reactionService";

export function useReactions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddReaction = async (reaction: ReactionRequest) => {
    setLoading(true);
    setError(null);
    try {
      await addReaction(reaction);
      console.log(`✅ Reaksjon '${reaction.emoji}' sendt for melding ${reaction.messageId}`);
    } catch (err: unknown) {
    if (err instanceof Error) {
        setError(err.message || "Noe gikk galt ved å legge til reaksjon.");
    } else {
        setError("Ukjent feil ved å legge til reaksjon.");
    }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    setLoading(true);
    setError(null);
    try {
      await removeReaction(messageId, emoji);
    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message || "Noe gikk galt ved å fjerne reaksjon.");
        } else {
            setError("Ukjent feil ved å fjerne reaksjon.");
        }
        } finally {
      setLoading(false);
    }
  };

  return {
    addReaction: handleAddReaction,
    removeReaction: handleRemoveReaction,
    loading,
    error,
  };
}