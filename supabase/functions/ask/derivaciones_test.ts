// deno test supabase/functions/ask/derivaciones_test.ts
import config from "../../../ventanilla.config.json" with { type: "json" };
import { buscarDerivacion, normalizar } from "./derivaciones.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Esperaba ${JSON.stringify(expected)}, llegó ${JSON.stringify(actual)}`);
  }
}

const derivaciones = config.derivaciones;
const autoridad = (pregunta: string) => buscarDerivacion(pregunta, derivaciones)?.autoridad ?? null;

Deno.test("normaliza acentos y mayúsculas", () => {
  assertEquals(normalizar("¿Dónde renuevo mi PASAPORTÉ?"), "¿donde renuevo mi pasaporte?");
});

Deno.test("pasaporte → SRE, sin importar acentos ni mayúsculas", () => {
  assertEquals(
    autoridad("Renovación de pasaporte de mi hija"),
    "Secretaría de Relaciones Exteriores (SRE)",
  );
  assertEquals(autoridad("¿DÓNDE SACO EL PASAPORTE?"), "Secretaría de Relaciones Exteriores (SRE)");
  assertEquals(buscarDerivacion("pasaporte", derivaciones)?.url, "https://www.gob.mx/pasaporte");
  assertEquals(
    autoridad("Pasaportes para toda la familia"),
    "Secretaría de Relaciones Exteriores (SRE)",
  );
});

Deno.test("CURP e INE coinciden por palabra y por frase completa", () => {
  assertEquals(autoridad("¿Cómo saco mi CURP?"), "Registro Nacional de Población (RENAPO)");
  assertEquals(autoridad("Perdí mi INE"), "Instituto Nacional Electoral (INE)");
  assertEquals(autoridad("renovar la credencial de elector"), "Instituto Nacional Electoral (INE)");
});

Deno.test("no coincide dentro de otras palabras", () => {
  assertEquals(autoridad("¿Cómo pago en línea?"), null);
  assertEquals(autoridad("constancia de inexistencia de registro"), null);
  assertEquals(autoridad("pasaportero"), null);
});

Deno.test("un tema sin derivación no se deriva", () => {
  assertEquals(autoridad("¿Cómo saco mi RFC?"), null);
  assertEquals(autoridad("¿Cuánto cuesta la licencia tipo A?"), null);
});
