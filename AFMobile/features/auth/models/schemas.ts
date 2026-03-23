// features/auth/models/schemas.ts
// Zod-schemas for auth-skjemaer.
// Passordregler matcher Identity-konfigurasjon i AFBack:
//   RequireDigit, RequireLowercase, RequireUppercase = true
//   RequireNonAlphanumeric = false
//   RequiredLength = 8, maks 128 tegn (SignupRequest)
import { z } from "zod";

/**
 * Zod-schema for login-skjemaet.
 * Validerer e-post og passord før API-kall.
 * Passordet valideres kun på lengde her — backend gir presis feilmelding ved feil credentials.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Invalid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(8, "Must be at least 8 characters."),
});

/** Utledet type fra loginSchema — brukes i useForm<LoginFormValues> */
export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Zod-schema for passord-reset steg 3 (nytt passord + bekreftelse).
 * Matcher Identity-konfigurasjon i AFBack nøyaktig.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Must be at least 8 characters.")
      .max(128, "Cannot exceed 128 characters.")
      .regex(/[A-Z]/, "Must contain an uppercase letter.")
      .regex(/[a-z]/, "Must contain a lowercase letter.")
      .regex(/\d/, "Must contain a number."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/** Utledet type fra resetPasswordSchema — brukes i useForm<ResetPasswordFormValues> */
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
