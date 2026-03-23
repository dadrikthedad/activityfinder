// core/i18n/i18next.d.ts
// TypeScript-deklarasjon for full type-sikkerhet på t()-kall.
// Tilsvarer sterkt typede resource-nøkler i .NET IStringLocalizer<T>.
//
// Etter dette vil t("auth.ukjentNøkkel") gi kompileringsfeil,
// og du får full autocomplete på alle nøkler i VSCode.

import { resources } from "@/core/i18n";

declare module "i18next" {
  interface CustomTypeOptions {
    // Bruker norsk som "fasit" — alle andre språk må matche samme struktur
    resources: typeof resources["no"];
  }
}
