import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { DocNav } from '@/components/docs/doc-nav'
import { DocMarkdown } from '@/components/docs/doc-markdown'
import { DEFAULT_DOC_SLUG, docSections, findSection } from '@/content/docs'

/**
 * Guía de usuario.
 *
 * Es un componente de servidor: lee el markdown del repositorio en el build y
 * lo renderiza ahí mismo, así ni el contenido ni la librería de markdown viajan
 * al navegador.
 *
 * La sección es un segmento de la URL (`/docs/flujos`), de modo que se puede
 * compartir un enlace a una sección concreta — algo que la versión anterior, con
 * la sección en estado local, no permitía.
 */

const DIRECTORIO = join(process.cwd(), 'src', 'content', 'docs')

/** Prerenderiza una página por sección: la guía no cambia entre despliegues. */
export function generateStaticParams() {
  return [{ slug: [] as string[] }, ...docSections.map((s) => ({ slug: [s.slug] }))]
}

function resolverSlug(params: { slug?: string[] }): string {
  return params.slug?.[0] ?? DEFAULT_DOC_SLUG
}

export function generateMetadata({ params }: { params: { slug?: string[] } }): Metadata {
  const section = findSection(resolverSlug(params))
  return { title: section ? `${section.title} · Guía` : 'Guía' }
}

export default function DocsPage({ params }: { params: { slug?: string[] } }) {
  const slug = resolverSlug(params)
  const section = findSection(slug)
  // Una URL inventada no debe intentar leer un archivo: el slug se valida
  // contra el índice antes de tocar el disco.
  if (!section) notFound()

  const content = readFileSync(join(DIRECTORIO, `${section.slug}.md`), 'utf8')

  const indice = docSections.findIndex((s) => s.slug === section.slug)
  const anterior = indice > 0 ? docSections[indice - 1] : null
  const siguiente = indice < docSections.length - 1 ? docSections[indice + 1] : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guía de usuario</h1>
        <p className="mt-1 text-muted-foreground">
          Cómo funciona Synapse, módulo por módulo
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <DocNav activeSlug={section.slug} />

        <div className="min-w-0 flex-1">
          <Card>
            <CardContent className="p-5 sm:p-7">
              <p className="mb-5 border-b pb-4 text-sm text-muted-foreground">
                {section.summary}
              </p>
              <DocMarkdown content={content} />
            </CardContent>
          </Card>

          {/* Leer la guía de corrido es un caso real: alguien que recién
              arranca no sabe qué sección buscar. */}
          <nav className="mt-4 flex gap-3">
            {anterior && (
              <Link
                href={`/docs/${anterior.slug}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Anterior</span>
                  <span className="block truncate font-medium">{anterior.title}</span>
                </span>
              </Link>
            )}
            {siguiente && (
              <Link
                href={`/docs/${siguiente.slug}`}
                className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-lg border px-4 py-3 text-right text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Siguiente</span>
                  <span className="block truncate font-medium">{siguiente.title}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}
