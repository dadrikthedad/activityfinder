namespace AFBack.Interface;

public interface ICleanupTask
{
    string TaskName { get; }
    TimeSpan Interval { get; }
    TimeSpan InitialDelay { get; }
    Task ExecuteAsync(CancellationToken cancellationToken);
}