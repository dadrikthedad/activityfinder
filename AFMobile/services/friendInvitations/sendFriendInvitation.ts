// AFMobile/services/sendFriendInvitationService.ts
// API-kall til backend SendInvitations i FriendInvitationsController.cs. Brukes til å sende en venneforespørsel fra innlogged bruker til en annen bruker
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

export interface SendFriendRequestDTO {
  receiverId: number;
}

// Endret responsen til å matche objektet fra backend
export interface SendFriendRequestResponse {
  message: string;
  autoAccepted?: boolean;
  conversationId?: number | null;
  friendUser?: UserSummaryDTO; // 🆕 Brukerdata ved auto-accept
}
 
export async function sendFriendInvitation(
  receiverId: number,
  token: string
): Promise<SendFriendRequestResponse> {
  const url = `${API_BASE_URL}/api/friendinvitations`;
  const body: SendFriendRequestDTO = { receiverId };
 
  try {
    const response = await fetchWithAuth<SendFriendRequestResponse>(
      url,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token
    );
    
    // 🔧 Håndter null response
    if (!response) {
      throw new Error("No response received from server");
    }
    
    return response;
  } catch (err) {
    console.error("❌ Failed to send friend request:", err);
    throw err;
  }
}