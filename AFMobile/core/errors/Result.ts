// core/errors/Result.ts
// Tilsvarer Result og Result<T> i AFBack.
// Brukes i services for å returnere suksess/feil uten å kaste exceptions.
//
// Bruk:
//   return Result.ok(data)
//   return Result.fail("Feilmelding", AuthErrorCode.InvalidCredentials)
//
//   const result = await loginUser(email, password)
//   if (!result.success) { ... result.code ... }
//   else { ... result.data ... }

import type { AppErrorCode } from "./ErrorCode";

// Suksess-variant
interface OkResult<T> {
  success: true;
  data: T;
}

// Feil-variant
interface FailResult<C extends AppErrorCode> {
  success: false;
  error: string;      // Menneskelig lesbar feilmelding (vises i UI)
  code: C;            // Maskinlesbar kode (brukes i switch/if)
}

export type Result<T, C extends AppErrorCode> = OkResult<T> | FailResult<C>;

// Variant uten verdi — for operasjoner som kun returnerer suksess/feil
// Tilsvarer Result (ikke Result<T>) i AFBack
export type VoidResult<C extends AppErrorCode> = Result<void, C>;

// Hjelpefunksjoner — tilsvarer Result.Success() og Result.Failure() i AFBack
export const Result = {
  ok<T, C extends AppErrorCode>(data: T): Result<T, C> {
    return { success: true, data };
  },

  okVoid<C extends AppErrorCode>(): VoidResult<C> {
    return { success: true, data: undefined };
  },

  fail<T, C extends AppErrorCode>(error: string, code: C): Result<T, C> {
    return { success: false, error, code };
  },

  failVoid<C extends AppErrorCode>(error: string, code: C): VoidResult<C> {
    return { success: false, error, code };
  },
};
