import raw from "../../ventanilla.config.json";

// Lo que la UI lee de ventanilla.config.json. Los demás campos son para scripts/.
export type VentanillaConfig = {
  nombre: string;
  subtitulo: string;
  ejemplos: string[];
  repo: string;
  // URLs de las funciones: no son secretas. VITE_ASK_URL / VITE_VOICE_URL las sustituyen si existen.
  endpoints: { ask: string; voice: string };
  // Transcripción en vivo en el navegador (Scribe v2 Realtime).
  voz: { modeloRealtime: string; idioma: string; terminosClave: string[] };
};

export const config: VentanillaConfig = {
  nombre: raw.nombre,
  subtitulo: raw.subtitulo,
  ejemplos: raw.ejemplos,
  repo: raw.repo,
  endpoints: {
    ask: import.meta.env["VITE_ASK_URL"] || raw.endpoints.ask,
    voice: import.meta.env["VITE_VOICE_URL"] || raw.endpoints.voice,
  },
  voz: {
    modeloRealtime: raw.voz.modelo_stt_realtime,
    idioma: raw.voz.idioma,
    terminosClave: raw.voz.terminos_clave,
  },
};
