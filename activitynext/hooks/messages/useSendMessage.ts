// Hooken for å sende meldinger fra en bruker til en annen i chatten
"use client"
import { useState } from "react";
import { sendMessage } from "@/services/messages/messageService";
import { SendMessageRequestDTO, MessageDTO } from "@/types/MessageDTO";
import { useCurrentUserSummary } from "../user/useCurrentUserSummary";

export function useSendMessage(onSuccess?: (message: MessageDTO) => void) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useCurrentUserSummary();
  
    const send = async (payload: SendMessageRequestDTO) => {
      if (!user) return;
  
      setLoading(true);
      setError(null);
  
      try {
        const result = await sendMessage(payload);
  
        if (result) {
          // 👇 Legg til sender manuelt, siden backend ikke sender det med
          const enriched: MessageDTO = {
            ...result,
            sender: user,
          };
  
          onSuccess?.(enriched);
          return enriched;
        }
  
        return null;
      } catch (err: unknown) {
        let errorMessage = "Noe gikk galt";
  
        if (err instanceof Error) {
          try {
            const parsed = JSON.parse(err.message);
            errorMessage = parsed.details || parsed.message || err.message;
          } catch {
            errorMessage = err.message;
          }
        }
        
        console.error("❌ Feil ved sending av melding:", errorMessage);
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    };
  
    return { send, loading, error };
  }
