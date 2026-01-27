namespace AFBack.Features.Messaging.DTOs.Response;

public class MessagesResponse
{
    public List<MessageResponse> Messages { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore => Page * PageSize < TotalCount;
}
