import Markdown, { type Components } from "react-markdown";

// Sin rehype-raw: el HTML crudo que venga en la respuesta se descarta.
// Las imágenes también, para que el modelo no pueda insertar recursos externos.
const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:text-muted-foreground"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{children}</code>
  ),
};

export function AnswerMarkdown({ children }: { children: string }) {
  return (
    <div className="break-words font-sans text-base leading-7 text-foreground sm:text-[17px]">
      <Markdown skipHtml disallowedElements={["img"]} unwrapDisallowed components={components}>
        {children}
      </Markdown>
    </div>
  );
}
