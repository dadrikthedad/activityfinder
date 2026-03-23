// core/errors/ProblemDetails.ts
//
// Tilsvarer Microsoft.AspNetCore.Mvc.ProblemDetails fra AFBack.
// Backend returnerer alltid dette formatet ved feil (via BaseController.HandleFailure).
//
// Standard ProblemDetails:
// {
//   "title": "Unauthorized",
//   "status": 401,
//   "detail": "Your email is not yet verified."
// }
//
// ValidationProblemDetails (DataAnnotations):
// {
//   "title": "One or more validation errors occurred.",
//   "status": 422,
//   "errors": {
//     "Password": ["Password must be at least 8 characters"],
//     "Email": ["Email must be a valid format"]
//   }
// }

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
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
 * Spesialfeil som bærer med seg HTTP-statuskoden fra ProblemDetails.
 * Gjør at mapLoginError og lignende kan skille på statuskode
 * i stedet for å string-matche feilmeldinger.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Parser en Response til ProblemDetails og kaster en ApiError med riktig melding og statuskode.
 * Brukes der vi vet at backend alltid returnerer ProblemDetails ved feil.
 */
export async function throwProblemDetails(response: Response, fallback?: string): Promise<never> {
  const problem: ProblemDetails = await response.json().catch(() => ({}));
  const message = getProblemDetail(problem, fallback ?? `HTTP ${response.status}`);
  throw new ApiError(message, response.status);
}
