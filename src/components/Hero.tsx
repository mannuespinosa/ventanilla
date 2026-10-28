import { AskInput } from "./AskInput";

export function Hero({ onSubmit }: { onSubmit: (question: string) => void }) {
  return (
    <section className="mx-3 mb-3 md:mx-6 md:mb-6">
      <div className="rounded-[32px] bg-card px-2 pb-3 pt-14 md:px-4 md:pt-20">
        <div className="px-2 text-center">
          <h1 className="font-serif text-[56px] leading-none text-foreground md:text-[96px]">Hola, CDMX</h1>
          <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground md:text-lg">
            Pregunta lo que necesites sobre trámites. Te respondemos con la fuente oficial.
          </p>
        </div>
        <div className="hero-frame relative mt-10 h-[420px] overflow-hidden rounded-[28px] md:h-[520px]">
          <img src="/hero-cdmx.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-overlay to-transparent" />
          <div className="relative flex justify-center px-3 pt-6 md:px-8 md:pt-10">
            <AskInput onSubmit={onSubmit} />
          </div>
        </div>
        <div className="flex justify-start px-1 pb-1 pt-3">
          <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            Proyecto independiente · no oficial
          </span>
        </div>
      </div>
    </section>
  );
}
