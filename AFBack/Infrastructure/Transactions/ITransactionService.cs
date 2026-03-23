using AFBack.Common.Results;

namespace AFBack.Infrastructure.Transactions;

/// <summary>
/// Håndterer databasetransaksjoner. Alle SaveChangesAsync-kall fra services som deler
/// samme DbContext-instans er en del av transaksjonen og rulles tilbake ved feil
/// </summary>
public interface ITransactionService
{
    /// <summary>
    ///  Kjører en operasjon innenfor en databasetransaksjon og returnerer en verdi
    /// Committer ved suksess, ruller tilbake ved exception. Generisk for generisk Result
    /// </summary>
    Task<Result<T>> ExecuteAsync<T>(Func<CancellationToken, Task<Result<T>>> operation, CancellationToken ct = default,
        string callerName = "");

    /// <summary>
    /// Kjører en operasjon innenfor en databasetransaksjon uten returverdi.
    /// Committer ved suksess, ruller tilbake ved exception
    /// </summary>
    Task<Result> ExecuteAsync(Func<CancellationToken, Task<Result>> operation, CancellationToken ct = default,
        string callerName = "");
}
