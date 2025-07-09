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

export async function leaveGroup(conversationId: number): Promise<{ message: string } | null> {
  const url = `${API_BASE_URL}/api/groupconversation/leave-group`;
 
  console.log("🔴 Forlater gruppe:", url, { conversationId });
 
  return await fetchWithAuth<{ message: string }>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(conversationId), // Backend forventer bare int som body
  });
}

export async function updateGroupName(
  groupId: number,
  newName: string
): Promise<{ success: boolean } | null> {
  const url = `${API_BASE_URL}/api/groupconversation/update-group-name?groupId=${groupId}&newName=${encodeURIComponent(newName)}`;
  
  console.log("📝 Oppdaterer gruppenavn:", url, { groupId, newName });
  
  return await fetchWithAuth<{ success: boolean }>(url, {
    method: 'PUT',
  });
}

// Sletter en GroupRequest for å kunne bli invitert igjen
export async function deleteGroupRequest(conversationId: number): Promise<{ message: string } | null> {
  const url = `${API_BASE_URL}/api/groupconversation/group-request/${conversationId}`;
 
  console.log("🗑️ Sletter GroupRequest:", url, { conversationId });
 
  return await fetchWithAuth<{ message: string }>(url, {
    method: 'DELETE',
  });
}