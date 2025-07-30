namespace AFBack.Extensions;

public class SyncEventExtensions
{
    // Helper classes
    public class SyncToken
    {
        public DateTime Timestamp { get; set; }
        public int Version { get; set; }
        public int Random { get; set; } // Legg til random-verdien
        public string Hash { get; set; } = string.Empty;
    }
}
