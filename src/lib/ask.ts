export type Source = { titulo: string; url: string };
export type AskResponse = { answer: string; sources: Source[] };

const PORTAL_URL = "https://tramites.cdmx.gob.mx";

export async function ask(question: string): Promise<AskResponse> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));
  const normalized = question.toLocaleLowerCase("es-MX");

  // Provisional examples: replace this implementation with the real service.
  if (normalized.includes("licencia")) {
    return {
      answer: "Para renovar tu licencia de conducir en la CDMX, revisa los requisitos del trámite y prepara tus documentos. Consulta el portal oficial para confirmar el costo y si necesitas una cita antes de ir.",
      sources: [
        { titulo: "Renovación de licencia de conducir", url: PORTAL_URL },
        { titulo: "Requisitos para licencia de conducir", url: PORTAL_URL },
      ],
    };
  }
  if (normalized.includes("acta")) {
    return {
      answer: "Para obtener una copia de tu acta de nacimiento, consulta las opciones disponibles en el portal de trámites de la CDMX. Ten a la mano tus datos de registro y confirma los requisitos antes de solicitarla.",
      sources: [{ titulo: "Solicitud de acta de nacimiento", url: PORTAL_URL }],
    };
  }
  if (normalized.includes("tenencia")) {
    return {
      answer: "Para pagar la tenencia, consulta el trámite correspondiente en el portal de la CDMX. Revisa el importe, los plazos y los requisitos vigentes para tu vehículo antes de hacer el pago.",
      sources: [{ titulo: "Pago de tenencia vehicular", url: PORTAL_URL }],
    };
  }
  if (normalized.includes("domicilio")) {
    return {
      answer: "Para tramitar tu constancia de domicilio en la CDMX, consulta el trámite en el portal oficial. Revisa los requisitos y los documentos que debes presentar antes de acudir.",
      sources: [{ titulo: "Constancia de domicilio", url: PORTAL_URL }],
    };
  }
  return { answer: "", sources: [] };
}