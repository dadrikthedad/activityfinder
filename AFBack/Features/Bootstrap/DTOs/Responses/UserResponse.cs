namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class UserResponse
{
    public required string Id { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string FullName { get; init; }
    public string? ProfileImageUrl { get; init; }
    public string? Email { get; init; }
    public string? PhoneNumber { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? OnBoardingCompletedAt { get; init; }
}
