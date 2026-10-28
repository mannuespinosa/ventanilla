export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-5 md:px-8">
      <span className="font-serif text-2xl text-foreground">Ventanilla</span>
      <a
        href="#"
        className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition hover:bg-card"
      >
        GitHub
      </a>
    </header>
  );
}
