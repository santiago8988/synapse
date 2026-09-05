import { NextResponse, type NextRequest } from 'next/server'

/**
 * Redirige a `/login` cuando se entra a una página privada sin sesión.
 *
 * Alcance, para que quede claro qué es y qué no: **esto es enrutado, no un
 * control de acceso.** Antes se renderizaba el armazón de la página privada,
 * la primera llamada a la API devolvía 401 y recién ahí el cliente rebotaba;
 * el usuario veía un parpadeo de una pantalla que no le correspondía.
 *
 * La autorización real sigue estando en la API, que exige el JWT en cada
 * request. Quien fabrique la cookie a mano llega al cascarón de la app y a
 * ningún dato: todas las llamadas responden 401.
 *
 * La cookie solo lleva el vencimiento del token, nunca el token. Ver
 * `lib/session.ts`.
 */

const SESSION_COOKIE = 'synapse_session_exp'

/**
 * Rutas accesibles sin sesión: el grupo `(auth)` y la pantalla de sin conexión.
 *
 * `/offline` está acá porque el service worker la precachea al instalarse. Si
 * en ese momento no hubiera sesión, el middleware redirigiría al login y el
 * worker guardaría el HTML del login bajo la URL de la pantalla de offline.
 */
const RUTAS_PUBLICAS = ['/login', '/callback', '/select-org', '/offline']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const esPublica = RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  )

  const raw = request.cookies.get(SESSION_COOKIE)?.value
  const exp = raw ? Number(raw) : NaN
  const sesionViva = Number.isFinite(exp) && exp * 1000 > Date.now()

  if (!sesionViva && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Se preserva el destino para poder volver después de iniciar sesión.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Con sesión viva no tiene sentido mostrar el login otra vez.
  if (sesionViva && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  /*
   * Se excluye todo lo que no es una página: los assets de Next, el favicon,
   * el manifest, los iconos de la PWA y los scripts del service worker. El
   * resto queda protegido por defecto, de modo que una página nueva nace
   * protegida en vez de haber que acordarse de agregarla a una lista.
   *
   * Los `.js` del worker (`sw.js` y los `swe-worker-*.js` que genera Serwist)
   * tienen que quedar afuera sí o sí: el navegador los pide sin pasar por la
   * app, y un redirect al login rompe el registro del service worker sin
   * ningún error visible.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon|apple-icon|sw.js|swe-worker-.*\\.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
}
