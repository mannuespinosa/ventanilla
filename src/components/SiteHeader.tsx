import { Button } from "@/components/ui/button";

export function SiteHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 py-5 md:px-8">
      <Button variant="ghost" onClick={onHome} className="h-auto p-0 font-serif text-2xl font-normal text-foreground hover:bg-transparent">Ventanilla</Button>
      <a
        href="#"
        className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition hover:bg-card"
      >
        GitHub
      </a>
    </header>
  );
}
