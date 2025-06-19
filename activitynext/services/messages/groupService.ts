import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";
import { SendGroupRequestsDTO, SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";

// Service function to send group requests/invitations
export async function sendGroupRequests(
  request: SendGroupRequestsDTO
): Promise<SendGroupRequestsResponseDTO | null> {
  const url = `${API_BASE_URL}/api/groupconversation/send-requests`;
  
  console.log("🔵 Sender gruppe-invitasjoner:", url, request);
  
  return await fetchWithAuth<SendGroupRequestsResponseDTO>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}