import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LocalStorageService } from './local-storage.service'
import { R2StorageService } from './r2-storage.service'
import { StorageController } from './storage.controller'
import { StorageService } from './storage.service'

/**
 * Elige el backend de almacenamiento según el entorno:
 *
 *   - Si están las cuatro variables de R2 → R2StorageService.
 *   - Si no → LocalStorageService (disco), con aviso en el log.
 *
 * En producción el disco es efímero (Vercel/Railway lo reinician en cada
 * deploy) y los PDFs son evidencia ISO, así que arrancar en NODE_ENV
 * production sin R2 configurado es un error, no una advertencia.
 */
const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    LocalStorageService,
    {
      provide: StorageService,
      inject: [ConfigService, LocalStorageService],
      useFactory: (config: ConfigService, local: LocalStorageService) => {
        const logger = new Logger('StorageModule')
        const missing = R2_VARS.filter((name) => !config.get<string>(name))

        if (missing.length === 0) {
          logger.log('Almacenamiento: Cloudflare R2')
          return new R2StorageService(config)
        }

        if (config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            `Almacenamiento en disco no es válido en produccion (los archivos se pierden en cada deploy). ` +
              `Faltan variables de R2: ${missing.join(', ')}`,
          )
        }

        logger.warn(
          `Almacenamiento: disco local (uploads/). Faltan variables de R2: ${missing.join(', ')}`,
        )
        return local
      },
    },
  ],
  exports: [StorageService, LocalStorageService],
})
export class StorageModule {}
