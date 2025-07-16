namespace AFBack.DTOs;

public class PaginatedMessageRequestsDTO
{
    public List<MessageRequestDTO> Requests { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public bool HasMore { get; set; }
}