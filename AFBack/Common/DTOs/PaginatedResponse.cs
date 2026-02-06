namespace AFBack.Common.DTOs;

/// <summary>
/// Generisk paginert response som kan brukes på tvers av features
/// </summary>
/// <typeparam name="T">Typen som skal pagineres</typeparam>
public class PaginatedResponse<T>
{
    public List<T> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore => Page * PageSize < TotalCount;
}
