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

/** Rutas del grupo `(auth)`: accesibles sin sesión. */
const RUTAS_PUBLICAS = ['/login', '/callback', '/select-org']

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
   * el manifest y los iconos de la PWA. El resto queda protegido por defecto,
   * de modo que una página nueva nace protegida en vez de haber que acordarse
   * de agregarla a una lista.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
}
