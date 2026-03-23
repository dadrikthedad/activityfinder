using Microsoft.AspNetCore.Mvc;

namespace AFBack.Common.Results;

/// <summary>
/// Utvidet ProblemDetails med domenespesifikk feilkode.
/// Brukes i stedet for standard ProblemDetails i alle API-feilsvar.
/// </summary>
public class AppProblemDetails : ProblemDetails
{
    /// <summary>
    /// Domenespesifikk feilkode. Speilet i frontend som AppErrorCode-enum.
    /// </summary>
    public int Code { get; set; }
}
