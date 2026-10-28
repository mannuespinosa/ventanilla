import type { Derivacion } from "./ask";

// Lo que se muestra (y se lee en voz, si el turno fue por voz) cuando no hay fuente.
export const NO_SOURCE_MESSAGE =
  "No encontré una fuente oficial para responder esto con seguridad. Prefiero no adivinar.";

// Con derivación se nombra a la autoridad; la URL va solo en el chip, nunca en voz.
export function noSourceMessage(derivacion?: Derivacion): string {
  if (!derivacion) return NO_SOURCE_MESSAGE;
  return `No encontré una fuente oficial de la Ciudad de México para esto. Este trámite lo atiende ${derivacion.autoridad}.`;
}
