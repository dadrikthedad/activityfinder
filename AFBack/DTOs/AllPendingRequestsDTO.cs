namespace AFBack.DTOs
{
    public class AllPendingRequestsDTO
    {
        public List<MessageRequestDTO> MessageRequests { get; set; } = new();
        public List<GroupInviteRequestDTO> GroupInvites { get; set; } = new();
    }
}
