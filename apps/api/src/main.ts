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

  app.setGlobalPrefix('api')

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  console.log(`🚀 API corriendo en http://localhost:${port}`)
}
bootstrap()
