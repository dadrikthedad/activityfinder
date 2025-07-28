namespace AFBack.Extensions;

public class SyncEventExtensions
{
    // Helper classes
    public class SyncToken
    {
        public DateTime Timestamp { get; set; }
        public int Version { get; set; }
        public string Hash { get; set; }
    }
}