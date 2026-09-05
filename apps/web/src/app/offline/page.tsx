import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sin conexión',
}

/**
 * Pantalla que sirve el service worker cuando se pide una página que no está
 * ni en la red ni en la caché.
 *
 * Es deliberadamente estática y sin datos: si dependiera de la API, la pantalla
 * de "no hay conexión" sería lo primero en fallar cuando no hay conexión.
 *
 * Es pública en el middleware por la misma razón: el worker la precachea al
 * instalarse, y si en ese momento no hubiera sesión guardaría bajo esta URL el
 * HTML del login.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta pantalla todavía no se había abierto en este dispositivo, así que no hay
        una copia para mostrar. Lo que ya visitaste sigue disponible.
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        No se pueden cargar datos sin conexión: lo que escribas ahora no se guardaría.
      </p>
      <a
        href="/dashboard"
        className="mt-2 rounded-md border px-4 py-2 text-sm font-medium"
      >
        Volver al inicio
      </a>
    </main>
  )
}
