import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Render del markdown de la guía.
 *
 * Es un componente de servidor a propósito: ni el contenido ni la librería que
 * lo procesa llegan al navegador. Importa para una app que se usa en planta con
 * conexión mala.
 *
 * Los estilos van explícitos y no con las clases `prose`: el plugin de
 * tipografía de Tailwind no está instalado, así que esas clases no harían nada.
 */
export function DocMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-8 border-b pb-2 text-lg font-semibold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-6 text-[15px] font-semibold">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="my-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => (
          // Los enlaces internos de la guía se escriben relativos (`flujos`),
          // así que se resuelven contra /docs/.
          <a
            href={href?.startsWith('http') ? href : `/docs/${href}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-4 rounded-r-lg border-l-2 border-primary/50 bg-muted/40 py-1 pl-4 pr-3 [&>p]:my-2">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          // Sin `className` de lenguaje es código en línea; con él, un bloque
          // que ya viene envuelto en <pre>.
          if (!className) {
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                {children}
              </code>
            )
          }
          return <code className={className}>{children}</code>
        },
        pre: ({ children }) => (
          // Los diagramas ASCII de la guía son anchos: scrollean en su propia
          // caja para que la página nunca scrollee de costado.
          <pre className="my-4 overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-[12px] leading-relaxed">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b px-3 py-2 text-left text-[13px] font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b px-3 py-2 align-top text-muted-foreground last:border-0">
            {children}
          </td>
        ),
        hr: () => <hr className="my-8" />,
      }}
    >
      {content}
    </Markdown>
  )
}
