// API-kall til backend SendInvitations i FriendInvitationsController.cs. Brukes til å sende en venneforespørsel fra innlogged bruker til en annen bruker
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";

interface SendFriendRequestDTO {
  receiverId: number;
}

export async function sendFriendInvitation(
  receiverId: number,
  token: string
): Promise<string> {
  const url = `${API_BASE_URL}/api/friendinvitations`;
  const body: SendFriendRequestDTO = { receiverId };

  try {
    const response = await fetchWithAuth<string>(
      url,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token
    );

    return response ?? "Friend request sent.";
  } catch (err) {
    console.error("❌ Failed to send friend request:", err);
    throw err;
  }
}

