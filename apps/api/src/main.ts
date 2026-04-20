import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const config = app.get(ConfigService)
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000')

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
