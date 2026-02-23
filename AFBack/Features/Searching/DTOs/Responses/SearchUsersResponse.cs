namespace AFBack.Features.Searching.DTOs.Responses;

public class SearchUsersResponse
{
    public List<UserSearchResult> Users { get; set; } = [];
    public string? NextCursor { get; set; }
    public bool HasMore { get; set; }
}
