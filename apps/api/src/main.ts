import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { normalizeFrontendUrl } from './common/config/frontend-url'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const config = app.get(ConfigService)
  // Normalizada: una barra final pegada desde el navegador rompe el CORS sin
  // que nada mas de un sintoma. Ver common/config/frontend-url.ts.
  const frontendUrl = normalizeFrontendUrl(config.get<string>('FRONTEND_URL'))

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  })

  // La API no mandaba ningun header de seguridad. Estos van a mano y no con
  // helmet para no agregar una dependencia: son los que aplican a una API JSON,
  // que no renderiza HTML propio.
  //
  // El CSP es restrictivo porque ninguna respuesta de la API deberia ejecutarse
  // como pagina; StorageController define el suyo, mas especifico, para los PDF.
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    )
    // Solo tiene efecto sobre HTTPS; en el localhost de desarrollo es inocuo.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    next()
  })

  app.setGlobalPrefix('api')

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  console.log(`🚀 API corriendo en http://localhost:${port}`)
}
bootstrap()
