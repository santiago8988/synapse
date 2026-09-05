/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production'

// Origen de la API. En dev suele ser http://localhost:3001/api; para la CSP
// solo interesa el origen, sin el path.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin
  } catch {
    return ''
  }
})()

// Origen de los PDFs. Con R2 activo son URLs firmadas contra
// https://<account-id>.r2.cloudflarestorage.com. El account id no es secreto,
// pero tampoco está expuesto al frontend, así que por defecto se acepta el
// comodín de subdominio y se puede endurecer definiendo NEXT_PUBLIC_R2_URL con
// el origen exacto. Con el backend de disco los PDFs salen de la propia API,
// que ya está contemplada vía apiOrigin.
const r2Origin =
  process.env.NEXT_PUBLIC_R2_URL || 'https://*.r2.cloudflarestorage.com'

const csp = [
  "default-src 'self'",

  // El HMR de Next abre un websocket contra el propio host en desarrollo.
  // Sin esto, el hot reload deja de funcionar apenas se activa la CSP.
  [
    "connect-src 'self'",
    apiOrigin,
    'https://accounts.google.com',
    isDev ? 'ws://localhost:* http://localhost:*' : '',
  ]
    .filter(Boolean)
    .join(' '),

  `img-src 'self' data: blob: ${r2Origin} https://lh3.googleusercontent.com`,

  // El visor de documentos embebe el PDF en un <iframe> apuntando a la URL
  // firmada. Sin frame-src esto cae en default-src 'self' y el preview queda
  // en blanco, que es el modo silencioso en que una CSP rompe una feature.
  `frame-src 'self' ${apiOrigin} ${r2Origin}`.trim(),

  "font-src 'self' data:",

  // Tailwind y shadcn generan estilos inline; quitarlo exigiría nonces.
  "style-src 'self' 'unsafe-inline'",

  // 'unsafe-eval' solo en desarrollo: lo necesitan el refresh de React y los
  // source maps de webpack. En el bundle de producción no hace falta —
  // mathjs corre en el backend, no en el browser, pese a lo que sugieren
  // algunos textos de la UI.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,

  // La app nunca se embebe en otro sitio.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",

  // El login redirige a Google por navegación de nivel superior.
  "form-action 'self' https://accounts.google.com",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // camera=(self) porque el alta de registros permite sacar una foto
    // (capture="environment" en records/new). El resto se cierra.
    value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

// HSTS solo en producción: en desarrollo se sirve por http y, si el navegador
// llegara a fijarlo para localhost, afectaría a cualquier otro proyecto local
// servido por http en el mismo host.
if (!isDev) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  })
}

const nextConfig = {
  // Permite construir en un directorio aparte sin editar este archivo:
  //   NEXT_DIST_DIR=.next-verify next build
  // Editarlo con el dev server corriendo lo hace recargar y apuntar al
  // directorio temporal; si despues se borra, el server queda sirviendo desde
  // una carpeta inexistente y la app pierde los estilos.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  transpilePackages: ['@synapse/types', '@synapse/validators'],

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

module.exports = nextConfig
