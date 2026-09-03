import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { buildObjectKey } from './local-storage.service'
import {
  SignedUrlOptions,
  StorageScope,
  StorageService,
  StoredObject,
  UploadedFileLike,
} from './storage.service'

/**
 * Backend de producción: Cloudflare R2 vía la API S3.
 *
 * Los objetos se guardan como <scope>/<organizationId>/<uuid>-<nombre>. El
 * bucket es privado: el acceso se da siempre con presigned URLs de corta vida
 * emitidas por un endpoint autenticado, nunca exponiendo el objeto público.
 */
@Injectable()
export class R2StorageService extends StorageService {
  private readonly logger = new Logger(R2StorageService.name)
  private readonly client: S3Client
  private readonly bucket: string

  constructor(private config: ConfigService) {
    super()
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID')
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET_NAME')
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    })
  }

  async put(
    scope: StorageScope,
    organizationId: string,
    file: UploadedFileLike,
  ): Promise<StoredObject> {
    const key = buildObjectKey(organizationId, file.originalname)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${scope}/${key}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    )
    return {
      key,
      name: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }
  }

  async signedUrl(
    scope: StorageScope,
    key: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: `${scope}/${key}`,
      // Hace que el browser ofrezca el nombre original y no la key con uuid.
      ...(options.downloadName
        ? {
            ResponseContentDisposition: `inline; filename="${sanitizeHeaderFilename(
              options.downloadName,
            )}"`,
          }
        : {}),
    })
    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn ?? 900,
    })
  }

  async remove(scope: StorageScope, key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: `${scope}/${key}` }),
      )
    } catch (err) {
      this.logger.warn(`No se pudo borrar ${scope}/${key} de R2: ${String(err)}`)
    }
  }
}

/**
 * Content-Disposition viaja en un header HTTP: comillas y saltos de línea
 * permitirían inyectar headers. El nombre lo eligió el usuario al subir el
 * archivo, así que se sanea antes de reflejarlo.
 */
function sanitizeHeaderFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._ -]/g, '_')
}
