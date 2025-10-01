namespace AFBack.Infrastructure.DTO;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    
    // Her kommer responsene/DTOen til frontend
    public T? Data { get; set; }
    
    // Validations errors. Key = feltNavn, Value = error Message
    public Dictionary<string, string[]>? Errors { get; set; }
    
   // TraceId for debugging
    public string? TraceId { get; set; }
}