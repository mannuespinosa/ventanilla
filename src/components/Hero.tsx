import { AskInput } from "./AskInput";

export function Hero() {
  return (
    <section className="mx-3 mb-3 overflow-hidden rounded-[32px] bg-card md:mx-6 md:mb-6">
      <div className="px-5 pb-10 pt-14 text-center md:pt-24">
        <h1 className="font-serif text-[56px] leading-none text-foreground md:text-[96px]">Hola, CDMX</h1>
        <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground md:text-lg">
          Pregunta lo que necesites sobre trámites. Te respondemos con la fuente oficial.
        </p>
        <div className="mt-10">
          <AskInput onSubmit={(question) => console.log(question)} />
        </div>
      </div>
      <div className="hero-photo relative mx-3 mb-3 h-[340px] overflow-hidden rounded-[24px] md:h-[460px]">
        <div className="absolute inset-0 bg-overlay" />
        <span className="absolute bottom-4 left-4 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          Proyecto independiente · no oficial
        </span>
      </div>
    </section>
  );
}
