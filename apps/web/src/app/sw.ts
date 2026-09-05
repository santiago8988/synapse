import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist'
import { API_CACHE_PREFIX, apiCacheName } from '@/lib/offline-cache'

/**
 * Service worker de Synapse.
 *
 * El objetivo es acotado a propósito: que la app **siga abriendo y se pueda
 * leer** cuando la conexión se cae, que es lo que pasa en planta —subsuelo,
 * cámara de frío, paredes gruesas—.
 *
 * Cargar datos sin conexión queda deliberadamente afuera. El problema no es
 * técnico sino normativo: una entrada que el operario completa a las 10:15 y
 * que se sincroniza a las 14:00 no tiene una hora obvia para el registro de
 * auditoría, y elegir mal ahí es peor que no tener la función. Por eso todo lo
 * que no sea `GET` va contra la red y falla en el momento si no hay: el usuario
 * ve el error cuando todavía puede hacer algo, en vez de creer que guardó.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/** Orígenes de fuentes de Google, que `defaultCache` ya cachea bien. */
const ORIGENES_DE_FUENTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']

/**
 * Una estrategia por caché de usuario. Se memoizan porque `ExpirationPlugin`
 * mantiene su propio índice: crear una instancia nueva por request perdería la
 * cuenta de entradas y la caché crecería sin techo.
 */
const estrategias = new Map<string, NetworkFirst>()

function estrategiaPara(cacheName: string): NetworkFirst {
  let estrategia = estrategias.get(cacheName)
  if (!estrategia) {
    estrategia = new NetworkFirst({
      cacheName,
      // Sin esto, una conexión de planta que está pero no anda deja la pantalla
      // colgada indefinidamente en vez de mostrar lo último conocido.
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 24 * 60 * 60,
          maxAgeFrom: 'last-used',
        }),
      ],
    })
    estrategias.set(cacheName, estrategia)
  }
  return estrategia
}

/**
 * Estas reglas van **antes** de `defaultCache` y eso no es cosmético: la última
 * regla de `defaultCache` manda todo lo cross-origin a una única caché
 * compartida (`cross-origin`). Como la API de Synapse vive en otro origen, sin
 * estas reglas cada respuesta de la API terminaría ahí, mezclada entre usuarios
 * — exactamente lo que `apiCacheName` existe para evitar.
 */
const reglasDeApi: RuntimeCaching[] = [
  {
    // Lecturas autenticadas: primero la red, y si no hay, lo último que se vio.
    // Se reconocen por el header `Authorization`, no por el origen, así siguen
    // funcionando aunque cambie dónde está desplegada la API.
    matcher: ({ request }) =>
      request.method === 'GET' && apiCacheName(request.headers.get('Authorization')) !== null,
    handler: async (opciones) => {
      const cacheName = apiCacheName(opciones.request.headers.get('Authorization'))
      // El matcher ya lo garantizó; el fallback es solo para el tipo.
      return estrategiaPara(cacheName ?? `${API_CACHE_PREFIX}desconocido`).handle(opciones)
    },
  },
  {
    // Todo el resto de lo cross-origin —el login, el canje del código, las URLs
    // firmadas de R2— va a la red y no se guarda. Las fuentes quedan afuera
    // para que `defaultCache` las siga cacheando: sin ellas la app offline se
    // ve con la tipografía del sistema.
    matcher: ({ url, sameOrigin }) =>
      !sameOrigin && !ORIGENES_DE_FUENTES.includes(url.origin),
    handler: new NetworkOnly(),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // La app es una sola pantalla de trabajo: que la versión nueva tome el
  // control enseguida evita tener dos versiones conviviendo en una tablet que
  // nadie cierra nunca.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...reglasDeApi, ...defaultCache],
  fallbacks: {
    entries: [
      {
        // Cuando ni la red ni la caché tienen la página pedida.
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
