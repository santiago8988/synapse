---
name: synapse-security-headers
description: Aplica o revisa la configuración de headers de seguridad en apps/web/next.config.js — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. Incluye plantilla con dominios de Synapse (R2, API, Google OAuth) y checklist para validar después del deploy.
---

# synapse-security-headers

Configura los headers de seguridad HTTP del frontend de Synapse. Es el primer escalón de mitigación contra clickjacking, XSS y ataques cross-origin.

## Estado actual

`apps/web/next.config.js` está mínimo (solo `transpilePackages`). **No hay headers de seguridad configurados** — esto es un gap conocido.

## Plantilla a aplicar

Editar `apps/web/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@synapse/types', '@synapse/validators'],

  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || ''
    const r2Origin = process.env.NEXT_PUBLIC_R2_URL || ''

    const csp = [
      "default-src 'self'",
      `connect-src 'self' ${apiOrigin} https://accounts.google.com`,
      `img-src 'self' data: blob: ${r2Origin} https://lh3.googleusercontent.com`,
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",         // Tailwind/shadcn requieren inline
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev necesita eval; en prod evaluar quitar 'unsafe-eval'
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

## Justificación de cada header

| Header | Por qué |
|---|---|
| `Content-Security-Policy` | Limita orígenes permitidos para scripts/conexiones/imágenes. Mitiga XSS y exfiltración. |
| `Strict-Transport-Security` | Fuerza HTTPS por 2 años + preload. Mitiga downgrade. |
| `X-Frame-Options: DENY` | Previene clickjacking embebiendo Synapse en otro sitio. |
| `X-Content-Type-Options: nosniff` | Previene MIME-sniffing. |
| `Referrer-Policy` | Limita info del referer en requests cross-origin. |
| `Permissions-Policy` | Cierra APIs sensibles que la app no usa. `camera=(self)` se permite porque la PWA permite tomar fotos en entries. `interest-cohort=()` rechaza FLoC. |
| `X-DNS-Prefetch-Control` | Performance (no es seguridad estricta pero útil). |

## Notas sobre CSP

### `'unsafe-inline'` para style-src
Requerido por Tailwind y shadcn/ui (clases utility con custom properties). Imposible quitarlo sin nonces, que requieren server-rendering controlado.

### `'unsafe-eval'` para script-src
Requerido por Next.js en desarrollo y por algunas dependencias en runtime. Para producción, considerar:
1. Auditar qué libs lo usan: `grep -rn "eval\|new Function" node_modules/<sospechoso>`.
2. Si es solo Next dev → eliminar de prod usando `process.env.NODE_ENV === 'production' ? '' : "'unsafe-eval'"` en el array.
3. Si es `mathjs` u otro evaluador → mantener pero documentar.

### Nuevos dominios
Si se agrega un servicio externo (analytics, Sentry, etc.):
1. Agregar el origen a `connect-src`.
2. Si carga scripts → a `script-src`.
3. Si embebe contenido → a `frame-src`.

## Checklist post-aplicación

```bash
# 1. Build para verificar que no rompe
pnpm --filter @synapse/web build

# 2. Levantar en local
pnpm --filter @synapse/web dev

# 3. Abrir DevTools → Network → seleccionar el request del HTML principal
#    Verificar que los headers aparecen en Response Headers.

# 4. Probar el flujo completo:
#    - Login con Google (verificar que redirect funciona — form-action permite accounts.google.com)
#    - Cargar dashboard (verificar que la API responde — connect-src permite NEXT_PUBLIC_API_URL)
#    - Subir un avatar/documento (verificar que R2 carga — img-src permite el origen R2)
#    - Cualquier consola error de CSP → ajustar la directiva específica
```

## Validación externa

Después del deploy, correr en `securityheaders.com`:
```
https://securityheaders.com/?q=https://app.synapse.tld&followRedirects=on
```

Esperado: nota A o A+. Si sale B o menos, revisar qué falta.

Para CSP específicamente:
```
https://csp-evaluator.withgoogle.com/?csp=<paste de la CSP en URL-encoded>
```

## Si necesitás revisar la config existente

Leer `apps/web/next.config.js` y comparar con la plantilla:
- ¿Está `headers()`? Si no, aplicar la plantilla completa.
- ¿Falta algún header? Agregarlo manteniendo los demás.
- ¿La CSP excluye algún dominio que necesitamos? Agregarlo.
- ¿Algún header está más permisivo de lo necesario (ej. `frame-ancestors *`)? Endurecerlo.

## NO hacer

- No usar `script-src 'self' 'unsafe-inline' *` — eso es no tener CSP.
- No copiar una CSP de otro proyecto sin ajustar `connect-src` a los dominios específicos de Synapse.
- No deshabilitar HSTS para "facilitar testing local". Usá un dominio dev separado o `NEXT_PUBLIC_DISABLE_HSTS=1` con un guard explícito.
- No agregar `unsafe-hashes` ni `unsafe-allow-redirects` salvo justificación documentada.
