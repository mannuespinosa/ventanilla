import raw from "../../ventanilla.config.json";

// Lo que la UI lee de ventanilla.config.json. Los demás campos son para scripts/.
export type VentanillaConfig = {
  nombre: string;
  subtitulo: string;
  ejemplos: string[];
  repo: string;
};

export const config: VentanillaConfig = {
  nombre: raw.nombre,
  subtitulo: raw.subtitulo,
  ejemplos: raw.ejemplos,
  repo: raw.repo,
};
