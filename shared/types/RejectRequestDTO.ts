export interface RejectRequestDTO {
  senderId: number;
  conversationId?: number | null; // Null/undefined = MessageRequest, satt = GroupRequest
}