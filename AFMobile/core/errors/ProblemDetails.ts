// core/errors/ProblemDetails.ts
//
// Tilsvarer AppProblemDetails i AFBack (Common/Results/AppProblemDetails.cs).
// Backend returnerer alltid dette formatet ved feil (via BaseController.HandleFailure).
//
// AppProblemDetails (domenefeil via HandleFailure):
// {
//   "title": "Authentication Error",
//   "status": 401,
//   "detail": "Email address is not yet verified.",
//   "code": 2002
// }
//
// Standard ProblemDetails (GlobalExceptionHandler — uventede feil):
// {
//   "title": "Server Error",
//   "status": 500,
//   "detail": "An unexpected error occurred."
// }
//
// ValidationProblemDetails (DataAnnotations — automatisk fra ASP.NET Core):
// {
//   "title": "One or more validation errors occurred.",
//   "status": 422,
//   "errors": {
//     "Password": ["Password must be at least 8 characters"],
//     "Email": ["Email must be a valid format"]
//   }
// }

import { AppErrorCode } from "@shared/types/error/AppErrorCode";

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  // Domenespesifikk feilkode fra AppProblemDetails — ikke alltid tilstede
  // (GlobalExceptionHandler og DataAnnotations sender ikke denne)
  code?: number;
  errors?: Record<string, string[]>;
}

/**
 * Leser feilmelding fra et ProblemDetails-objekt.
 * Prioriterer: detail → første valideringsfeil → title → fallback
 */
export function getProblemDetail(problem: ProblemDetails, fallback = "An unexpected error occurred."): string {
  if (problem.detail) return problem.detail;

  // ValidationProblemDetails — flatt ut errors til én streng
  if (problem.errors) {
    const firstError = Object.values(problem.errors).flat()[0];
    if (firstError) return firstError;
  }

  if (problem.title) return problem.title;

  return fallback;
}

/**
 * Spesialfeil som bærer med seg HTTP-statuskoden og AppErrorCode fra backend.
 * Gjør at mapXxxError kan switche på appCode i stedet for å string-matche feilmeldinger.
 *
 * appCode = AppErrorCode fra "code"-feltet i AppProblemDetails.
 *   → Tilstede ved domenefeil via HandleFailure (f.eks. 2002 = EmailNotConfirmed)
 *   → AppErrorCode.Unknown ved uventede feil (GlobalExceptionHandler) eller nettverksfeil
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly appCode: AppErrorCode = AppErrorCode.Unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parser en Response til ProblemDetails og kaster en ApiError med melding, statuskode og appCode.
 * Brukes i baseService der backend alltid returnerer ProblemDetails ved feil.
 */
export async function throwProblemDetails(response: Response, fallback?: string): Promise<never> {
  const problem: ProblemDetails = await response.json().catch(() => ({}));
  const message = getProblemDetail(problem, fallback ?? `HTTP ${response.status}`);
  const appCode: AppErrorCode = problem.code ?? AppErrorCode.Unknown;
  throw new ApiError(message, response.status, appCode);
}
