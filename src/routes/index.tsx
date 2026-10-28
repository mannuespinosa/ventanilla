import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ventanilla — Trámites de la CDMX, sin vueltas" },
      { name: "description", content: "Asistente independiente y open source para resolver dudas sobre trámites de la Ciudad de México." },
      { property: "og:title", content: "Ventanilla — Trámites de la CDMX" },
      { property: "og:description", content: "Pregunta sobre trámites de la CDMX y recibe respuestas con la fuente oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
    </main>
  );
}
