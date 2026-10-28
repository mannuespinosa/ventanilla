// Derivaciones: trámites que no son de esta ciudad y a qué autoridad le tocan.
// Las ligas vienen curadas en ventanilla.config.json; el modelo nunca las genera.

export type Derivacion = { temas: string[]; autoridad: string; url: string };

// Sin acentos ni mayúsculas: "Pasaporte", "pasaporté" y "PASAPORTE" coinciden.
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Primera derivación con un tema en la pregunta, por palabra o frase completa:
// "ine" coincide con "mi INE" pero no con "línea" ni "inexistente".
export function buscarDerivacion(
  pregunta: string,
  derivaciones: Derivacion[],
): { autoridad: string; url: string } | null {
  const texto = normalizar(pregunta);
  for (const { temas, autoridad, url } of derivaciones) {
    const coincide = temas.some((tema) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${escapar(normalizar(tema))}(?![\\p{L}\\p{N}])`, "u").test(
        texto,
      ),
    );
    if (coincide) return { autoridad, url };
  }
  return null;
}
